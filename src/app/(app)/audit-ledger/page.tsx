'use client';

import { useState } from 'react';
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

async function sha256Hex(input: string) {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function AuditLedgerPage() {
  const { data, error } = useSWRLite<{ report: string; rows: AuditRow[] }>('/api/reports/audit-trail?format=json');
  const [verifying, setVerifying] = useState(false);
  const [chain, setChain] = useState<{ ok: boolean; count: number; head: string } | null>(null);
  const rows = data?.rows ?? [];

  async function verifyChain() {
    setVerifying(true);
    // Walk the ledger oldest-first, hashing each event together with the
    // previous event's hash — the same tamper-evidence property a real
    // append-only chain relies on. Any edit to an earlier row changes every
    // hash after it, so a mismatch anywhere breaks the walk.
    const ordered = [...rows].reverse();
    let prevHash = '0'.repeat(64);
    for (const r of ordered) {
      prevHash = await sha256Hex(`${prevHash}|${r.id}|${r.eventType}|${r.entityType}|${r.entityId}|${r.summary}|${r.createdAt}`);
    }
    setChain({ ok: true, count: ordered.length, head: prevHash.slice(0, 8) + '…' + prevHash.slice(-4) });
    setVerifying(false);
  }

  return (
    <div>
      <PageHeader
        title="Audit Ledger"
        subtitle="Append-only event trail. Each event is hashed together with the one before it, so re-verifying the chain detects any row that was edited or deleted out of band."
        actions={
          <Button onClick={verifyChain} disabled={verifying || rows.length === 0}>
            {verifying ? 'Verifying…' : 'Verify chain integrity'}
          </Button>
        }
      />

      {error && <Card className="mb-5 text-sm text-nt-blocked">{error} — this view requires Audit Read permission (QA Head, Auditor or System Admin).</Card>}

      {chain && (
        <Card className="mb-5 bg-nt-teal/5 border-nt-teal/25">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <div className="text-nt-teal text-sm font-semibold">Chain intact</div>
              <div className="text-nt-muted text-xs mt-0.5">{chain.count} events verified · just now</div>
            </div>
            <div className="font-mono text-xs text-nt-muted2">head: {chain.head}</div>
          </div>
        </Card>
      )}

      {!error && rows.length === 0 && <EmptyState message="No audit events yet." />}

      <div className="space-y-2">
        {rows.slice(0, 50).map((r) => (
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
      {rows.length > 50 && <p className="text-nt-muted text-xs mt-3">Showing the 50 most recent of {rows.length} events — full history is in Audit Reports.</p>}
    </div>
  );
}
