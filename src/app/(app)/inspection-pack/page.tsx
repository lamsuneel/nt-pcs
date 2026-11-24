'use client';

import { useState } from 'react';
import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Card, Button, EmptyState } from '@/components/ui';

interface DocRow {
  id: string;
  documentNumber: string;
  title: string;
}

export default function InspectionPackPage() {
  const { data: docsData } = useSWRLite<{ documents: DocRow[] }>('/api/documents');
  const docs = docsData?.documents ?? [];
  const [selected, setSelected] = useState('');
  const [building, setBuilding] = useState(false);
  const [pack, setPack] = useState<null | {
    documentNumber: string;
    title: string;
    revisions: number;
    printRequests: number;
    copies: number;
    auditEvents: number;
  }>(null);

  async function build() {
    if (!selected) return;
    setBuilding(true);
    const doc = docs.find((d) => d.id === selected)!;
    const [docDetail, printReqs, copies, audit] = await Promise.all([
      fetch(`/api/documents/${selected}`, { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/print-requests', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/copies', { credentials: 'include' }).then((r) => r.json()),
      fetch('/api/reports/audit-trail?format=json', { credentials: 'include' }).then((r) => (r.ok ? r.json() : { rows: [] })),
    ]);
    setPack({
      documentNumber: doc.documentNumber,
      title: doc.title,
      revisions: (docDetail.revisions ?? []).length,
      printRequests: (printReqs.printRequests ?? []).filter((p: any) => p.documentId === selected).length,
      copies: (copies.copies ?? []).filter((c: any) => c.documentId === selected).length,
      auditEvents: (audit.rows ?? []).filter((e: any) => e.entityId === selected || (docDetail.revisions ?? []).some((r: any) => r.id === e.entityId)).length,
    });
    setBuilding(false);
  }

  return (
    <div>
      <PageHeader
        title="Inspection Pack"
        subtitle="Assembles everything an inspector would ask for on a given document — revisions, print history, controlled copies and the matching audit events — in one place."
      />

      <Card className="mb-5">
        <div className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[220px]">
            <label className="text-xs text-nt-muted block mb-1">Document</label>
            <select className="nt-input" value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Select document</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>{d.documentNumber} — {d.title}</option>
              ))}
            </select>
          </div>
          <Button onClick={build} disabled={!selected || building}>{building ? 'Assembling…' : 'Build pack'}</Button>
        </div>
      </Card>

      {!pack && <EmptyState message="Pick a document to assemble its inspection pack." />}

      {pack && (
        <div>
          <div className="text-nt-text font-display text-lg mb-3">{pack.documentNumber} — {pack.title}</div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card><div className="text-nt-muted text-xs uppercase">Revisions</div><div className="font-display text-2xl text-nt-text mt-1">{pack.revisions}</div></Card>
            <Card><div className="text-nt-muted text-xs uppercase">Print Requests</div><div className="font-display text-2xl text-nt-text mt-1">{pack.printRequests}</div></Card>
            <Card><div className="text-nt-muted text-xs uppercase">Controlled Copies</div><div className="font-display text-2xl text-nt-text mt-1">{pack.copies}</div></Card>
            <Card><div className="text-nt-muted text-xs uppercase">Audit Events</div><div className="font-display text-2xl text-nt-text mt-1">{pack.auditEvents}</div></Card>
          </div>
        </div>
      )}
    </div>
  );
}
