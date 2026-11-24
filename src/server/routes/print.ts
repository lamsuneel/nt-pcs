import { Hono } from 'hono';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/client';
import {
  printRequests,
  printApprovals,
  controlledCopies,
  documents,
  documentRevisions,
} from '@/db/schema';
import { PERMISSIONS } from '@/lib/permissions';
import { recordAuditEvent } from '@/lib/audit';
import { buildCopyIdentifier, generateQrToken } from '@/lib/copy-id';
import { buildControlledCopyPdf } from '@/lib/pdf';
import { storage } from '@/lib/storage';
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
  return c.json({ printRequests: rows });
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

  await db.insert(printApprovals).values({
    printRequestId: id,
    approverUserId: session.userId,
    decision: 'APPROVED',
    comments: body.comments ?? null,
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
    summary: `Print request approved by ${session.fullName}`,
  });

  return c.json({ printRequest: updated });
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
        printOutcome: 'SUCCEEDED',
        destinationLocation: reqRow.destinationLocation,
        issuedToDepartmentId: reqRow.departmentId,
        printedAt: new Date(),
      })
      .returning();
    createdCopies.push(copy);
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
