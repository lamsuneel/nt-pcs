import { readFileSync } from 'fs';
import path from 'path';
import { pool } from '@/lib/db';

export const dynamic = 'force-dynamic';

const TEMPLATE_PATH = path.join(process.cwd(), 'src/app/demo-template.html');

// Fallback data used if the database is unreachable, so the demo still renders.
const FALLBACK_DOCS: [string, string, string, string][] = [
  ['SOP-QA-001', 'Document Control Procedure', 'SOP', 'Quality Assurance'],
  ['SOP-PROD-001', 'Equipment Cleaning Procedure', 'CLEANING PROCEDURE', 'Production'],
  ['BMR-PROD-010', 'Batch Manufacturing Record - Paracetamol 500mg', 'BMR', 'Production'],
  ['SOP-QC-001', 'Sample Management Procedure', 'SOP', 'Quality Control'],
  ['SOP-WH-001', 'Raw Material Receipt Procedure', 'SOP', 'Warehouse'],
  ['QM-QA-001', 'Quality Manual', 'QUALITY MANUAL', 'Quality Assurance'],
];

const FALLBACK_COPIES: [string, string, string][] = [
  ['SOP-PROD-001-REV01-COPY-0001', 'Production Block A - Line 1', 'ACTIVE'],
  ['SOP-PROD-001-REV01-COPY-0004', 'Production Block A - QC Station', 'RECALL_PENDING'],
  ['SOP-PROD-001-REV01-COPY-0005', 'Production Block A - Supervisor Desk', 'RECALL_PENDING'],
];

async function loadDemoData() {
  try {
    const docsResult = await pool.query(
      `select document_number, title, doc_type, department
       from documents
       order by created_at asc`
    );
    const copiesResult = await pool.query(
      `select copy_identifier, location, status
       from controlled_copies
       order by created_at asc`
    );

    const docs = docsResult.rows.map((r) => [r.document_number, r.title, r.doc_type, r.department]);
    const copies = copiesResult.rows.map((r) => [r.copy_identifier, r.location, r.status]);

    return {
      docs: docs.length ? docs : FALLBACK_DOCS,
      copies: copies.length ? copies : FALLBACK_COPIES,
    };
  } catch (err) {
    console.error('PrintAssure demo: falling back to static data, DB query failed:', err);
    return { docs: FALLBACK_DOCS, copies: FALLBACK_COPIES };
  }
}

export async function GET() {
  const { docs, copies } = await loadDemoData();
  const template = readFileSync(TEMPLATE_PATH, 'utf-8');

  const html = template
    .replace('__DOCS_JSON__', JSON.stringify(docs))
    .replace('__COPIES_JSON__', JSON.stringify(copies));

  return new Response(html, {
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
}
