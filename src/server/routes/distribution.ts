import { Hono } from 'hono';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { controlledCopies, copyDistributions, copyAcknowledgements, departments } from '@/db/schema';
import { PERMISSIONS } from '@/lib/permissions';
import { recordAuditEvent } from '@/lib/audit';
import { storage } from '@/lib/storage';
import { requireAuth, requirePermission } from '../authz';

export const distributionRoutes = new Hono();
distributionRoutes.use('*', requireAuth);

distributionRoutes.get('/', async (c) => {
  const session = c.get('session');
  const status = c.req.query('status');
  const rows = status
    ? await db
        .select()
        .from(controlledCopies)
        .where(and(eq(controlledCopies.organizationId, session.organizationId), eq(controlledCopies.status, status as any)))
        .orderBy(desc(controlledCopies.updatedAt))
    : await db
        .select()
        .from(controlledCopies)
        .where(eq(controlledCopies.organizationId, session.organizationId))
        .orderBy(desc(controlledCopies.updatedAt));
  return c.json({ copies: rows });
});

distributionRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [copy] = await db.select().from(controlledCopies).where(eq(controlledCopies.id, id));
  if (!copy) return c.json({ error: 'Not found' }, 404);
  const dists = await db.select().from(copyDistributions).where(eq(copyDistributions.controlledCopyId, id));
  const acks = await db.select().from(copyAcknowledgements).where(eq(copyAcknowledgements.controlledCopyId, id));
  return c.json({ copy, distributions: dists, acknowledgements: acks });
});

// Issue a printed copy to a named employee/location (Module C).
distributionRoutes.post('/:id/distribute', requirePermission(PERMISSIONS.COPY_ISSUE), async (c) => {
  const session = c.get('session');
  const id = c.req.param('id');
  const body = await c.req.json();

  const [copy] = await db.select().from(controlledCopies).where(eq(controlledCopies.id, id));
  if (!copy) return c.json({ error: 'Not found' }, 404);
  if (copy.status !== 'PRINTED') return c.json({ error: `Cannot distribute a copy in status ${copy.status}` }, 400);

  await db.insert(copyDistributions).values({
    controlledCopyId: id,
    issuedToUserId: body.issuedToUserId ?? null,
    departmentId: body.departmentId,
    physicalLocation: body.physicalLocation,
    equipmentOrLine: body.equipmentOrLine ?? null,
    issuedByUserId: session.userId,
    remarks: body.remarks ?? null,
  });

  const [updated] = await db
    .update(controlledCopies)
    .set({ status: 'ISSUED', destinationLocation: body.physicalLocation, issuedToDepartmentId: body.departmentId, updatedAt: new Date() })
    .where(eq(controlledCopies.id, id))
    .returning();

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'COPY_ISSUED',
    entityType: 'controlled_copy',
    entityId: id,
    summary: `${copy.copyIdentifier} issued to ${body.physicalLocation}`,
  });

  return c.json({ copy: updated });
});

distributionRoutes.post('/:id/acknowledge', requirePermission(PERMISSIONS.COPY_ACKNOWLEDGE), async (c) => {
  const session = c.get('session');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const [copy] = await db.select().from(controlledCopies).where(eq(controlledCopies.id, id));
  if (!copy) return c.json({ error: 'Not found' }, 404);

  await db.insert(copyAcknowledgements).values({
    controlledCopyId: id,
    acknowledgedByUserId: session.userId,
    remarks: body.remarks ?? null,
  });

  const [updated] = await db
    .update(controlledCopies)
    .set({ status: 'ACTIVE', updatedAt: new Date() })
    .where(eq(controlledCopies.id, id))
    .returning();

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'COPY_ACKNOWLEDGED',
    entityType: 'controlled_copy',
    entityId: id,
    summary: `${copy.copyIdentifier} acknowledged by ${session.fullName}`,
  });

  return c.json({ copy: updated });
});

// Manual status transitions: RETURNED, LOST, DAMAGED (destruction is its own
// endpoint under recalls.ts because it usually happens as part of reconciliation,
// but a copy can also be destroyed outside a recall — see /destroy below).
distributionRoutes.post('/:id/status', requirePermission(PERMISSIONS.COPY_INVENTORY_MANAGE), async (c) => {
  const session = c.get('session');
  const id = c.req.param('id');
  const body = await c.req.json<{ status: string; remarks?: string }>();

  const allowed = ['RETURNED', 'LOST', 'DAMAGED', 'ACTIVE'];
  if (!allowed.includes(body.status)) return c.json({ error: 'Unsupported status transition' }, 400);

  const [copy] = await db.select().from(controlledCopies).where(eq(controlledCopies.id, id));
  if (!copy) return c.json({ error: 'Not found' }, 404);

  const [updated] = await db
    .update(controlledCopies)
    .set({ status: body.status as any, updatedAt: new Date() })
    .where(eq(controlledCopies.id, id))
    .returning();

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'COPY_STATUS_CHANGED',
    entityType: 'controlled_copy',
    entityId: id,
    summary: `${copy.copyIdentifier} marked ${body.status}${body.remarks ? ' — ' + body.remarks : ''}`,
    previousValue: { status: copy.status },
    newValue: { status: body.status },
  });

  return c.json({ copy: updated });
});

// Serve the generated, stamped PDF for a copy. Gated by requireAuth: a raw
// download link is not how scanning works (see verify.ts) — only signed-in,
// permitted users can pull the actual file.
distributionRoutes.get('/:id/pdf', async (c) => {
  const id = c.req.param('id');
  const [copy] = await db.select().from(controlledCopies).where(eq(controlledCopies.id, id));
  if (!copy || !copy.pdfFileKey) return c.json({ error: 'Not found' }, 404);
  const bytes = await storage.getObject(copy.pdfFileKey);
  if (!bytes) return c.json({ error: 'File missing from storage' }, 404);
  return c.body(bytes, 200, {
    'Content-Type': 'application/pdf',
    'Content-Disposition': `inline; filename="${copy.copyIdentifier}.pdf"`,
  });
});

// Physical copy inventory dashboard queries (Module C).
distributionRoutes.get('/inventory/summary', async (c) => {
  const session = c.get('session');
  const rows = await db
    .select()
    .from(controlledCopies)
    .where(eq(controlledCopies.organizationId, session.organizationId));

  const summary: Record<string, number> = {};
  for (const row of rows) {
    summary[row.status] = (summary[row.status] ?? 0) + 1;
  }
  return c.json({ summary, total: rows.length });
});
