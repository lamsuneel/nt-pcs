import { Hono } from 'hono';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { customAlphabet } from 'nanoid';
import { db } from '@/db/client';
import { documents, documentRevisions, documentApprovalReferences, departments } from '@/db/schema';
import { PERMISSIONS } from '@/lib/permissions';
import { recordAuditEvent } from '@/lib/audit';
import { requireAuth, requirePermission } from '../authz';
import { generateApprovalReferenceNumber, E_SIGNATURE_ATTESTATION } from '@/lib/approval-reference';

const pendingDocNumberSuffix = customAlphabet('0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ', 6);

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

// Print Review (Epic E) + inbound print-trigger mapping (Epic H): assign an
// overlay profile and/or an external-system reference to a document. Also
// where a Document Controller reclassifies a PENDING_CLASSIFICATION
// document (see POST /from-drive-request below) with its real document
// number/type once reviewed — that's the only path that may change
// documentNumber/documentType/title, and it's still gated on
// DOCUMENT_REGISTER the same as creating a document from scratch.
documentRoutes.patch('/:id', requirePermission(PERMISSIONS.DOCUMENT_REGISTER), async (c) => {
  const session = c.get('session');
  const id = c.req.param('id');
  const body = await c.req.json();

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if ('overlayProfileId' in body) update.overlayProfileId = body.overlayProfileId || null;
  if ('externalProvider' in body) update.externalProvider = body.externalProvider || null;
  if ('externalRef' in body) update.externalRef = body.externalRef || null;
  if ('documentNumber' in body && body.documentNumber) update.documentNumber = body.documentNumber;
  if ('documentType' in body && body.documentType) update.documentType = body.documentType;
  if ('title' in body && body.title) update.title = body.title;
  if ('departmentId' in body && body.departmentId) update.departmentId = body.departmentId;

  const [updated] = await db
    .update(documents)
    .set(update)
    .where(and(eq(documents.id, id), eq(documents.organizationId, session.organizationId)))
    .returning();
  if (!updated) return c.json({ error: 'Not found' }, 404);

  if ('documentNumber' in body || 'documentType' in body) {
    await recordAuditEvent({
      organizationId: session.organizationId,
      userId: session.userId,
      eventType: 'DOCUMENT_RECLASSIFIED',
      entityType: 'document',
      entityId: updated.id,
      summary: `${updated.documentNumber} reclassified by ${session.fullName}`,
    });
  }

  return c.json({ document: updated });
});

// Epic H follow-up — a Requestor picking an unlinked Drive file at print-
// request time gets an immediate tracking ID for that file's lifecycle,
// instead of being blocked until a Document Controller pre-registers it.
// This creates a real document + revision 1 in DRAFT (documentType
// PENDING_CLASSIFICATION) so it shows up in the Document Register right
// away for review — but a DRAFT document still cannot be selected for an
// actual print (see print.ts POST / which requires the current revision to
// be APPROVED), so the compliance gate is unchanged. Idempotent: calling
// this twice for the same externalRef returns the existing record rather
// than creating a duplicate.
documentRoutes.post('/from-drive-request', requirePermission(PERMISSIONS.PRINT_REQUEST), async (c) => {
  const session = c.get('session');
  const body = await c.req.json().catch(() => ({}));
  const externalRef = String(body.externalRef ?? '').trim();
  const name = String(body.name ?? '').trim();
  if (!externalRef || !name) return c.json({ error: 'externalRef and name are required' }, 400);
  if (!session.siteId || !session.departmentId) {
    return c.json({ error: 'Your account has no site/department assigned — ask an admin to set one before requesting a new document from Drive.' }, 400);
  }

  const [existing] = await db
    .select()
    .from(documents)
    .where(
      and(
        eq(documents.organizationId, session.organizationId),
        eq(documents.externalProvider, 'GOOGLE_DRIVE'),
        eq(documents.externalRef, externalRef)
      )
    )
    .limit(1);
  if (existing) return c.json({ document: existing, created: false });

  const [doc] = await db
    .insert(documents)
    .values({
      organizationId: session.organizationId,
      siteId: session.siteId,
      documentNumber: `PEND-${pendingDocNumberSuffix()}`,
      title: name,
      documentType: 'PENDING_CLASSIFICATION',
      departmentId: session.departmentId,
      hasNoFileYet: false,
      externalProvider: 'GOOGLE_DRIVE',
      externalRef,
      createdByUserId: session.userId,
    })
    .returning();

  const [revision] = await db
    .insert(documentRevisions)
    .values({
      documentId: doc.id,
      revisionNumber: 1,
      revisionLabel: '01',
      approvalStatus: 'DRAFT',
      changeSummary: `Auto-created by ${session.fullName} when requesting a print from Google Drive — pending Document Controller review.`,
      createdByUserId: session.userId,
    })
    .returning();

  await db.update(documents).set({ currentRevisionId: revision.id }).where(eq(documents.id, doc.id));

  await recordAuditEvent({
    organizationId: session.organizationId,
    userId: session.userId,
    eventType: 'DOCUMENT_AUTO_REGISTERED_FROM_REQUEST',
    entityType: 'document',
    entityId: doc.id,
    summary: `${doc.documentNumber} — "${doc.title}" auto-registered (tracking ID) from a Google Drive print request by ${session.fullName}; awaiting Document Controller classification and approval.`,
    newValue: { externalRef, revisionId: revision.id },
  });

  return c.json({ document: { ...doc, currentRevisionId: revision.id }, created: true }, 201);
});

// Register a document in the master registry. Works even with no DMS and no
// uploaded file (hasNoFileYet) — per spec §1 "without forcing customers to
// digitize their entire quality system."
documentRoutes.post('/', requirePermission(PERMISSIONS.DOCUMENT_REGISTER), async (c) => {
  const session = c.get('session');
  const body = await c.req.json();

  const [dept] = await db.select().from(departments).where(eq(departments.id, body.departmentId));
  if (!dept) return c.json({ error: 'Unknown department' }, 400);

  // A paper approval reference is only real evidence if it actually names
  // who approved it — an empty/unchecked form shouldn't be able to produce
  // an APPROVED document. If it's genuine, this document is documenting
  // something *already* approved outside the system (on paper, or already
  // signed off in Drive) — so revision 1 starts APPROVED, not DRAFT, and is
  // immediately selectable in Request Controlled Print. Without it, revision
  // 1 is a real new DRAFT that still needs to go through approval here.
  const hasRealApprovalEvidence = !!body.paperApprovalReference?.approvedByName?.trim();

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
      externalProvider: body.externalProvider ?? null,
      externalRef: body.externalRef ?? null,
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
      approvalStatus: hasRealApprovalEvidence ? 'APPROVED' : 'DRAFT',
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
    eventType: hasRealApprovalEvidence ? 'DOCUMENT_REGISTERED_APPROVED' : 'DOCUMENT_REGISTERED',
    entityType: 'document',
    entityId: doc.id,
    summary: `Registered ${doc.documentNumber} — ${doc.title} (rev ${revision.revisionLabel}, ${revision.approvalStatus})`,
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
