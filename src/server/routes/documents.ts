import { Hono } from 'hono';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { db } from '@/db/client';
import { documents, documentRevisions, documentApprovalReferences, departments } from '@/db/schema';
import { PERMISSIONS } from '@/lib/permissions';
import { recordAuditEvent } from '@/lib/audit';
import { requireAuth, requirePermission } from '../authz';
import { generateApprovalReferenceNumber, E_SIGNATURE_ATTESTATION } from '@/lib/approval-reference';

export const documentRoutes = new Hono();
documentRoutes.use('*', requireAuth);

documentRoutes.get('/', async (c) => {
  const session = c.get('session');
  const rows = await db
    .select()
    .from(documents)
    .where(eq(documents.organizationId, session.organizationId))
    .orderBy(desc(documents.updatedAt));
  return c.json({ documents: rows });
});

documentRoutes.get('/:id', async (c) => {
  const session = c.get('session');
  const id = c.req.param('id');
  const [doc] = await db
    .select()
    .from(documents)
    .where(and(eq(documents.id, id), eq(documents.organizationId, session.organizationId)));
  if (!doc) return c.json({ error: 'Not found' }, 404);

  const revisions = await db
    .select()
    .from(documentRevisions)
    .where(eq(documentRevisions.documentId, id))
    .orderBy(desc(documentRevisions.revisionNumber));

  const revisionIds = revisions.map((r) => r.id);
  const approvalRefs = revisionIds.length
    ? await db
        .select()
        .from(documentApprovalReferences)
        .where(inArray(documentApprovalReferences.documentRevisionId, revisionIds))
        .orderBy(desc(documentApprovalReferences.createdAt))
    : [];
  const latestRefByRevision = new Map<string, (typeof approvalRefs)[number]>();
  for (const ref of approvalRefs) {
    if (!latestRefByRevision.has(ref.documentRevisionId)) latestRefByRevision.set(ref.documentRevisionId, ref);
  }
  const revisionsWithApproval = revisions.map((r) => ({ ...r, approvalReference: latestRefByRevision.get(r.id) ?? null }));

  return c.json({ document: doc, revisions: revisionsWithApproval });
});

// Register a document in the master registry. Works even with no DMS and no
// uploaded file (hasNoFileYet) — per spec §1 "without forcing customers to
// digitize their entire quality system."
documentRoutes.post('/', requirePermission(PERMISSIONS.DOCUMENT_REGISTER), async (c) => {
  const session = c.get('session');
  const body = await c.req.json();

  const [dept] = await db.select().from(departments).where(eq(departments.id, body.departmentId));
  if (!dept) return c.json({ error: 'Unknown department' }, 400);

  const [doc] = await db
    .insert(documents)
    .values({
      organizationId: session.organizationId,
      siteId: body.siteId,
      documentNumber: body.documentNumber,
      title: body.title,
      documentType: body.documentType,
      departmentId: body.departmentId,
      processCategory: body.processCategory ?? null,
      confidentiality: body.confidentiality ?? 'PUBLIC_INTERNAL',
      masterCopyLocation: body.masterCopyLocation ?? null,
      hasNoFileYet: !body.sourceFileProvided,
      createdByUserId: session.userId,
    })
    .returning();

  // Register revision 1 immediately — a document without at least one
  // revision has no approval status and cannot be printed.
  const [revision] = await db
    .insert(documentRevisions)
    .values({
      documentId: doc.id,
      revisionNumber: 1,
      revisionLabel: body.revisionLabel ?? '01',
      approvalStatus: 'DRAFT',
      effectiveDate: body.effectiveDate ?? null,
      reviewDueDate: body.reviewDueDate ?? null,
      changeSummary: 'Initial registration',
      createdByUserId: session.userId,
    })
    .returning();

  await db.update(documents).set({ currentRevisionId: revision.id }).where(eq(documents.id, doc.id));

  if (body.paperApprovalReference) {
    await db.insert(documentApprovalReferences).values({
      documentRevisionId: revision.id,
      // A scanned signature is evidence of a paper approval, NOT an electronic
      // signature — spec §2/§6 explicitly forbid treating these as interchangeable.
      sourceRecordType: 'PAPER_APPROVAL_REFERENCE',
      approvalReferenceNumber: body.paperApprovalReference.referenceNumber ?? null,
      approvedByName: body.paperApprovalReference.approvedByName ?? null,
      approvedDate: body.paperApprovalReference.approvedDate ?? null,
      notes: body.paperApprovalReference.notes ?? null,
      recordedByUserId: session.userId,
    });
  }

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'DOCUMENT_REGISTERED',
    entityType: 'document',
    entityId: doc.id,
    summary: `Registered ${doc.documentNumber} — ${doc.title} (rev ${revision.revisionLabel})`,
    newValue: { documentNumber: doc.documentNumber, revisionLabel: revision.revisionLabel },
  });

  return c.json({ document: doc, revision }, 201);
});

// Approve a document revision. This records a real electronic signature —
// sourceRecordType is explicitly ELECTRONIC_SIGNATURE here, unlike the
// PAPER_APPROVAL_REFERENCE recorded at registration time for a scanned
// paper signature (those two are never treated as interchangeable).
documentRoutes.post('/:id/revisions/:revisionId/approve', requirePermission(PERMISSIONS.DOCUMENT_REVISE), async (c) => {
  const session = c.get('session');
  const documentId = c.req.param('id');
  const revisionId = c.req.param('revisionId');
  const body = await c.req.json().catch(() => ({}));

  const typedName = String(body.signerFullName ?? '').trim();
  if (!typedName) return c.json({ error: 'Type your full name to electronically sign this approval' }, 400);
  if (typedName.toLowerCase() !== session.fullName.trim().toLowerCase()) {
    return c.json({ error: 'The typed name must match your account name exactly to sign' }, 400);
  }

  const [updated] = await db
    .update(documentRevisions)
    .set({ approvalStatus: 'APPROVED', updatedAt: new Date() })
    .where(eq(documentRevisions.id, revisionId))
    .returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);

  const [parentDoc] = await db.select().from(documents).where(eq(documents.id, documentId));
  const approvalReferenceNumber = generateApprovalReferenceNumber();

  await db.insert(documentApprovalReferences).values({
    documentRevisionId: revisionId,
    sourceRecordType: 'ELECTRONIC_SIGNATURE',
    approvalReferenceNumber,
    approvedByName: typedName,
    approvedDate: new Date(),
    notes: E_SIGNATURE_ATTESTATION,
    recordedByUserId: session.userId,
  });

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'REVISION_APPROVED',
    entityType: 'document_revision',
    entityId: revisionId,
    summary: `Revision ${updated.revisionLabel} of ${parentDoc?.documentNumber ?? documentId} approved by ${session.fullName} (e-signed, ref ${approvalReferenceNumber})`,
  });

  return c.json({ revision: updated, approvalReferenceNumber });
});

// Register a new revision — the entry point into Module E recall logic
// lives in routes/recalls.ts (POST /api/recalls), triggered from the UI once
// the new revision is approved and effective.
documentRoutes.post('/:id/revisions', requirePermission(PERMISSIONS.DOCUMENT_REVISE), async (c) => {
  const session = c.get('session');
  const documentId = c.req.param('id');
  const body = await c.req.json();

  const [latest] = await db
    .select()
    .from(documentRevisions)
    .where(eq(documentRevisions.documentId, documentId))
    .orderBy(desc(documentRevisions.revisionNumber))
    .limit(1);

  const nextNumber = (latest?.revisionNumber ?? 0) + 1;
  const [revision] = await db
    .insert(documentRevisions)
    .values({
      documentId,
      revisionNumber: nextNumber,
      revisionLabel: String(nextNumber).padStart(2, '0'),
      approvalStatus: 'DRAFT',
      supersededRevisionId: latest?.id ?? null,
      changeSummary: body.changeSummary ?? null,
      createdByUserId: session.userId,
    })
    .returning();

  const [parentDoc] = await db.select().from(documents).where(eq(documents.id, documentId));

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'REVISION_REGISTERED',
    entityType: 'document_revision',
    entityId: revision.id,
    summary: `New revision ${revision.revisionLabel} registered for document ${parentDoc?.documentNumber ?? documentId}`,
  });

  return c.json({ revision }, 201);
});
