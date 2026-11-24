import 'dotenv/config';
import { db, pool } from './client';
import {
  organizations,
  sites,
  departments,
  users,
  roles,
  userRoles,
  documents,
  documentRevisions,
  documentApprovalReferences,
  printRequests,
  printApprovals,
  controlledCopies,
  copyDistributions,
  copyAcknowledgements,
  copyVerifications,
  documentRecalls,
  recallItems,
  destructionConfirmations,
  auditEvents,
} from './schema';
import { hashPassword } from '@/lib/auth';
import { buildCopyIdentifier, generateQrToken } from '@/lib/copy-id';
import { buildControlledCopyPdf } from '@/lib/pdf';
import { storage } from '@/lib/storage';
import { ROLE_NAMES } from '@/lib/permissions';

const BASE_URL = process.env.APP_BASE_URL || 'http://localhost:3000';

async function audit(organizationId: string, userId: string | null, eventType: string, entityType: string, entityId: string | null, summary: string) {
  await db.insert(auditEvents).values({ organizationId, userId, eventType, entityType, entityId, summary });
}

async function main() {
  console.log('Seeding Demo Pharma Laboratories...');

  const [org] = await db
    .insert(organizations)
    .values({ name: 'Demo Pharma Laboratories Pvt Ltd', slug: 'demo-pharma' })
    .returning();

  const [site] = await db
    .insert(sites)
    .values({ organizationId: org.id, name: 'Unit 1 - Visakhapatnam', code: 'UNIT1' })
    .returning();

  const deptDefs = [
    ['Quality Assurance', 'QA'],
    ['Quality Control', 'QC'],
    ['Production', 'PROD'],
    ['Engineering', 'ENG'],
    ['Warehouse', 'WH'],
    ['Packaging', 'PKG'],
  ] as const;

  const deptRows = await db
    .insert(departments)
    .values(deptDefs.map(([name, code]) => ({ organizationId: org.id, siteId: site.id, name, code })))
    .returning();
  const dept = Object.fromEntries(deptRows.map((d) => [d.code, d]));

  // Roles
  const roleRows = await db
    .insert(roles)
    .values(ROLE_NAMES.map((name) => ({ organizationId: org.id, name })))
    .returning();
  const roleByName = Object.fromEntries(roleRows.map((r) => [r.name, r]));

  // Users — one per role, plus a couple of extra production employees for the scenario.
  const passwordHash = await hashPassword('Password123!');
  const userDefs: {
    key: string;
    fullName: string;
    email: string;
    role: (typeof ROLE_NAMES)[number];
    deptCode?: keyof typeof dept;
  }[] = [
    { key: 'admin', fullName: 'Sanjay Rao', email: 'admin@demo-pharma.local', role: 'SYSTEM_ADMIN' },
    { key: 'qaHead', fullName: 'Dr. Lakshmi Narayan', email: 'qa.head@demo-pharma.local', role: 'QA_HEAD', deptCode: 'QA' },
    { key: 'docController', fullName: 'Priya Menon', email: 'doc.controller@demo-pharma.local', role: 'DOCUMENT_CONTROLLER', deptCode: 'QA' },
    { key: 'qaManager', fullName: 'Arjun Reddy', email: 'qa.manager@demo-pharma.local', role: 'QA_MANAGER', deptCode: 'QA' },
    { key: 'prodHead', fullName: 'Suresh Kumar', email: 'production.head@demo-pharma.local', role: 'DEPARTMENT_HEAD', deptCode: 'PROD' },
    { key: 'qaExecutive', fullName: 'Deepa Varma', email: 'qa.executive@demo-pharma.local', role: 'EMPLOYEE', deptCode: 'QA' },
    { key: 'prodEmployee', fullName: 'Ravi Teja', email: 'production.employee@demo-pharma.local', role: 'EMPLOYEE', deptCode: 'PROD' },
    { key: 'auditor', fullName: 'Nandini Iyer', email: 'auditor@demo-pharma.local', role: 'AUDITOR' },
  ];

  const userRowsByKey: Record<string, typeof users.$inferSelect> = {};
  for (const def of userDefs) {
    const [u] = await db
      .insert(users)
      .values({
        organizationId: org.id,
        siteId: site.id,
        departmentId: def.deptCode ? dept[def.deptCode].id : null,
        fullName: def.fullName,
        email: def.email,
        passwordHash,
      })
      .returning();
    userRowsByKey[def.key] = u;
    await db.insert(userRoles).values({ userId: u.id, roleId: roleByName[def.role].id });
  }

  // ---------------------------------------------------------------
  // 20+ sample documents across departments, each with an approved
  // revision 01 and a paper-approval reference (paper-first mode).
  // ---------------------------------------------------------------
  const docDefs: { num: string; title: string; type: string; deptCode: keyof typeof dept }[] = [
    { num: 'SOP-QA-001', title: 'Document Control Procedure', type: 'SOP', deptCode: 'QA' },
    { num: 'SOP-QA-002', title: 'Change Control Procedure', type: 'SOP', deptCode: 'QA' },
    { num: 'SOP-QA-003', title: 'Deviation Management Procedure', type: 'SOP', deptCode: 'QA' },
    { num: 'SOP-QA-004', title: 'CAPA Management Procedure', type: 'SOP', deptCode: 'QA' },
    { num: 'SOP-PROD-001', title: 'Equipment Cleaning Procedure', type: 'CLEANING_PROCEDURE', deptCode: 'PROD' },
    { num: 'SOP-PROD-002', title: 'Dispensing Procedure', type: 'SOP', deptCode: 'PROD' },
    { num: 'SOP-PROD-003', title: 'Granulation Procedure', type: 'SOP', deptCode: 'PROD' },
    { num: 'SOP-PROD-004', title: 'Compression Procedure', type: 'SOP', deptCode: 'PROD' },
    { num: 'BMR-PROD-010', title: 'Batch Manufacturing Record - Paracetamol 500mg', type: 'BMR', deptCode: 'PROD' },
    { num: 'BPR-PKG-010', title: 'Batch Packaging Record - Paracetamol 500mg', type: 'BPR', deptCode: 'PKG' },
    { num: 'SOP-QC-001', title: 'Sample Management Procedure', type: 'SOP', deptCode: 'QC' },
    { num: 'SOP-QC-002', title: 'HPLC Operation Procedure', type: 'EQUIPMENT_SOP', deptCode: 'QC' },
    { num: 'STP-QC-010', title: 'Standard Test Procedure - Paracetamol Assay', type: 'STP', deptCode: 'QC' },
    { num: 'SPEC-QC-010', title: 'Specification - Paracetamol 500mg Tablets', type: 'SPECIFICATION', deptCode: 'QC' },
    { num: 'SOP-WH-001', title: 'Raw Material Receipt Procedure', type: 'SOP', deptCode: 'WH' },
    { num: 'SOP-WH-002', title: 'Material Storage and Issuance Procedure', type: 'SOP', deptCode: 'WH' },
    { num: 'SOP-ENG-001', title: 'Equipment Calibration Procedure', type: 'CALIBRATION_PROCEDURE', deptCode: 'ENG' },
    { num: 'SOP-ENG-002', title: 'Preventive Maintenance Procedure', type: 'SOP', deptCode: 'ENG' },
    { num: 'SOP-SAF-001', title: 'Personal Protective Equipment Procedure', type: 'SAFETY_PROCEDURE', deptCode: 'PROD' },
    { num: 'QM-QA-001', title: 'Quality Manual', type: 'QUALITY_MANUAL', deptCode: 'QA' },
    { num: 'FMT-QA-010', title: 'Line Clearance Checklist', type: 'FORMAT_CHECKLIST', deptCode: 'PROD' },
    { num: 'WI-PKG-001', title: 'Blister Packing Work Instruction', type: 'WI', deptCode: 'PKG' },
  ];

  const docRowsByNum: Record<string, typeof documents.$inferSelect> = {};
  const revRowsByNum: Record<string, typeof documentRevisions.$inferSelect> = {};

  for (const d of docDefs) {
    const [doc] = await db
      .insert(documents)
      .values({
        organizationId: org.id,
        siteId: site.id,
        documentNumber: d.num,
        title: d.title,
        documentType: d.type as any,
        departmentId: dept[d.deptCode].id,
        masterCopyLocation: `${d.deptCode} Document Control Room, Rack ${Math.ceil(Math.random() * 5)}`,
        hasNoFileYet: true,
        createdByUserId: userRowsByKey.docController.id,
      })
      .returning();

    const [rev] = await db
      .insert(documentRevisions)
      .values({
        documentId: doc.id,
        revisionNumber: 1,
        revisionLabel: '01',
        approvalStatus: 'APPROVED',
        effectiveDate: new Date('2026-06-01'),
        reviewDueDate: new Date('2027-06-01'),
        changeSummary: 'Initial registration (paper-first onboarding)',
        createdByUserId: userRowsByKey.docController.id,
      })
      .returning();

    await db.update(documents).set({ currentRevisionId: rev.id }).where(eq_(documents, doc.id));

    await db.insert(documentApprovalReferences).values({
      documentRevisionId: rev.id,
      sourceRecordType: 'PAPER_APPROVAL_REFERENCE',
      approvalReferenceNumber: `QA-APPR-${d.num}-01`,
      approvedByName: 'Dr. Lakshmi Narayan',
      approvedDate: new Date('2026-05-28'),
      notes: 'Signed paper master retained in Document Control Room.',
      recordedByUserId: userRowsByKey.docController.id,
    });

    docRowsByNum[d.num] = doc;
    revRowsByNum[d.num] = rev;

    await audit(org.id, userRowsByKey.docController.id, 'DOCUMENT_REGISTERED', 'document', doc.id, `Registered ${d.num} — ${d.title}`);
  }

  console.log(`Registered ${docDefs.length} documents.`);

  // ---------------------------------------------------------------
  // Acceptance-criteria scenario (spec §12), run end to end on
  // SOP-PROD-001: 5 copies requested -> approved -> issued -> distributed ->
  // 1 acknowledged+verified -> new revision -> recall -> 3 destroyed,
  // 2 outstanding.
  // ---------------------------------------------------------------
  const scenarioDoc = docRowsByNum['SOP-PROD-001'];
  const scenarioRevV1 = revRowsByNum['SOP-PROD-001'];

  const [printReq] = await db
    .insert(printRequests)
    .values({
      organizationId: org.id,
      documentId: scenarioDoc.id,
      documentRevisionId: scenarioRevV1.id,
      numberOfCopies: 5,
      requestingUserId: userRowsByKey.qaExecutive.id,
      departmentId: dept.PROD.id,
      destinationLocation: 'Production Block A',
      intendedPurpose: 'Line clearance and equipment cleaning reference',
      reasonForPrinting: 'New shift copies required for Production Block A',
      printer: 'QA-Printer-01',
      classification: 'CONTROLLED',
      status: 'REQUESTED',
    })
    .returning();
  await audit(org.id, userRowsByKey.qaExecutive.id, 'PRINT_REQUESTED', 'print_request', printReq.id, 'Requested 5 controlled copies of SOP-PROD-001 rev 01');

  await db.insert(printApprovals).values({
    printRequestId: printReq.id,
    approverUserId: userRowsByKey.qaManager.id,
    decision: 'APPROVED',
    comments: 'Approved for Production Block A shift rollout.',
  });
  await db.update(printRequests).set({ status: 'APPROVED' }).where(eq_(printRequests, printReq.id));
  await audit(org.id, userRowsByKey.qaManager.id, 'PRINT_APPROVED', 'print_request', printReq.id, 'Print request approved by QA Manager');

  const createdCopies: (typeof controlledCopies.$inferSelect)[] = [];
  const locations = ['Production Block A - Line 1', 'Production Block A - Line 2', 'Production Block A - Line 3', 'Production Block A - QC Station', 'Production Block A - Supervisor Desk'];

  for (let seq = 1; seq <= 5; seq++) {
    const qrToken = generateQrToken();
    const copyIdentifier = buildCopyIdentifier(scenarioDoc.documentNumber, scenarioRevV1.revisionLabel, seq);
    const pdfBytes = await buildControlledCopyPdf({
      documentNumber: scenarioDoc.documentNumber,
      documentTitle: scenarioDoc.title,
      revisionLabel: scenarioRevV1.revisionLabel,
      copyIdentifier,
      markingLabel: 'CONTROLLED COPY',
      issuedToLabel: locations[seq - 1],
      printedDateLabel: '2026-06-10',
      verifyUrl: `${BASE_URL}/verify/${qrToken}`,
    });
    const fileKey = `copies/${org.id}/${copyIdentifier}.pdf`;
    await storage.putObject(fileKey, pdfBytes, 'application/pdf');

    const [copy] = await db
      .insert(controlledCopies)
      .values({
        organizationId: org.id,
        copyIdentifier,
        printRequestId: printReq.id,
        documentId: scenarioDoc.id,
        documentRevisionId: scenarioRevV1.id,
        copySequence: seq,
        marking: 'CONTROLLED_COPY',
        qrToken,
        pdfFileKey: fileKey,
        status: 'PRINTED',
        printOutcome: 'SUCCEEDED',
        destinationLocation: locations[seq - 1],
        issuedToDepartmentId: dept.PROD.id,
        printedAt: new Date('2026-06-10'),
      })
      .returning();
    createdCopies.push(copy);
  }
  await db.update(printRequests).set({ status: 'ISSUED' }).where(eq_(printRequests, printReq.id));
  await audit(org.id, userRowsByKey.docController.id, 'PRINT_ISSUED', 'print_request', printReq.id, '5 controlled copies generated for SOP-PROD-001 rev 01');

  // Distribute all 5, acknowledge + verify the first one.
  for (const copy of createdCopies) {
    await db.insert(copyDistributions).values({
      controlledCopyId: copy.id,
      departmentId: dept.PROD.id,
      physicalLocation: copy.destinationLocation!,
      issuedByUserId: userRowsByKey.docController.id,
    });
  }
  await db.update(controlledCopies).set({ status: 'ISSUED' }).where(inArray_(controlledCopies, createdCopies.map((c) => c.id)));

  const firstCopy = createdCopies[0];
  await db.insert(copyAcknowledgements).values({ controlledCopyId: firstCopy.id, acknowledgedByUserId: userRowsByKey.prodEmployee.id });
  await db.update(controlledCopies).set({ status: 'ACTIVE' }).where(eq_(controlledCopies, firstCopy.id));
  await db.insert(copyVerifications).values({
    controlledCopyId: firstCopy.id,
    scannedByUserId: userRowsByKey.prodEmployee.id,
    scanVerdict: 'GREEN',
    locationAtScan: firstCopy.destinationLocation,
  });
  await audit(org.id, userRowsByKey.prodEmployee.id, 'QR_SCANNED', 'controlled_copy', firstCopy.id, `${firstCopy.copyIdentifier} scanned — verdict GREEN`);

  // Mark the other 4 ACTIVE too (acknowledged, in normal use) so the recall has 5 active copies.
  for (const copy of createdCopies.slice(1)) {
    await db.insert(copyAcknowledgements).values({ controlledCopyId: copy.id, acknowledgedByUserId: userRowsByKey.prodEmployee.id });
    await db.update(controlledCopies).set({ status: 'ACTIVE' }).where(eq_(controlledCopies, copy.id));
  }

  // New revision 02, approved, triggers recall of all 5 rev-01 active copies.
  const [revV2] = await db
    .insert(documentRevisions)
    .values({
      documentId: scenarioDoc.id,
      revisionNumber: 2,
      revisionLabel: '02',
      approvalStatus: 'APPROVED',
      effectiveDate: new Date('2026-11-01'),
      reviewDueDate: new Date('2027-11-01'),
      supersededRevisionId: scenarioRevV1.id,
      changeSummary: 'Updated cleaning validation hold-time per CAPA-2026-041',
      createdByUserId: userRowsByKey.docController.id,
    })
    .returning();
  await db.update(documents).set({ currentRevisionId: revV2.id }).where(eq_(documents, scenarioDoc.id));
  await audit(org.id, userRowsByKey.qaHead.id, 'REVISION_REGISTERED', 'document_revision', revV2.id, 'Revision 02 of SOP-PROD-001 registered and approved');

  const [recall] = await db
    .insert(documentRecalls)
    .values({
      organizationId: org.id,
      documentId: scenarioDoc.id,
      supersededRevisionId: scenarioRevV1.id,
      newRevisionId: revV2.id,
      initiatedByUserId: userRowsByKey.qaHead.id,
    })
    .returning();

  const dueAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const recallItemRows: (typeof recallItems.$inferSelect)[] = [];
  for (const copy of createdCopies) {
    const [item] = await db.insert(recallItems).values({ documentRecallId: recall.id, controlledCopyId: copy.id, destructionDueAt: dueAt }).returning();
    recallItemRows.push(item);
    await db.update(controlledCopies).set({ status: 'RECALL_PENDING' }).where(eq_(controlledCopies, copy.id));
  }
  await audit(org.id, userRowsByKey.qaHead.id, 'RECALL_INITIATED', 'document_recall', recall.id, 'Recall initiated for 5 active copies of SOP-PROD-001 rev 01');

  // 3 copies: acknowledged -> retrieved -> destroyed (with witness).
  for (const item of recallItemRows.slice(0, 3)) {
    await db.update(recallItems).set({ status: 'RECALL_ACKNOWLEDGED', acknowledgedAt: new Date() }).where(eq_(recallItems, item.id));
    await db.update(recallItems).set({ status: 'PHYSICALLY_RETRIEVED', retrievedAt: new Date() }).where(eq_(recallItems, item.id));
    await db.update(controlledCopies).set({ status: 'RETURNED' }).where(eq_(controlledCopies, item.controlledCopyId));

    await db.insert(destructionConfirmations).values({
      controlledCopyId: item.controlledCopyId,
      recallItemId: item.id,
      destructionMethod: 'Shredding',
      performedByUserId: userRowsByKey.docController.id,
      witnessName: 'Arjun Reddy (QA Manager)',
      witnessUserId: userRowsByKey.qaManager.id,
      remarks: 'Witnessed destruction per recall reconciliation.',
    });
    await db.update(recallItems).set({ status: 'DESTRUCTION_CONFIRMED' }).where(eq_(recallItems, item.id));
    await db.update(controlledCopies).set({ status: 'DESTROYED' }).where(eq_(controlledCopies, item.controlledCopyId));
    await audit(org.id, userRowsByKey.docController.id, 'DESTRUCTION_CONFIRMED', 'controlled_copy', item.controlledCopyId, 'Destruction confirmed, witness: Arjun Reddy (QA Manager)');
  }

  // 2 copies remain outstanding — recall stays open, cannot be closed yet.
  for (const item of recallItemRows.slice(3)) {
    await db.update(recallItems).set({ status: 'OUTSTANDING', escalatedAt: new Date() }).where(eq_(recallItems, item.id));
    await audit(org.id, userRowsByKey.qaHead.id, 'RECALL_ITEM_ESCALATED', 'recall_item', item.id, 'Recall item escalated as outstanding — reminder sent to Production Block A');
  }
  await db.update(documentRecalls).set({ status: 'PARTIALLY_RECONCILED' }).where(eq_(documentRecalls, recall.id));

  console.log('Acceptance-criteria scenario seeded: 3 destroyed, 2 outstanding, recall intentionally left open.');

  // ---------------------------------------------------------------
  // A little extra variety for the dashboard: a pending print request
  // on another document, and a lost copy.
  // ---------------------------------------------------------------
  const qcDoc = docRowsByNum['SOP-QC-002'];
  const qcRev = revRowsByNum['SOP-QC-002'];
  await db.insert(printRequests).values({
    organizationId: org.id,
    documentId: qcDoc.id,
    documentRevisionId: qcRev.id,
    numberOfCopies: 2,
    requestingUserId: userRowsByKey.qaExecutive.id,
    departmentId: dept.QC.id,
    destinationLocation: 'QC Lab - HPLC Room',
    reasonForPrinting: 'New HPLC unit commissioning',
    classification: 'CONTROLLED',
    status: 'REQUESTED',
  });

  const whDoc = docRowsByNum['SOP-WH-001'];
  const whRev = revRowsByNum['SOP-WH-001'];
  const [whPrintReq] = await db
    .insert(printRequests)
    .values({
      organizationId: org.id,
      documentId: whDoc.id,
      documentRevisionId: whRev.id,
      numberOfCopies: 1,
      requestingUserId: userRowsByKey.prodHead.id,
      departmentId: dept.WH.id,
      destinationLocation: 'Warehouse Dock 2',
      reasonForPrinting: 'Dock reference copy',
      classification: 'CONTROLLED',
      status: 'ISSUED',
    })
    .returning();
  const lostQr = generateQrToken();
  const lostCopyId = buildCopyIdentifier(whDoc.documentNumber, whRev.revisionLabel, 1);
  const lostPdf = await buildControlledCopyPdf({
    documentNumber: whDoc.documentNumber,
    documentTitle: whDoc.title,
    revisionLabel: whRev.revisionLabel,
    copyIdentifier: lostCopyId,
    markingLabel: 'CONTROLLED COPY',
    issuedToLabel: 'Warehouse Dock 2',
    printedDateLabel: '2026-09-01',
    verifyUrl: `${BASE_URL}/verify/${lostQr}`,
  });
  await storage.putObject(`copies/${org.id}/${lostCopyId}.pdf`, lostPdf, 'application/pdf');
  await db.insert(controlledCopies).values({
    organizationId: org.id,
    copyIdentifier: lostCopyId,
    printRequestId: whPrintReq.id,
    documentId: whDoc.id,
    documentRevisionId: whRev.id,
    copySequence: 1,
    marking: 'CONTROLLED_COPY',
    qrToken: lostQr,
    status: 'LOST',
    destinationLocation: 'Warehouse Dock 2',
    issuedToDepartmentId: dept.WH.id,
    printedAt: new Date('2026-09-01'),
  });

  console.log('Seed complete.');
  console.log('\nDemo logins (password: Password123!):');
  for (const def of userDefs) console.log(`  ${def.role.padEnd(20)} ${def.email}`);

  await pool.end();
}

// Small helper wrappers to keep call sites terse (drizzle eq/inArray imported lazily to avoid top clutter)
import { eq, inArray } from 'drizzle-orm';
function eq_(table: any, id: string) {
  return eq(table.id, id);
}
function inArray_(table: any, ids: string[]) {
  return inArray(table.id, ids);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
