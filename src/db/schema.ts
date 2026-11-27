import {
  pgTable,
  uuid,
  text,
  varchar,
  timestamp,
  boolean,
  integer,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import { sql } from 'drizzle-orm';

// ============================================================
// ENUMS
// ============================================================

export const roleNameEnum = pgEnum('role_name', [
  'SYSTEM_ADMIN',
  'QA_HEAD',
  'DOCUMENT_CONTROLLER',
  'QA_MANAGER',
  'DEPARTMENT_HEAD',
  'EMPLOYEE',
  'AUDITOR',
]);

export const documentTypeEnum = pgEnum('document_type', [
  'SOP',
  'WI',
  'BMR',
  'BPR',
  'STP',
  'SPECIFICATION',
  'FORMAT_CHECKLIST',
  'EQUIPMENT_SOP',
  'CLEANING_PROCEDURE',
  'CALIBRATION_PROCEDURE',
  'SAFETY_PROCEDURE',
  'QUALITY_MANUAL',
  // Set only by the auto-create-on-request flow (Epic H follow-up): a
  // Requestor picked a Drive file with no existing document record, so one
  // was created on the spot to give it an immediate tracking ID. A Document
  // Controller is expected to reclassify it with a real document type and
  // proper document number during review — this value should never persist
  // past that point.
  'PENDING_CLASSIFICATION',
]);

export const approvalStatusEnum = pgEnum('approval_status', [
  'DRAFT',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'OBSOLETE',
]);

export const confidentialityEnum = pgEnum('confidentiality', [
  'PUBLIC_INTERNAL',
  'CONFIDENTIAL',
  'RESTRICTED',
]);

export const printClassificationEnum = pgEnum('print_classification', [
  'CONTROLLED',
  'UNCONTROLLED_REFERENCE',
]);

export const printRequestStatusEnum = pgEnum('print_request_status', [
  'REQUESTED',
  'APPROVED',
  'REJECTED',
  'ISSUED',
  'CANCELLED',
]);

export const copyStatusEnum = pgEnum('copy_status', [
  'REQUESTED',
  'APPROVED',
  'PRINTED',
  'ISSUED',
  'ACKNOWLEDGED',
  'ACTIVE',
  'RECALL_PENDING',
  'RETURNED',
  'DESTROYED',
  'LOST',
  'DAMAGED',
  'EXPIRED',
  'SUPERSEDED',
]);

export const copyMarkingEnum = pgEnum('copy_marking', [
  'CONTROLLED_COPY',
  'UNCONTROLLED_REFERENCE_COPY',
  'MASTER_COPY',
  'SUPERSEDED_COPY',
]);

export const scanVerdictEnum = pgEnum('scan_verdict', ['GREEN', 'AMBER', 'RED', 'GREY']);

export const recallStatusEnum = pgEnum('recall_status', [
  'INITIATED',
  'PARTIALLY_RECONCILED',
  'RECONCILED',
  'CLOSED_WITH_EXCEPTION',
]);

export const recallItemStatusEnum = pgEnum('recall_item_status', [
  'RECALL_INITIATED',
  'RECALL_ACKNOWLEDGED',
  'PHYSICALLY_RETRIEVED',
  'DESTRUCTION_CONFIRMED',
  'OUTSTANDING',
  'LOST_INVESTIGATION',
  'EXCEPTION_APPROVED',
]);

export const exceptionStatusEnum = pgEnum('exception_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

export const sourceRecordTypeEnum = pgEnum('source_record_type', [
  'PAPER_APPROVAL_REFERENCE',
  'ELECTRONIC_SIGNATURE',
  'ELECTRONIC_REGULATED_RECORD',
]);

// MVP pillars: Print Management (printers/printJobs), Print Review
// (overlayProfiles), Integration (printJobSourceEnum), minimal Request ->
// Controller flow (printRequests.printerId/isUrgent/source* below).
export const printerStatusEnum = pgEnum('printer_status', ['ACTIVE', 'PAUSED', 'CIRCUIT_OPEN']);

export const printJobStatusEnum = pgEnum('print_job_status', [
  'QUEUED',
  'DISPATCHED',
  'CONFIRMED',
  'PARTIAL',
  'FAILED',
  'DEAD_LETTER',
]);

export const printJobPriorityEnum = pgEnum('print_job_priority', ['STANDARD', 'URGENT']);

// NATIVE = submitted from inside PrintAssure's own UI. The rest are inbound
// print-trigger API sources (Epic H) — GOOGLE_DRIVE is the adapter built and
// tested first; SHAREPOINT is the prioritized real target, wired to the same
// adapter contract once a Microsoft 365 developer sandbox is available.
export const printJobSourceEnum = pgEnum('print_job_source', [
  'NATIVE',
  'GOOGLE_DRIVE',
  'SHAREPOINT',
  'MASTERCONTROL',
  'VEEVA',
]);

// ============================================================
// TENANCY / ORG STRUCTURE
// ============================================================

export const organizations = pgTable('organizations', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: varchar('slug', { length: 100 }).notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  slugUnique: uniqueIndex('organizations_slug_unique').on(t.slug),
}));

export const sites = pgTable('sites', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  address: text('address'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgCodeUnique: uniqueIndex('sites_org_code_unique').on(t.organizationId, t.code),
  orgIdx: index('sites_org_idx').on(t.organizationId),
}));

export const departments = pgTable('departments', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  siteId: uuid('site_id').notNull().references(() => sites.id),
  name: text('name').notNull(),
  code: varchar('code', { length: 50 }).notNull(),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  siteCodeUnique: uniqueIndex('departments_site_code_unique').on(t.siteId, t.code),
  siteIdx: index('departments_site_idx').on(t.siteId),
}));

// ============================================================
// USERS / ROLES / PERMISSIONS
// ============================================================

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  siteId: uuid('site_id').references(() => sites.id),
  departmentId: uuid('department_id').references(() => departments.id),
  fullName: text('full_name').notNull(),
  email: varchar('email', { length: 255 }).notNull(),
  passwordHash: text('password_hash').notNull(),
  employeeCode: varchar('employee_code', { length: 50 }),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgEmailUnique: uniqueIndex('users_org_email_unique').on(t.organizationId, t.email),
  orgIdx: index('users_org_idx').on(t.organizationId),
}));

export const roles = pgTable('roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: roleNameEnum('name').notNull(),
  description: text('description'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgNameUnique: uniqueIndex('roles_org_name_unique').on(t.organizationId, t.name),
}));

export const permissions = pgTable('permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  description: text('description'),
});

export const userRoles = pgTable('user_roles', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  roleId: uuid('role_id').notNull().references(() => roles.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userRoleUnique: uniqueIndex('user_roles_unique').on(t.userId, t.roleId),
}));

export const rolePermissions = pgTable('role_permissions', {
  id: uuid('id').primaryKey().defaultRandom(),
  roleId: uuid('role_id').notNull().references(() => roles.id),
  permissionId: uuid('permission_id').notNull().references(() => permissions.id),
}, (t) => ({
  rolePermUnique: uniqueIndex('role_permissions_unique').on(t.roleId, t.permissionId),
}));

// ============================================================
// MODULE A: DOCUMENT MASTER REGISTRY
// ============================================================

export const documents = pgTable('documents', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  siteId: uuid('site_id').notNull().references(() => sites.id),
  documentNumber: varchar('document_number', { length: 100 }).notNull(),
  title: text('title').notNull(),
  documentType: documentTypeEnum('document_type').notNull(),
  departmentId: uuid('department_id').notNull().references(() => departments.id),
  processCategory: varchar('process_category', { length: 150 }),
  ownerUserId: uuid('owner_user_id').references(() => users.id),
  applicableEquipment: text('applicable_equipment'),
  confidentiality: confidentialityEnum('confidentiality').notNull().default('PUBLIC_INTERNAL'),
  masterCopyLocation: text('master_copy_location'),
  sourceFileKey: text('source_file_key'),
  scannedFileKey: text('scanned_file_key'),
  hasNoFileYet: boolean('has_no_file_yet').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  currentRevisionId: uuid('current_revision_id'),
  // Print Review (Epic E): which overlay profile (logo + stamp fields) is
  // used when this document is printed. Assigned at registration time, not
  // resolved at print time — avoids the runtime profile-matching bottleneck.
  overlayProfileId: uuid('overlay_profile_id'),
  // Epic H — inbound print-trigger mapping: which external system's item
  // this document corresponds to, so a Google Drive / SharePoint / etc.
  // webhook can resolve "print this" back to an internal document+revision
  // without a runtime search. Set once at registration, same rationale as
  // overlayProfileId above.
  externalProvider: printJobSourceEnum('external_provider'),
  externalRef: text('external_ref'),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgDocNumUnique: uniqueIndex('documents_org_docnum_unique').on(t.organizationId, t.documentNumber),
  siteIdx: index('documents_site_idx').on(t.siteId),
  deptIdx: index('documents_dept_idx').on(t.departmentId),
  externalRefIdx: index('documents_external_ref_idx').on(t.externalProvider, t.externalRef),
}));

export const documentRevisions = pgTable('document_revisions', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id').notNull().references(() => documents.id),
  revisionNumber: integer('revision_number').notNull(),
  revisionLabel: varchar('revision_label', { length: 20 }).notNull(), // e.g. "03"
  approvalStatus: approvalStatusEnum('approval_status').notNull().default('DRAFT'),
  effectiveDate: timestamp('effective_date', { withTimezone: true }),
  reviewDueDate: timestamp('review_due_date', { withTimezone: true }),
  supersededRevisionId: uuid('superseded_revision_id'),
  sourceFileKey: text('source_file_key'),
  scannedFileKey: text('scanned_file_key'),
  changeSummary: text('change_summary'),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  docRevUnique: uniqueIndex('document_revisions_doc_rev_unique').on(t.documentId, t.revisionNumber),
  docIdx: index('document_revisions_doc_idx').on(t.documentId),
}));

// A record of a paper approval signature OR an electronic approval reference.
// Explicitly NOT treated as interchangeable with an e-signature (see sourceRecordType).
export const documentApprovalReferences = pgTable('document_approval_references', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentRevisionId: uuid('document_revision_id').notNull().references(() => documentRevisions.id),
  sourceRecordType: sourceRecordTypeEnum('source_record_type').notNull(),
  approvalReferenceNumber: varchar('approval_reference_number', { length: 150 }),
  approvedByName: text('approved_by_name'),
  approvedDate: timestamp('approved_date', { withTimezone: true }),
  notes: text('notes'),
  recordedByUserId: uuid('recorded_by_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  revIdx: index('doc_approval_refs_rev_idx').on(t.documentRevisionId),
}));

// ============================================================
// MODULE B: CONTROLLED PRINT MANAGEMENT
// ============================================================

export const printRequests = pgTable('print_requests', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  documentId: uuid('document_id').notNull().references(() => documents.id),
  documentRevisionId: uuid('document_revision_id').notNull().references(() => documentRevisions.id),
  numberOfCopies: integer('number_of_copies').notNull(),
  requestingUserId: uuid('requesting_user_id').notNull().references(() => users.id),
  departmentId: uuid('department_id').notNull().references(() => departments.id),
  destinationLocation: text('destination_location').notNull(),
  intendedPurpose: text('intended_purpose'),
  reasonForPrinting: text('reason_for_printing'),
  printer: varchar('printer', { length: 150 }), // legacy free-text printer name, kept for back-compat
  printerId: uuid('printer_id'), // Epic F: the actual registered, plant-scoped printer
  isUrgent: boolean('is_urgent').notNull().default(false), // Epic F11: priority queuing
  // Epic H: which system this request originated from, and that system's own
  // reference for the source document (e.g. a Google Drive file ID or a
  // SharePoint item ID). NATIVE requests leave sourceRef null.
  source: printJobSourceEnum('source').notNull().default('NATIVE'),
  sourceRef: text('source_ref'),
  classification: printClassificationEnum('classification').notNull().default('CONTROLLED'),
  reviewDueDate: timestamp('review_due_date', { withTimezone: true }),
  status: printRequestStatusEnum('status').notNull().default('REQUESTED'),
  requestedAt: timestamp('requested_at', { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  docIdx: index('print_requests_doc_idx').on(t.documentId),
  statusIdx: index('print_requests_status_idx').on(t.status),
}));

export const printApprovals = pgTable('print_approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  printRequestId: uuid('print_request_id').notNull().references(() => printRequests.id),
  approverUserId: uuid('approver_user_id').notNull().references(() => users.id),
  decision: varchar('decision', { length: 20 }).notNull(), // APPROVED | REJECTED
  comments: text('comments'),
  // Populated only for an APPROVED decision — this is the electronic
  // signature: the approver re-typed their own full name to confirm,
  // exactly as spec'd for document approvals (see documentApprovalReferences
  // above). A REJECTED decision isn't an e-signed record, so these stay null.
  approvalReferenceNumber: varchar('approval_reference_number', { length: 150 }),
  signerFullName: text('signer_full_name'),
  attestationStatement: text('attestation_statement'),
  decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  reqIdx: index('print_approvals_req_idx').on(t.printRequestId),
}));

export const controlledCopies = pgTable('controlled_copies', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  copyIdentifier: varchar('copy_identifier', { length: 150 }).notNull(), // SOP-PROD-001-REV03-COPY-0042
  printRequestId: uuid('print_request_id').notNull().references(() => printRequests.id),
  documentId: uuid('document_id').notNull().references(() => documents.id),
  documentRevisionId: uuid('document_revision_id').notNull().references(() => documentRevisions.id),
  copySequence: integer('copy_sequence').notNull(),
  marking: copyMarkingEnum('marking').notNull().default('CONTROLLED_COPY'),
  qrToken: varchar('qr_token', { length: 64 }).notNull(), // cryptographically unpredictable
  pdfFileKey: text('pdf_file_key'),
  pageCount: integer('page_count'),
  printOutcome: varchar('print_outcome', { length: 20 }), // SUCCEEDED | FAILED
  printOutcomeNote: text('print_outcome_note'), // e.g. "out of paper, reprinted"
  status: copyStatusEnum('status').notNull().default('REQUESTED'),
  issuedToDepartmentId: uuid('issued_to_department_id').references(() => departments.id),
  destinationLocation: text('destination_location'),
  printedAt: timestamp('printed_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  copyIdUnique: uniqueIndex('controlled_copies_copyid_unique').on(t.organizationId, t.copyIdentifier),
  qrTokenUnique: uniqueIndex('controlled_copies_qrtoken_unique').on(t.qrToken),
  docIdx: index('controlled_copies_doc_idx').on(t.documentId),
  statusIdx: index('controlled_copies_status_idx').on(t.status),
}));

// ============================================================
// MODULE C: PHYSICAL DISTRIBUTION & INVENTORY
// ============================================================

export const copyDistributions = pgTable('copy_distributions', {
  id: uuid('id').primaryKey().defaultRandom(),
  controlledCopyId: uuid('controlled_copy_id').notNull().references(() => controlledCopies.id),
  issuedToUserId: uuid('issued_to_user_id').references(() => users.id),
  departmentId: uuid('department_id').notNull().references(() => departments.id),
  physicalLocation: text('physical_location').notNull(),
  equipmentOrLine: varchar('equipment_or_line', { length: 150 }),
  issuedByUserId: uuid('issued_by_user_id').notNull().references(() => users.id),
  issueDate: timestamp('issue_date', { withTimezone: true }).notNull().defaultNow(),
  returnDate: timestamp('return_date', { withTimezone: true }),
  remarks: text('remarks'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  copyIdx: index('copy_distributions_copy_idx').on(t.controlledCopyId),
}));

export const copyAcknowledgements = pgTable('copy_acknowledgements', {
  id: uuid('id').primaryKey().defaultRandom(),
  controlledCopyId: uuid('controlled_copy_id').notNull().references(() => controlledCopies.id),
  acknowledgedByUserId: uuid('acknowledged_by_user_id').notNull().references(() => users.id),
  acknowledgementDate: timestamp('acknowledgement_date', { withTimezone: true }).notNull().defaultNow(),
  remarks: text('remarks'),
}, (t) => ({
  copyIdx: index('copy_acknowledgements_copy_idx').on(t.controlledCopyId),
}));

export const copyVerifications = pgTable('copy_verifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  controlledCopyId: uuid('controlled_copy_id').notNull().references(() => controlledCopies.id),
  scannedByUserId: uuid('scanned_by_user_id').references(() => users.id),
  scanVerdict: scanVerdictEnum('scan_verdict').notNull(),
  scannedOffline: boolean('scanned_offline').notNull().default(false),
  lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
  locationAtScan: text('location_at_scan'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  copyIdx: index('copy_verifications_copy_idx').on(t.controlledCopyId),
}));

// ============================================================
// MODULE E: REVISION CONTROL & RECALL
// ============================================================

export const documentRecalls = pgTable('document_recalls', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  documentId: uuid('document_id').notNull().references(() => documents.id),
  supersededRevisionId: uuid('superseded_revision_id').notNull().references(() => documentRevisions.id),
  newRevisionId: uuid('new_revision_id').notNull().references(() => documentRevisions.id),
  status: recallStatusEnum('status').notNull().default('INITIATED'),
  initiatedByUserId: uuid('initiated_by_user_id').notNull().references(() => users.id),
  initiatedAt: timestamp('initiated_at', { withTimezone: true }).notNull().defaultNow(),
  isEmergencyWithdrawal: boolean('is_emergency_withdrawal').notNull().default(false),
  closedAt: timestamp('closed_at', { withTimezone: true }),
  closedByUserId: uuid('closed_by_user_id').references(() => users.id),
}, (t) => ({
  docIdx: index('document_recalls_doc_idx').on(t.documentId),
}));

export const recallItems = pgTable('recall_items', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentRecallId: uuid('document_recall_id').notNull().references(() => documentRecalls.id),
  controlledCopyId: uuid('controlled_copy_id').notNull().references(() => controlledCopies.id),
  status: recallItemStatusEnum('status').notNull().default('RECALL_INITIATED'),
  destructionDueAt: timestamp('destruction_due_at', { withTimezone: true }),
  acknowledgedAt: timestamp('acknowledged_at', { withTimezone: true }),
  retrievedAt: timestamp('retrieved_at', { withTimezone: true }),
  escalatedAt: timestamp('escalated_at', { withTimezone: true }),
  notes: text('notes'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  recallIdx: index('recall_items_recall_idx').on(t.documentRecallId),
  copyIdx: index('recall_items_copy_idx').on(t.controlledCopyId),
}));

export const destructionConfirmations = pgTable('destruction_confirmations', {
  id: uuid('id').primaryKey().defaultRandom(),
  controlledCopyId: uuid('controlled_copy_id').notNull().references(() => controlledCopies.id),
  recallItemId: uuid('recall_item_id').references(() => recallItems.id),
  destructionDate: timestamp('destruction_date', { withTimezone: true }).notNull().defaultNow(),
  destructionMethod: varchar('destruction_method', { length: 150 }),
  performedByUserId: uuid('performed_by_user_id').notNull().references(() => users.id),
  witnessName: text('witness_name').notNull(),
  witnessUserId: uuid('witness_user_id').references(() => users.id),
  remarks: text('remarks'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  copyIdx: index('destruction_confirmations_copy_idx').on(t.controlledCopyId),
}));

export const documentExceptions = pgTable('document_exceptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  documentRecallId: uuid('document_recall_id').references(() => documentRecalls.id),
  recallItemId: uuid('recall_item_id').references(() => recallItems.id),
  reason: text('reason').notNull(),
  requestedByUserId: uuid('requested_by_user_id').notNull().references(() => users.id),
  status: exceptionStatusEnum('status').notNull().default('PENDING'),
  decidedByUserId: uuid('decided_by_user_id').references(() => users.id),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('document_exceptions_org_idx').on(t.organizationId),
}));

// ============================================================
// MODULE F: AUDIT & COMPLIANCE
// ============================================================

// Append-only. Never updated or deleted. Corrections are new rows referencing the original.
export const auditEvents = pgTable('audit_events', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  userId: uuid('user_id').references(() => users.id),
  eventType: varchar('event_type', { length: 100 }).notNull(),
  entityType: varchar('entity_type', { length: 100 }).notNull(),
  entityId: uuid('entity_id'),
  summary: text('summary').notNull(),
  reasonForChange: text('reason_for_change'),
  previousValue: jsonb('previous_value'),
  newValue: jsonb('new_value'),
  correctsAuditEventId: uuid('corrects_audit_event_id'),
  ipAddress: varchar('ip_address', { length: 64 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('audit_events_org_idx').on(t.organizationId),
  entityIdx: index('audit_events_entity_idx').on(t.entityType, t.entityId),
  createdIdx: index('audit_events_created_idx').on(t.createdAt),
}));

export const notifications = pgTable('notifications', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  kind: varchar('kind', { length: 100 }).notNull(),
  title: text('title').notNull(),
  body: text('body'),
  relatedEntityType: varchar('related_entity_type', { length: 100 }),
  relatedEntityId: uuid('related_entity_id'),
  isRead: boolean('is_read').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  userIdx: index('notifications_user_idx').on(t.userId),
}));

// ============================================================
// MODULE G: QMS/DMS INTEGRATION LAYER
// ============================================================

export const integrations = pgTable('integrations', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  providerKey: varchar('provider_key', { length: 50 }).notNull(), // mastercontrol | veeva | amplelogic | caliber | sharepoint | manual
  displayName: text('display_name').notNull(),
  configJson: jsonb('config_json'),
  isActive: boolean('is_active').notNull().default(false),
  lastSuccessfulSyncAt: timestamp('last_successful_sync_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('integrations_org_idx').on(t.organizationId),
}));

export const integrationSyncLogs = pgTable('integration_sync_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  integrationId: uuid('integration_id').notNull().references(() => integrations.id),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp('finished_at', { withTimezone: true }),
  status: varchar('status', { length: 30 }).notNull().default('RUNNING'), // RUNNING | SUCCESS | FAILED
  recordsSynced: integer('records_synced').default(0),
  errorMessage: text('error_message'),
}, (t) => ({
  integrationIdx: index('integration_sync_logs_integration_idx').on(t.integrationId),
}));

// ============================================================
// MODULE H: PRINT MANAGEMENT, PRINT REVIEW & QUEUE (gold standard)
// ============================================================

// Epic E — Print Review: a configurable overlay (logo + stamp fields) that
// replaces a hardcoded footer. Stamp fields match real controlled-copy
// stamping conventions (MASTER COPY, REVIEWED — NO CHANGE, Next Review Date,
// Reviewed By, Date, etc.), each with its own label/value/position so the
// Document Controller can lay them out and preview exactly what will print.
export const overlayProfiles = pgTable('overlay_profiles', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  name: text('name').notNull(),
  logoFileKey: text('logo_file_key'),
  paperSize: varchar('paper_size', { length: 10 }).notNull().default('A4'),
  // Array of { key, label, value, page: 'first'|'all', x, y, fontSize }
  stampFields: jsonb('stamp_fields').notNull().default(sql`'[]'::jsonb`),
  isDefault: boolean('is_default').notNull().default(false),
  createdByUserId: uuid('created_by_user_id').notNull().references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('overlay_profiles_org_idx').on(t.organizationId),
}));

// Epic F — Printer & Queue Management: printers are scoped to a plant
// (siteId), never addressed by name alone, since the same printer name can
// recur across plants. status/consecutiveFailures/circuitOpenUntil back the
// F9 circuit breaker; a printer with status=CIRCUIT_OPEN is skipped by the
// dispatcher until circuitOpenUntil passes and it is health-checked again.
export const printers = pgTable('printers', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  siteId: uuid('site_id').notNull().references(() => sites.id),
  name: text('name').notNull(),
  connectionEndpoint: text('connection_endpoint'), // null = simulated driver (no real printer hardware yet)
  supportedPaperSizes: jsonb('supported_paper_sizes').notNull().default(sql`'["A4"]'::jsonb`),
  isApproved: boolean('is_approved').notNull().default(true),
  status: printerStatusEnum('status').notNull().default('ACTIVE'),
  consecutiveFailures: integer('consecutive_failures').notNull().default(0),
  circuitOpenUntil: timestamp('circuit_open_until', { withTimezone: true }),
  lastHealthCheckAt: timestamp('last_health_check_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('printers_org_idx').on(t.organizationId),
  siteIdx: index('printers_site_idx').on(t.siteId),
}));

// One row per dispatched print attempt. A print_request (or an API-triggered
// request) produces one print_job per copy; BullMQ gives each printer its own
// isolated queue (bullJobId/queueName), so one printer's backlog never delays
// another's (F2). attempts/lastError back the F7 retry-with-backoff engine;
// a job that exhausts its retries moves to DEAD_LETTER (F8) rather than
// vanishing silently.
export const printJobs = pgTable('print_jobs', {
  id: uuid('id').primaryKey().defaultRandom(),
  organizationId: uuid('organization_id').notNull().references(() => organizations.id),
  printRequestId: uuid('print_request_id').references(() => printRequests.id),
  copyId: uuid('copy_id').references(() => controlledCopies.id),
  printerId: uuid('printer_id').notNull().references(() => printers.id),
  queueName: varchar('queue_name', { length: 150 }).notNull(), // one BullMQ queue per printer
  bullJobId: text('bull_job_id'),
  status: printJobStatusEnum('status').notNull().default('QUEUED'),
  priority: printJobPriorityEnum('priority').notNull().default('STANDARD'),
  source: printJobSourceEnum('source').notNull().default('NATIVE'),
  sourceRef: text('source_ref'),
  requestedPages: integer('requested_pages').notNull(),
  confirmedPages: integer('confirmed_pages'), // F4: expected-vs-confirmed partial-print detection
  attempts: integer('attempts').notNull().default(0),
  lastError: text('last_error'),
  exceptionReason: text('exception_reason'), // F6: logged printer-whitelist exception
  exceptionGrantedByUserId: uuid('exception_granted_by_user_id').references(() => users.id),
  exceptionExpiresAt: timestamp('exception_expires_at', { withTimezone: true }),
  queuedAt: timestamp('queued_at', { withTimezone: true }).notNull().defaultNow(),
  dispatchedAt: timestamp('dispatched_at', { withTimezone: true }),
  confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  orgIdx: index('print_jobs_org_idx').on(t.organizationId),
  printerIdx: index('print_jobs_printer_idx').on(t.printerId),
  statusIdx: index('print_jobs_status_idx').on(t.status),
}));

// ============================================================
// RELATIONS (subset, for query convenience)
// ============================================================

export const documentsRelations = relations(documents, ({ many, one }) => ({
  revisions: many(documentRevisions),
  department: one(departments, { fields: [documents.departmentId], references: [departments.id] }),
}));

export const documentRevisionsRelations = relations(documentRevisions, ({ one, many }) => ({
  document: one(documents, { fields: [documentRevisions.documentId], references: [documents.id] }),
  approvalReferences: many(documentApprovalReferences),
}));

export const controlledCopiesRelations = relations(controlledCopies, ({ one, many }) => ({
  document: one(documents, { fields: [controlledCopies.documentId], references: [documents.id] }),
  revision: one(documentRevisions, { fields: [controlledCopies.documentRevisionId], references: [documentRevisions.id] }),
  distributions: many(copyDistributions),
  verifications: many(copyVerifications),
}));

export const printRequestsRelations = relations(printRequests, ({ one, many }) => ({
  document: one(documents, { fields: [printRequests.documentId], references: [documents.id] }),
  revision: one(documentRevisions, { fields: [printRequests.documentRevisionId], references: [documentRevisions.id] }),
  approvals: many(printApprovals),
  copies: many(controlledCopies),
}));

export const documentRecallsRelations = relations(documentRecalls, ({ one, many }) => ({
  document: one(documents, { fields: [documentRecalls.documentId], references: [documents.id] }),
  items: many(recallItems),
}));
