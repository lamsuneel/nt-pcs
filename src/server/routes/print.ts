import { Hono } from 'hono';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  printRequests,
  printApprovals,
  controlledCopies,
  documents,
  documentRevisions,
  overlayProfiles,
} from '@/db/schema';
import { PERMISSIONS } from '@/lib/permissions';
import { recordAuditEvent } from '@/lib/audit';
import { buildCopyIdentifier, generateQrToken } from '@/lib/copy-id';
import { generateApprovalReferenceNumber, E_SIGNATURE_ATTESTATION } from '@/lib/approval-reference';
import { buildControlledCopyPdf } from '@/lib/pdf';
import { storage } from '@/lib/storage';
import { enqueuePrintJob } from '@/lib/print-queue/dispatch';
import { requireAuth, requirePermission } from '../authz';

export const printRoutes = new Hono();
printRoutes.use('*', requireAuth);

printRoutes.get('/', async (c) => {
  const session = c.get('session');
  const rows = await db
    .select()
    .from(printRequests)
    .where(eq(printRequests.organizationId, session.organizationId))
    .orderBy(desc(printRequests.createdAt));

  const ids = rows.map((r) => r.id);
  const approvals = ids.length
    ? await db.select().from(printApprovals).where(inArray(printApprovals.printRequestId, ids)).orderBy(desc(printApprovals.decidedAt))
    : [];
  const latestByRequest = new Map<string, (typeof approvals)[number]>();
  for (const a of approvals) {
    if (!latestByRequest.has(a.printRequestId)) latestByRequest.set(a.printRequestId, a);
  }

  const withApprovals = rows.map((r) => ({ ...r, latestApproval: latestByRequest.get(r.id) ?? null }));
  return c.json({ printRequests: withApprovals });
});

printRoutes.post('/', requirePermission(PERMISSIONS.PRINT_REQUEST), async (c) => {
  const session = c.get('session');
  const body = await c.req.json();

  const [doc] = await db.select().from(documents).where(eq(documents.id, body.documentId));
  if (!doc) return c.json({ error: 'Unknown document' }, 400);
  if (!doc.currentRevisionId) return c.json({ error: 'Document has no revision yet' }, 400);

  const [revision] = await db.select().from(documentRevisions).where(eq(documentRevisions.id, doc.currentRevisionId));
  if (!revision || revision.approvalStatus !== 'APPROVED') {
    return c.json({ error: 'Only an approved revision can be printed under control' }, 400);
  }

  const [req_] = await db
    .insert(printRequests)
    .values({
      organizationId: session.organizationId,
      documentId: doc.id,
      documentRevisionId: revision.id,
      numberOfCopies: body.numberOfCopies,
      requestingUserId: session.userId,
      departmentId: body.departmentId,
      destinationLocation: body.destinationLocation,
      intendedPurpose: body.intendedPurpose ?? null,
      reasonForPrinting: body.reasonForPrinting ?? null,
      printer: body.printer ?? null,
      classification: body.classification ?? 'CONTROLLED',
      reviewDueDate: revision.reviewDueDate ?? null,
    })
    .returning();

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'PRINT_REQUESTED',
    entityType: 'print_request',
    entityId: req_.id,
    summary: `Requested ${req_.numberOfCopies} controlled copies of ${doc.documentNumber} rev ${revision.revisionLabel}`,
  });

  return c.json({ printRequest: req_ }, 201);
});

printRoutes.post('/:id/approve', requirePermission(PERMISSIONS.PRINT_APPROVE), async (c) => {
  const session = c.get('session');
  const id = c.req.param('id');
  const body = await c.req.json().catch(() => ({}));

  const [existing] = await db.select().from(printRequests).where(eq(printRequests.id, id));
  if (!existing) return c.json({ error: 'Not found' }, 404);
  if (existing.status !== 'REQUESTED') return c.json({ error: `Cannot approve a request in status ${existing.status}` }, 400);

  // Electronic signature: the approver must re-type their own full name to
  // confirm. It must match the name on their account — this isn't a free-text
  // field, it's standing in for a handwritten signature.
  const typedName = String(body.signerFullName ?? '').trim();
  if (!typedName) return c.json({ error: 'Type your full name to electronically sign this approval' }, 400);
  if (typedName.toLowerCase() !== session.fullName.trim().toLowerCase()) {
    return c.json({ error: 'The typed name must match your account name exactly to sign' }, 400);
  }

  const approvalReferenceNumber = generateApprovalReferenceNumber();

  await db.insert(printApprovals).values({
    printRequestId: id,
    approverUserId: session.userId,
    decision: 'APPROVED',
    comments: body.comments ?? null,
    approvalReferenceNumber,
    signerFullName: typedName,
    attestationStatement: E_SIGNATURE_ATTESTATION,
  });

  const [updated] = await db
    .update(printRequests)
    .set({ status: 'APPROVED', updatedAt: new Date() })
    .where(eq(printRequests.id, id))
    .returning();

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'PRINT_APPROVED',
    entityType: 'print_request',
    entityId: id,
    summary: `Print request approved by ${session.fullName} (e-signed, ref ${approvalReferenceNumber})`,
  });

  return c.json({ printRequest: updated, approvalReferenceNumber });
});

printRoutes.post('/:id/reject', requirePermission(PERMISSIONS.PRINT_APPROVE), async (c) => {
  const session = c.get('session');
  const id = c.req.param('id');
  const body = await c.req.json();

  const [existing] = await db.select().from(printRequests).where(eq(printRequests.id, id));
  if (!existing) return c.json({ error: 'Not found' }, 404);

  await db.insert(printApprovals).values({
    printRequestId: id,
    approverUserId: session.userId,
    decision: 'REJECTED',
    comments: body.comments ?? null,
  });

  const [updated] = await db
    .update(printRequests)
    .set({ status: 'REJECTED', updatedAt: new Date() })
    .where(eq(printRequests.id, id))
    .returning();

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'PRINT_REJECTED',
    entityType: 'print_request',
    entityId: id,
    summary: `Print request rejected by ${session.fullName}: ${body.comments ?? 'no reason given'}`,
  });

  return c.json({ printRequest: updated });
});

// Epic E6 — Print Review: the Document Controller previews exactly what
// will print (logo, stamp fields, QR footer) before issuing anything. This
// renders on demand, stores nothing, and is watermarked so it can never be
// mistaken for an actual controlled print.
printRoutes.get('/:id/preview', requirePermission(PERMISSIONS.PRINT_ISSUE), async (c) => {
  const id = c.req.param('id');

  const [reqRow] = await db.select().from(printRequests).where(eq(printRequests.id, id));
  if (!reqRow) return c.json({ error: 'Not found' }, 404);

  const [doc] = await db.select().from(documents).where(eq(documents.id, reqRow.documentId));
  const [revision] = await db.select().from(documentRevisions).where(eq(documentRevisions.id, reqRow.documentRevisionId));
  if (!doc || !revision) return c.json({ error: 'Document/revision missing' }, 400);

  const overlayProfile = await resolveOverlayProfile(doc.overlayProfileId);
  const sourceBytes = doc.sourceFileKey ? await storage.getObject(doc.sourceFileKey) : null;
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const markingLabel = reqRow.classification === 'CONTROLLED' ? 'CONTROLLED COPY' : 'UNCONTROLLED REFERENCE COPY';

  const pdfBytes = await buildControlledCopyPdf({
    documentNumber: doc.documentNumber,
    documentTitle: doc.title,
    revisionLabel: revision.revisionLabel,
    copyIdentifier: `${doc.documentNumber}-REV${revision.revisionLabel}-PREVIEW`,
    markingLabel,
    issuedToLabel: reqRow.destinationLocation,
    printedDateLabel: new Date().toISOString().slice(0, 10),
    verifyUrl: `${baseUrl}/verify/preview`,
    sourcePdfBytes: sourceBytes ?? undefined,
    overlayProfile,
    previewOnly: true,
  });

  return new Response(pdfBytes, {
    headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': 'inline; filename="preview.pdf"' },
  });
});

async function resolveOverlayProfile(overlayProfileId: string | null) {
  if (!overlayProfileId) return null;
  const [profile] = await db.select().from(overlayProfiles).where(eq(overlayProfiles.id, overlayProfileId));
  if (!profile) return null;
  const logoBytes = profile.logoFileKey ? await storage.getObject(profile.logoFileKey) : null;
  return {
    logoBytes: logoBytes ?? undefined,
    stampFields: (profile.stampFields as any[]) ?? [],
  };
}

// Document Controller issues the approved request: generates N PDFs with
// distinct cryptographically unpredictable copy IDs + QR codes, server-side.
// A screenshot/browser-print of the source cannot substitute for this path.
printRoutes.post('/:id/issue', requirePermission(PERMISSIONS.PRINT_ISSUE), async (c) => {
  const session = c.get('session');
  const id = c.req.param('id');

  const [reqRow] = await db.select().from(printRequests).where(eq(printRequests.id, id));
  if (!reqRow) return c.json({ error: 'Not found' }, 404);
  if (reqRow.status !== 'APPROVED') return c.json({ error: `Cannot issue a request in status ${reqRow.status}` }, 400);

  const [doc] = await db.select().from(documents).where(eq(documents.id, reqRow.documentId));
  const [revision] = await db.select().from(documentRevisions).where(eq(documentRevisions.id, reqRow.documentRevisionId));
  if (!doc || !revision) return c.json({ error: 'Document/revision missing' }, 400);

  const sourceBytes = doc.sourceFileKey ? await storage.getObject(doc.sourceFileKey) : null;
  const overlayProfile = await resolveOverlayProfile(doc.overlayProfileId);
  const baseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
  const markingLabel = reqRow.classification === 'CONTROLLED' ? 'CONTROLLED COPY' : 'UNCONTROLLED REFERENCE COPY';

  const createdCopies = [];
  for (let seq = 1; seq <= reqRow.numberOfCopies; seq++) {
    const qrToken = generateQrToken();
    const copyIdentifier = buildCopyIdentifier(doc.documentNumber, revision.revisionLabel, seq);

    const pdfBytes = await buildControlledCopyPdf({
      documentNumber: doc.documentNumber,
      documentTitle: doc.title,
      revisionLabel: revision.revisionLabel,
      copyIdentifier,
      markingLabel,
      issuedToLabel: reqRow.destinationLocation,
      printedDateLabel: new Date().toISOString().slice(0, 10),
      verifyUrl: `${baseUrl}/verify/${qrToken}`,
      sourcePdfBytes: sourceBytes ?? undefined,
      overlayProfile,
    });

    const fileKey = `copies/${doc.organizationId}/${copyIdentifier}.pdf`;
    await storage.putObject(fileKey, pdfBytes, 'application/pdf');

    const [copy] = await db
      .insert(controlledCopies)
      .values({
        organizationId: session.organizationId,
        copyIdentifier,
        printRequestId: id,
        documentId: doc.id,
        documentRevisionId: revision.id,
        copySequence: seq,
        marking: reqRow.classification === 'CONTROLLED' ? 'CONTROLLED_COPY' : 'UNCONTROLLED_REFERENCE_COPY',
        qrToken,
        pdfFileKey: fileKey,
        status: 'PRINTED',
        // Outcome is no longer assumed SUCCEEDED here — the print job just
        // queued below is what actually dispatches to the printer and
        // reports back pass/fail/partial (F4/F7/F9). Left null until then.
        printOutcome: null,
        destinationLocation: reqRow.destinationLocation,
        issuedToDepartmentId: reqRow.departmentId,
        printedAt: new Date(),
      })
      .returning();
    createdCopies.push(copy);

    // Epic F — hand off to the per-printer queue for actual dispatch. If no
    // printer is registered yet for this org, don't fail the whole issue
    // flow (the PDF + copy record are still the source of truth) — just
    // note it so the Document Controller can register one and retry.
    try {
      await enqueuePrintJob({
        organizationId: session.organizationId,
        printRequestId: id,
        copyId: copy.id,
        printerId: reqRow.printerId,
        requestedPages: copy.pageCount ?? 1,
        priority: reqRow.isUrgent ? 'URGENT' : 'STANDARD',
        source: (reqRow.source as any) ?? 'NATIVE',
        sourceRef: reqRow.sourceRef ?? undefined,
      });
    } catch (err) {
      console.error(`[print.issue] could not enqueue print job for copy ${copy.id}:`, err);
    }
  }

  const [updatedReq] = await db
    .update(printRequests)
    .set({ status: 'ISSUED', updatedAt: new Date() })
    .where(eq(printRequests.id, id))
    .returning();

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'PRINT_ISSUED',
    entityType: 'print_request',
    entityId: id,
    summary: `${createdCopies.length} controlled copies generated for ${doc.documentNumber} rev ${revision.revisionLabel}`,
    newValue: { copyIdentifiers: createdCopies.map((cp) => cp.copyIdentifier) },
  });

  return c.json({ printRequest: updatedReq, copies: createdCopies });
});

// Record a print outcome explicitly (e.g. printer jam, out of paper, reprint)
// — matches the "confirm success/failure" step common in comparable products.
printRoutes.post('/copies/:copyId/outcome', requirePermission(PERMISSIONS.PRINT_ISSUE), async (c) => {
  const session = c.get('session');
  const copyId = c.req.param('copyId');
  const body = await c.req.json<{ outcome: 'SUCCEEDED' | 'FAILED'; note?: string }>();

  const [updated] = await db
    .update(controlledCopies)
    .set({ printOutcome: body.outcome, printOutcomeNote: body.note ?? null, updatedAt: new Date() })
    .where(eq(controlledCopies.id, copyId))
    .returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'PRINT_OUTCOME_RECORDED',
    entityType: 'controlled_copy',
    entityId: copyId,
    summary: `Print outcome for ${updated.copyIdentifier}: ${body.outcome}${body.note ? ' — ' + body.note : ''}`,
  });

  return c.json({ copy: updated });
});
