import { Hono } from 'hono';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  documentRecalls,
  recallItems,
  controlledCopies,
  documents,
  documentRevisions,
  destructionConfirmations,
  documentExceptions,
  notifications,
} from '@/db/schema';
import { PERMISSIONS } from '@/lib/permissions';
import { recordAuditEvent } from '@/lib/audit';
import { requireAuth, requirePermission } from '../authz';

export const recallRoutes = new Hono();
recallRoutes.use('*', requireAuth);

const DESTRUCTION_WINDOW_DAYS = 7;
const ACTIVE_COPY_STATUSES = ['ISSUED', 'ACKNOWLEDGED', 'ACTIVE', 'RECALL_PENDING'] as const;

recallRoutes.get('/', async (c) => {
  const session = c.get('session');
  const rows = await db
    .select()
    .from(documentRecalls)
    .where(eq(documentRecalls.organizationId, session.organizationId))
    .orderBy(desc(documentRecalls.initiatedAt));
  return c.json({ recalls: rows });
});

recallRoutes.get('/:id', async (c) => {
  const id = c.req.param('id');
  const [recall] = await db.select().from(documentRecalls).where(eq(documentRecalls.id, id));
  if (!recall) return c.json({ error: 'Not found' }, 404);
  const items = await db.select().from(recallItems).where(eq(recallItems.documentRecallId, id));
  const copies = items.length
    ? await db.select().from(controlledCopies).where(inArray(controlledCopies.id, items.map((i) => i.controlledCopyId)))
    : [];
  return c.json({ recall, items, copies });
});

// Step 3-5 of Module E: register new revision (done via documents.ts), then
// identify all active copies of the previous revision and generate the recall.
recallRoutes.post('/', requirePermission(PERMISSIONS.RECALL_INITIATE), async (c) => {
  const session = c.get('session');
  const body = await c.req.json<{ documentId: string; supersededRevisionId: string; newRevisionId: string; isEmergencyWithdrawal?: boolean }>();

  const activeCopies = await db
    .select()
    .from(controlledCopies)
    .where(and(eq(controlledCopies.documentRevisionId, body.supersededRevisionId), inArray(controlledCopies.status, [...ACTIVE_COPY_STATUSES])));

  const [recall] = await db
    .insert(documentRecalls)
    .values({
      organizationId: session.organizationId,
      documentId: body.documentId,
      supersededRevisionId: body.supersededRevisionId,
      newRevisionId: body.newRevisionId,
      initiatedByUserId: session.userId,
      isEmergencyWithdrawal: !!body.isEmergencyWithdrawal,
    })
    .returning();

  const dueAt = new Date(Date.now() + DESTRUCTION_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const createdItems = [];
  for (const copy of activeCopies) {
    const [item] = await db
      .insert(recallItems)
      .values({ documentRecallId: recall.id, controlledCopyId: copy.id, destructionDueAt: dueAt })
      .returning();
    createdItems.push(item);

    await db.update(controlledCopies).set({ status: 'RECALL_PENDING', updatedAt: new Date() }).where(eq(controlledCopies.id, copy.id));

    if (copy.issuedToDepartmentId) {
      await db.insert(notifications).values({
        organizationId: session.organizationId,
        userId: session.userId, // in a full build this fans out to the holder; MVP notifies the initiator
        kind: 'RECALL_DESTRUCTION_DUE',
        title: `Recall: return/destroy ${copy.copyIdentifier}`,
        body: `Due by ${dueAt.toDateString()}.`,
        relatedEntityType: 'controlled_copy',
        relatedEntityId: copy.id,
      });
    }
  }

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'RECALL_INITIATED',
    entityType: 'document_recall',
    entityId: recall.id,
    summary: `Recall initiated for ${createdItems.length} active copies of revision ${body.supersededRevisionId}`,
  });

  return c.json({ recall, items: createdItems }, 201);
});

recallRoutes.post('/items/:itemId/acknowledge', requireAuth, async (c) => {
  const session = c.get('session');
  const itemId = c.req.param('itemId');
  const [item] = await db
    .update(recallItems)
    .set({ status: 'RECALL_ACKNOWLEDGED', acknowledgedAt: new Date(), updatedAt: new Date() })
    .where(eq(recallItems.id, itemId))
    .returning();
  if (!item) return c.json({ error: 'Not found' }, 404);

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'RECALL_ITEM_ACKNOWLEDGED',
    entityType: 'recall_item',
    entityId: itemId,
    summary: `Recall item acknowledged by ${session.fullName}`,
  });
  return c.json({ item });
});

recallRoutes.post('/items/:itemId/retrieve', requirePermission(PERMISSIONS.RECALL_INITIATE), async (c) => {
  const session = c.get('session');
  const itemId = c.req.param('itemId');

  const [item] = await db
    .update(recallItems)
    .set({ status: 'PHYSICALLY_RETRIEVED', retrievedAt: new Date(), updatedAt: new Date() })
    .where(eq(recallItems.id, itemId))
    .returning();
  if (!item) return c.json({ error: 'Not found' }, 404);

  await db.update(controlledCopies).set({ status: 'RETURNED', updatedAt: new Date() }).where(eq(controlledCopies.id, item.controlledCopyId));

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'RECALL_ITEM_RETRIEVED',
    entityType: 'recall_item',
    entityId: itemId,
    summary: `Copy physically retrieved`,
  });
  return c.json({ item });
});

// Destruction is NEVER automatic on recall initiation — only this explicit
// step, with a named witness, marks a copy destroyed (spec §2 Module E).
recallRoutes.post('/items/:itemId/destroy', requirePermission(PERMISSIONS.RECALL_INITIATE), async (c) => {
  const session = c.get('session');
  const itemId = c.req.param('itemId');
  const body = await c.req.json<{ witnessName: string; destructionMethod?: string; remarks?: string }>();

  if (!body.witnessName) return c.json({ error: 'Witness name is required to confirm destruction' }, 400);

  const [item] = await db.select().from(recallItems).where(eq(recallItems.id, itemId));
  if (!item) return c.json({ error: 'Not found' }, 404);
  if (item.status !== 'PHYSICALLY_RETRIEVED') {
    return c.json({ error: 'A copy must be physically retrieved before destruction can be confirmed' }, 400);
  }

  const [confirmation] = await db
    .insert(destructionConfirmations)
    .values({
      controlledCopyId: item.controlledCopyId,
      recallItemId: item.id,
      destructionMethod: body.destructionMethod ?? 'Shredding',
      performedByUserId: session.userId,
      witnessName: body.witnessName,
      remarks: body.remarks ?? null,
    })
    .returning();

  const [updatedItem] = await db
    .update(recallItems)
    .set({ status: 'DESTRUCTION_CONFIRMED', updatedAt: new Date() })
    .where(eq(recallItems.id, itemId))
    .returning();

  await db.update(controlledCopies).set({ status: 'DESTROYED', updatedAt: new Date() }).where(eq(controlledCopies.id, item.controlledCopyId));

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'DESTRUCTION_CONFIRMED',
    entityType: 'controlled_copy',
    entityId: item.controlledCopyId,
    summary: `Destruction confirmed, witness: ${body.witnessName}`,
  });

  return c.json({ item: updatedItem, confirmation });
});

recallRoutes.post('/items/:itemId/escalate', requirePermission(PERMISSIONS.RECALL_INITIATE), async (c) => {
  const session = c.get('session');
  const itemId = c.req.param('itemId');
  const [item] = await db
    .update(recallItems)
    .set({ status: 'OUTSTANDING', escalatedAt: new Date(), updatedAt: new Date() })
    .where(eq(recallItems.id, itemId))
    .returning();
  if (!item) return c.json({ error: 'Not found' }, 404);

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'RECALL_ITEM_ESCALATED',
    entityType: 'recall_item',
    entityId: itemId,
    summary: `Recall item escalated as outstanding`,
  });
  return c.json({ item });
});

// Request/approve a documented exception for an outstanding item (lost,
// damaged beyond return, etc.) — this is the ONLY other way an item can clear.
recallRoutes.post('/items/:itemId/exception', requirePermission(PERMISSIONS.RECALL_INITIATE), async (c) => {
  const session = c.get('session');
  const itemId = c.req.param('itemId');
  const body = await c.req.json<{ reason: string }>();

  const [item] = await db.select().from(recallItems).where(eq(recallItems.id, itemId));
  if (!item) return c.json({ error: 'Not found' }, 404);

  const [recall] = await db.select().from(documentRecalls).where(eq(documentRecalls.id, item.documentRecallId));

  const [exception] = await db
    .insert(documentExceptions)
    .values({
      organizationId: recall!.organizationId,
      documentRecallId: item.documentRecallId,
      recallItemId: item.id,
      reason: body.reason,
      requestedByUserId: session.userId,
    })
    .returning();

  await recordAuditEvent({
    organizationId: recall!.organizationId,
    userId: session.userId,
    eventType: 'EXCEPTION_REQUESTED',
    entityType: 'document_exception',
    entityId: exception.id,
    summary: `Exception requested for outstanding recall item: ${body.reason}`,
  });

  return c.json({ exception }, 201);
});

recallRoutes.post('/exceptions/:exceptionId/decide', requirePermission(PERMISSIONS.EXCEPTION_APPROVE), async (c) => {
  const session = c.get('session');
  const exceptionId = c.req.param('exceptionId');
  const body = await c.req.json<{ decision: 'APPROVED' | 'REJECTED' }>();

  const [exception] = await db
    .update(documentExceptions)
    .set({ status: body.decision, decidedByUserId: session.userId, decidedAt: new Date() })
    .where(eq(documentExceptions.id, exceptionId))
    .returning();
  if (!exception) return c.json({ error: 'Not found' }, 404);

  if (body.decision === 'APPROVED' && exception.recallItemId) {
    await db
      .update(recallItems)
      .set({ status: 'EXCEPTION_APPROVED', updatedAt: new Date() })
      .where(eq(recallItems.id, exception.recallItemId));
  }

  await recordAuditEvent({
    organizationId: exception.organizationId,
    userId: session.userId,
    eventType: 'EXCEPTION_DECIDED',
    entityType: 'document_exception',
    entityId: exceptionId,
    summary: `Exception ${body.decision.toLowerCase()} by ${session.fullName}`,
  });

  return c.json({ exception });
});

// Close a recall ONLY when every item is destroyed or carries an approved
// exception; otherwise return the outstanding list and refuse — this is the
// single most important integrity rule in the whole recall module.
recallRoutes.post('/:id/close', requirePermission(PERMISSIONS.RECALL_CLOSE), async (c) => {
  const session = c.get('session');
  const id = c.req.param('id');

  const items = await db.select().from(recallItems).where(eq(recallItems.documentRecallId, id));
  const unresolved = items.filter((i) => !['DESTRUCTION_CONFIRMED', 'EXCEPTION_APPROVED'].includes(i.status));

  if (unresolved.length > 0) {
    return c.json(
      {
        error: 'Cannot close recall: unresolved items remain',
        outstandingItems: unresolved,
      },
      409
    );
  }

  const [updated] = await db
    .update(documentRecalls)
    .set({ status: 'RECONCILED', closedAt: new Date(), closedByUserId: session.userId })
    .where(eq(documentRecalls.id, id))
    .returning();

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'RECALL_CLOSED',
    entityType: 'document_recall',
    entityId: id,
    summary: `Recall reconciled and closed by ${session.fullName}`,
  });

  return c.json({ recall: updated });
});
