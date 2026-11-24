import { Hono } from 'hono';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db/client';
import { documents, controlledCopies, printRequests, recallItems, documentRecalls } from '@/db/schema';
import { requireAuth } from '../authz';

export const dashboardRoutes = new Hono();
dashboardRoutes.use('*', requireAuth);

dashboardRoutes.get('/kpis', async (c) => {
  const session = c.get('session');
  const orgId = session.organizationId;

  const [{ count: totalDocs }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(documents)
    .where(eq(documents.organizationId, orgId));

  const copyRows = await db.select().from(controlledCopies).where(eq(controlledCopies.organizationId, orgId));
  const activeCopies = copyRows.filter((r) => ['ISSUED', 'ACKNOWLEDGED', 'ACTIVE'].includes(r.status)).length;
  const lostOrDamaged = copyRows.filter((r) => ['LOST', 'DAMAGED'].includes(r.status)).length;
  const awaitingAck = copyRows.filter((r) => r.status === 'ISSUED').length;

  const printRows = await db.select().from(printRequests).where(eq(printRequests.organizationId, orgId));
  const pendingApprovals = printRows.filter((r) => r.status === 'REQUESTED').length;

  const recallRows = await db.select().from(documentRecalls).where(eq(documentRecalls.organizationId, orgId));
  const pendingRecalls = recallRows.filter((r) => r.status === 'INITIATED' || r.status === 'PARTIALLY_RECONCILED').length;

  const distByDept: Record<string, number> = {};
  for (const r of copyRows) {
    if (r.issuedToDepartmentId) distByDept[r.issuedToDepartmentId] = (distByDept[r.issuedToDepartmentId] ?? 0) + 1;
  }

  return c.json({
    totalRegisteredDocuments: Number(totalDocs),
    activeControlledCopies: activeCopies,
    pendingPrintApprovals: pendingApprovals,
    copiesAwaitingAcknowledgement: awaitingAck,
    pendingRecalls,
    lostOrDamagedCopies: lostOrDamaged,
    distributionByDepartment: distByDept,
  });
});
