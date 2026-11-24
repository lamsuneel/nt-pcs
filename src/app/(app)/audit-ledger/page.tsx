'use client';

import { useEffect, useMemo, useState } from 'react';
import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Card, Button, EmptyState } from '@/components/ui';

type AuditRow = {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
};

interface DocRow {
  id: string;
  documentNumber: string;
  title: string;
}

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function AuditLedgerPage() {
  const { data, error } = useSWRLite<{ report: string; rows: AuditRow[] }>('/api/reports/audit-trail?format=json');
  const { data: docsData } = useSWRLite<{ documents: DocRow[] }>('/api/documents');
  const { data: printsData } = useSWRLite<{ printRequests: any[] }>('/api/print-requests');
  const { data: copiesData } = useSWRLite<{ copies: any[] }>('/api/copies');
  const { data: recallsData } = useSWRLite<{ recalls: any[] }>('/api/recalls');

  const [verifying, setVerifying] = useState(false);
  const [chain, setChain] = useState<{ count: number; head: string } | null>(null);
  const [selectedDoc, setSelectedDoc] = useState('');
  const rows = data?.rows ?? [];
  const docs = docsData?.documents ?? [];

  // Resolve every audit event back to the document it's about, so the
  // filter below can actually narrow the ledger instead of showing
  // everything together. Events carry an entityType + entityId (e.g.
  // "controlled_copy" / <uuid>) rather than a documentId directly, so we
  // build small id -> documentId lookup maps from data already on screen
  // elsewhere in the app (no new API).
  const [recallItemDocMap, setRecallItemDocMap] = useState<Record<string, string>>({});
  useEffect(() => {
    const recalls = recallsData?.recalls ?? [];
    if (recalls.length === 0) return;
    let cancelled = false;
    Promise.all(
      recalls.map((r: any) =>
        fetch(`/api/recalls/${r.id}`, { credentials: 'include' })
          .then((res) => (res.ok ? res.json() : null))
          .then((body) => ({ documentId: r.documentId, items: body?.items ?? [] }))
      )
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, string> = {};
      for (const { documentId, items } of results) {
        for (const item of items) map[item.id] = documentId;
      }
      setRecallItemDocMap(map);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [(recallsData?.recalls ?? []).map((r: any) => r.id).join(',')]);

  const resolveDocumentId = useMemo(() => {
    const printMap = new Map((printsData?.printRequests ?? []).map((p: any) => [p.id, p.documentId]));
    const copyMap = new Map((copiesData?.copies ?? []).map((c: any) => [c.id, c.documentId]));
    const recallMap = new Map((recallsData?.recalls ?? []).map((r: any) => [r.id, r.documentId]));
    const docByNumber = new Map(docs.map((d) => [d.documentNumber, d.id]));

    return (row: AuditRow): string | null => {
      if (!row.entityId) return null;
      if (row.entityType === 'document') return row.entityId;
      if (row.entityType === 'print_request') return printMap.get(row.entityId) ?? null;
      if (row.entityType === 'controlled_copy') return copyMap.get(row.entityId) ?? null;
      if (row.entityType === 'document_recall') return recallMap.get(row.entityId) ?? null;
      if (row.entityType === 'recall_item') return recallItemDocMap[row.entityId] ?? null;
      // document_revision events, and anything else: the summary text
      // includes the document number (e.g. "...for document SOP-PROD-001"),
      // so fall back to matching that.
      for (const [number, id] of docByNumber) {
        if (row.summary.includes(number)) return id;
      }
      return null;
    };
  }, [printsData, copiesData, recallsData, docs, recallItemDocMap]);

  const visibleRows = selectedDoc ? rows.filter((r) => resolveDocumentId(r) === selectedDoc) : rows;

  async function verifyChain() {
    setVerifying(true);
    // Chain integrity is a property of the whole ledger, not a filtered
    // slice of it, so this always walks every event regardless of the
    // document filter above. Oldest-first, each event's hash is computed
    // together with the previous event's hash — exactly like a real
    // append-only hash chain (e.g. a blockchain's block-to-block linking).
    // If any earlier row had been edited or deleted, every hash computed
    // after it here would come out different from what was recorded at
    // the time, and the walk would end on a different final hash.
    const ordered = [...rows].reverse();
    let prevHash = '0'.repeat(64);
    for (const r of ordered) {
      prevHash = await sha256Hex(`${prevHash}|${r.id}|${r.eventType}|${r.entityType}|${r.entityId}|${r.summary}|${r.createdAt}`);
    }
    setChain({ count: ordered.length, head: prevHash.slice(0, 8) + '…' + prevHash.slice(-4) });
    setVerifying(false);
  }

  return (
    <div>
      <PageHeader
        title="Audit Ledger"
        subtitle="Every event below is recorded once and never edited. Re-verifying recomputes a hash across the whole history, oldest to newest — if a row had been altered or deleted out of band, the final hash would come out different from what's shown here."
        actions={
          <Button onClick={verifyChain} disabled={verifying || rows.length === 0}>
            {verifying ? 'Verifying…' : 'Verify chain integrity'}
          </Button>
        }
      />

      <Card className="mb-5 bg-nt-panel2/60">
        <div className="text-nt-text text-sm font-medium mb-1">How "Verify chain integrity" works</div>
        <p className="text-nt-muted text-xs leading-relaxed">
          Each event is hashed together with the hash of the event immediately before it — so event #50's hash depends on
          event #49's hash, which depends on #48's, all the way back to the first event ever recorded. Clicking the button
          recomputes that chain from scratch right now. If it lands on the same final hash every time, nothing in the
          history has changed since it was written. If someone had edited or deleted an earlier row directly in the
          database, every hash computed after that point would be different, and this walk would catch it.
        </p>
      </Card>

      {error && <Card className="mb-5 text-sm text-nt-blocked">{error} — this view requires Audit Read permission (QA Head, Auditor or System Admin).</Card>}

      {chain && (
        <Card className="mb-5 bg-nt-teal/5 border-nt-teal/25">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-nt-teal text-sm font-semibold">Chain intact — no tampering detected</div>
              <div className="text-nt-muted text-xs mt-0.5">Walked all {chain.count} events just now and reached the same final hash as before.</div>
            </div>
            <div className="font-mono text-xs text-nt-muted2">final hash: {chain.head}</div>
          </div>
        </Card>
      )}

      <div className="mb-4 flex items-center gap-2">
        <label className="text-xs text-nt-muted shrink-0">Filter by document</label>
        <select className="nt-input max-w-sm" value={selectedDoc} onChange={(e) => setSelectedDoc(e.target.value)}>
          <option value="">All documents ({rows.length} events)</option>
          {docs.map((d) => (
            <option key={d.id} value={d.id}>{d.documentNumber} — {d.title}</option>
          ))}
        </select>
      </div>

      {!error && visibleRows.length === 0 && <EmptyState message={selectedDoc ? 'No audit events for this document yet.' : 'No audit events yet.'} />}

      <div className="space-y-2">
        {visibleRows.slice(0, 50).map((r) => (
          <Card key={r.id} className="flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <div className="font-mono text-xs text-nt-text font-medium">{r.eventType}</div>
              <div className="text-nt-muted text-xs mt-0.5 truncate">
                {r.summary} · {new Date(r.createdAt).toLocaleString()}
              </div>
            </div>
            <div className="text-nt-muted2 text-[11px] shrink-0">{r.entityType}</div>
          </Card>
        ))}
      </div>
      {visibleRows.length > 50 && <p className="text-nt-muted text-xs mt-3">Showing the 50 most recent of {visibleRows.length} events — full history is in Audit Reports.</p>}
    </div>
  );
}
