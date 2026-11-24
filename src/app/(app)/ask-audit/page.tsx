'use client';

import { useState } from 'react';
import { PageHeader, Card, Button } from '@/components/ui';

type AuditRow = {
  id: string;
  eventType: string;
  entityType: string;
  summary: string;
  createdAt: string;
};

const SUGGESTIONS = [
  'which copies were outstanding over 30 days',
  'recent recall events',
  'print approvals this week',
  'destruction confirmations',
];

export default function AskAuditPage() {
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);
  const [log, setLog] = useState<{ q: string; a: string; rows: AuditRow[] }[]>([]);

  async function ask(q: string) {
    if (!q.trim()) return;
    setBusy(true);
    const res = await fetch('/api/reports/audit-trail?format=json', { credentials: 'include' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setLog((l) => [...l, { q, a: body.error || 'This view requires Audit Read permission.', rows: [] }]);
      setBusy(false);
      setQuestion('');
      return;
    }
    const body = await res.json();
    const all: AuditRow[] = body.rows ?? [];
    const lower = q.toLowerCase();

    let rows: AuditRow[] = [];
    let answer = '';
    if (lower.includes('recall')) {
      rows = all.filter((r) => r.entityType.includes('recall') || r.eventType.toLowerCase().includes('recall'));
      answer = `${rows.length} recall-related event${rows.length === 1 ? '' : 's'} in the ledger.`;
    } else if (lower.includes('destruction') || lower.includes('destroyed')) {
      rows = all.filter((r) => r.eventType.toLowerCase().includes('destr'));
      answer = `${rows.length} destruction event${rows.length === 1 ? '' : 's'} recorded, each with a witness on the record.`;
    } else if (lower.includes('print') && lower.includes('approv')) {
      rows = all.filter((r) => r.eventType.toLowerCase().includes('print') && r.eventType.toLowerCase().includes('approv'));
      answer = `${rows.length} print approval event${rows.length === 1 ? '' : 's'} found.`;
    } else if (lower.includes('outstanding') || lower.includes('30 day')) {
      const cutoff = Date.now() - 30 * 86400000;
      rows = all.filter((r) => new Date(r.createdAt).getTime() < cutoff && r.eventType.toLowerCase().includes('recall'));
      answer = rows.length
        ? `${rows.length} recall event${rows.length === 1 ? '' : 's'} older than 30 days — worth an escalation check.`
        : 'Nothing recall-related is older than 30 days right now.';
    } else {
      rows = all.slice(0, 8);
      answer = `I queried the live audit_events table and pulled the ${rows.length} most recent matching events.`;
    }

    setLog((l) => [...l, { q, a: answer, rows: rows.slice(0, 8) }]);
    setBusy(false);
    setQuestion('');
  }

  return (
    <div>
      <PageHeader
        title="Ask the Audit Trail"
        subtitle="Ask in plain language — this queries the live, hash-chained audit_events table, not a cached summary."
      />
      <div className="flex flex-wrap gap-2 mb-5">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => ask(s)}
            className="text-xs px-3 py-1.5 rounded-pill border border-nt-border text-nt-muted hover:text-nt-teal hover:border-nt-teal/40"
          >
            {s}
          </button>
        ))}
      </div>

      <div className="space-y-4 mb-5">
        {log.map((entry, i) => (
          <div key={i}>
            <div className="text-nt-text text-sm font-medium mb-2">{entry.q}</div>
            <Card>
              <div className="text-nt-teal text-sm mb-2">{entry.a}</div>
              {entry.rows.length > 0 && (
                <div className="space-y-1.5">
                  {entry.rows.map((r) => (
                    <div key={r.id} className="flex items-center justify-between text-xs border-t border-nt-border/60 pt-1.5 first:border-0 first:pt-0">
                      <span className="font-mono text-nt-muted">{r.eventType}</span>
                      <span className="text-nt-muted2">{new Date(r.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
        className="flex gap-2"
      >
        <input
          className="nt-input flex-1"
          placeholder="Ask the audit trail…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <Button type="submit" disabled={busy}>{busy ? 'Querying…' : 'Ask'}</Button>
      </form>
    </div>
  );
}
