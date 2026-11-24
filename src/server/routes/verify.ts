import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { db } from '@/db/client';
import { controlledCopies, documents, documentRevisions, departments, copyVerifications } from '@/db/schema';
import { getCookie } from 'hono/cookie';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';
import { recordAuditEvent } from '@/lib/audit';

export const verifyRoutes = new Hono();

/**
 * Module D — QR verification. Deliberately NOT behind requireAuth: a
 * production-floor employee scanning a copy on the shop floor must get a
 * verdict even without signing in. Scanning NEVER unlocks the underlying
 * document — only copy metadata and a validity verdict are returned, per
 * spec §3 ("Scanning must NOT automatically mean ... authorized to view the
 * full document").
 */
verifyRoutes.get('/:qrToken', async (c) => {
  const qrToken = c.req.param('qrToken');
  const [copy] = await db.select().from(controlledCopies).where(eq(controlledCopies.qrToken, qrToken));

  if (!copy) {
    return c.json({ verdict: 'GREY', message: 'Unknown or unregistered copy.' });
  }

  const [doc] = await db.select().from(documents).where(eq(documents.id, copy.documentId));
  const [revision] = await db.select().from(documentRevisions).where(eq(documentRevisions.id, copy.documentRevisionId));
  const [dept] = copy.issuedToDepartmentId
    ? await db.select().from(departments).where(eq(departments.id, copy.issuedToDepartmentId))
    : [undefined];

  const [lastVerification] = await db
    .select()
    .from(copyVerifications)
    .where(eq(copyVerifications.controlledCopyId, copy.id))
    .orderBy(desc(copyVerifications.createdAt))
    .limit(1);

  let verdict: 'GREEN' | 'AMBER' | 'RED' | 'GREY';
  if (['SUPERSEDED', 'EXPIRED', 'RECALL_PENDING', 'LOST', 'DAMAGED', 'DESTROYED'].includes(copy.status)) {
    verdict = 'RED';
  } else if (['ISSUED', 'PRINTED'].includes(copy.status)) {
    verdict = 'AMBER'; // issued but not yet acknowledged/verified as in-place
  } else if (copy.status === 'ACTIVE') {
    verdict = 'GREEN';
  } else {
    verdict = 'AMBER';
  }

  return c.json({
    verdict,
    documentTitle: doc?.title,
    documentNumber: doc?.documentNumber,
    revisionLabel: revision?.revisionLabel,
    copyIdentifier: copy.copyIdentifier,
    status: copy.status,
    marking: copy.marking,
    authorizedLocation: copy.destinationLocation,
    issuedToDepartment: dept?.name ?? null,
    lastVerificationAt: lastVerification?.createdAt ?? null,
    serverTimeUtc: new Date().toISOString(),
  });
});

// Record a scan event — supports online and offline-then-sync scans.
// Offline scans must carry the device's lastSyncAt so the UI can be explicit
// that validity shown offline is only as current as that sync.
verifyRoutes.post('/:qrToken/scan', async (c) => {
  const qrToken = c.req.param('qrToken');
  const body = await c.req.json().catch(() => ({}));

  const [copy] = await db.select().from(controlledCopies).where(eq(controlledCopies.qrToken, qrToken));
  if (!copy) return c.json({ error: 'Unknown copy' }, 404);

  let scannedByUserId: string | null = null;
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const session = await verifySession(token);
    if (session) scannedByUserId = session.userId;
  }

  const verdict = body.verdict ?? 'GREY';

  const [row] = await db
    .insert(copyVerifications)
    .values({
      controlledCopyId: copy.id,
      scannedByUserId,
      scanVerdict: verdict,
      scannedOffline: !!body.scannedOffline,
      lastSyncAt: body.lastSyncAt ? new Date(body.lastSyncAt) : new Date(),
      locationAtScan: body.locationAtScan ?? null,
    })
    .returning();

  await recordAuditEvent({
    organizationId: copy.organizationId,
    userId: scannedByUserId,
    eventType: 'QR_SCANNED',
    entityType: 'controlled_copy',
    entityId: copy.id,
    summary: `${copy.copyIdentifier} scanned — verdict ${verdict}${body.scannedOffline ? ' (offline)' : ''}`,
  });

  return c.json({ verification: row });
});
