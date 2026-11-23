'use client';

import { useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Card, Button } from '@/components/ui';

const STEPS = [
  'Register the manufacturing site',
  'Create departments',
  'Create document categories',
  'Register existing paper SOPs',
  'Upload scanned copies where available',
  'Capture physical master-copy locations',
  'Register current revision numbers',
  'Record existing approval references and signed approval dates',
  'Configure document-control roles',
  'Configure print authorization workflows',
  'Register initial controlled-copy inventory',
  'Start digital traceability',
];

export default function OnboardingPage() {
  const { data: org } = useSWRLite<{ departments: any[]; sites: any[] }>('/api/meta/org');
  const fileRef = useRef<HTMLInputElement>(null);
  const [log, setLog] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);

  function downloadTemplate() {
    const rows = [
      ['documentNumber', 'title', 'documentType', 'departmentCode', 'masterCopyLocation', 'revisionLabel'],
      ['SOP-PROD-099', 'Example Procedure Title', 'SOP', 'PROD', 'QA Document Control Room, Rack 1', '01'],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Documents');
    XLSX.writeFile(wb, 'ntpcs-document-import-template.xlsx');
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !org) return;
    setImporting(true);
    setLog([]);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<any>(sheet);

    const deptByCode = Object.fromEntries(org.departments.map((d: any) => [d.code, d]));
    const siteId = org.sites[0]?.id;

    for (const row of rows) {
      const dept = deptByCode[row.departmentCode];
      if (!dept) {
        setLog((l) => [...l, `✗ ${row.documentNumber}: unknown department code "${row.departmentCode}"`]);
        continue;
      }
      const res = await fetch('/api/documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          documentNumber: row.documentNumber,
          title: row.title,
          documentType: row.documentType || 'SOP',
          departmentId: dept.id,
          siteId,
          masterCopyLocation: row.masterCopyLocation,
          revisionLabel: row.revisionLabel || '01',
          sourceFileProvided: false,
        }),
      });
      setLog((l) => [...l, res.ok ? `✓ ${row.documentNumber} registered` : `✗ ${row.documentNumber} failed`]);
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  return (
    <div>
      <PageHeader
        title="Paper-to-Digital Document Control Setup"
        subtitle="For sites with no DMS, QMS or digital SOP repository. Existing paper approval workflows remain unchanged — NeuraTrace records their evidence and references."
      />

      <Card className="mb-6">
        <ol className="space-y-2 text-sm">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-3">
              <span className="w-6 h-6 rounded-full bg-nt-teal/15 text-nt-teal text-xs flex items-center justify-center font-mono">{i + 1}</span>
              <span className="text-nt-text">{s}</span>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <div className="font-display text-sm text-nt-text mb-2">Bulk document registration (step 4)</div>
        <p className="text-nt-muted text-xs mb-4">Download the template, fill in your existing paper SOP register, then import. Each row registers a document with revision 01.</p>
        <div className="flex gap-2 mb-4">
          <Button variant="secondary" onClick={downloadTemplate}>Download Excel Template</Button>
          <Button onClick={() => fileRef.current?.click()} disabled={importing}>{importing ? 'Importing...' : 'Import Excel File'}</Button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
        </div>
        {log.length > 0 && (
          <div className="bg-nt-panel2 rounded-lg p-3 text-xs font-mono space-y-1 max-h-48 overflow-y-auto">
            {log.map((l, i) => <div key={i} className={l.startsWith('✓') ? 'text-nt-compliant' : 'text-nt-blocked'}>{l}</div>)}
          </div>
        )}
      </Card>
    </div>
  );
}
