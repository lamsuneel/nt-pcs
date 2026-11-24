import { Hono } from 'hono';
import { desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  documents,
  documentRevisions,
  controlledCopies,
  printRequests,
  documentRecalls,
  recallItems,
  destructionConfirmations,
  auditEvents,
  copyVerifications,
} from '@/db/schema';
import { PERMISSIONS } from '@/lib/permissions';
import { requireAuth, requirePermission } from '../authz';

export const reportRoutes = new Hono();
reportRoutes.use('*', requireAuth);
reportRoutes.use('*', requirePermission(PERMISSIONS.AUDIT_READ));

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
}

const REPORTS: Record<string, (orgId: string) => Promise<Record<string, unknown>[]>> = {
  'master-register': async (orgId) =>
    db.select().from(documents).where(eq(documents.organizationId, orgId)).orderBy(desc(documents.createdAt)),
  'copy-register': async (orgId) =>
    db.select().from(controlledCopies).where(eq(controlledCopies.organizationId, orgId)).orderBy(desc(controlledCopies.createdAt)),
  'print-history': async (orgId) =>
    db.select().from(printRequests).where(eq(printRequests.organizationId, orgId)).orderBy(desc(printRequests.createdAt)),
  'recall-register': async (orgId) =>
    db.select().from(documentRecalls).where(eq(documentRecalls.organizationId, orgId)).orderBy(desc(documentRecalls.initiatedAt)),
  'destruction-register': async (_orgId) =>
    db.select().from(destructionConfirmations).orderBy(desc(destructionConfirmations.destructionDate)),
  'qr-scan-history': async (_orgId) => db.select().from(copyVerifications).orderBy(desc(copyVerifications.createdAt)),
  'audit-trail': async (orgId) =>
    db.select().from(auditEvents).where(eq(auditEvents.organizationId, orgId)).orderBy(desc(auditEvents.createdAt)).limit(2000),
};

reportRoutes.get('/:type', async (c) => {
  const session = c.get('session');
  const type = c.req.param('type');
  const fn = REPORTS[type];
  if (!fn) return c.json({ error: `Unknown report type. Available: ${Object.keys(REPORTS).join(', ')}` }, 400);

  const rows = await fn(session.organizationId);
  const format = c.req.query('format') ?? 'json';

  if (format === 'csv') {
    const csv = toCsv(rows as Record<string, unknown>[]);
    return c.body(csv, 200, {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="${type}.csv"`,
    });
  }

  return c.json({ report: type, rows });
});
