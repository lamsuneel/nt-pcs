'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import useSWRLite from '@/lib/use-swr-lite';
import { askAgent } from '@/lib/agent-chat';

interface Kpis {
  totalRegisteredDocuments: number;
  activeControlledCopies: number;
  pendingPrintApprovals: number;
  copiesAwaitingAcknowledgement: number;
  pendingRecalls: number;
  lostOrDamagedCopies: number;
}

interface Tip {
  icon: string;
  text: string;
  actionLabel?: string;
  goto?: string;
}

function buildTips(segment: string, kpis: Kpis | null): Tip[] {
  switch (segment) {
    case 'dashboard': {
      const tips: Tip[] = [];
      if (kpis) {
        tips.push(
          kpis.pendingRecalls > 0
            ? { icon: '⚠️', text: `${kpis.pendingRecalls} recall${kpis.pendingRecalls === 1 ? '' : 's'} still open — copies are overdue for reconciliation.`, actionLabel: 'Open Revision & Recall', goto: '/recalls' }
            : { icon: '✅', text: 'No open recalls right now.' }
        );
        if (kpis.pendingPrintApprovals > 0) {
          tips.push({ icon: '🖨️', text: `${kpis.pendingPrintApprovals} print request${kpis.pendingPrintApprovals === 1 ? '' : 's'} waiting on approval.`, actionLabel: 'Review requests', goto: '/print-requests' });
        }
      }
      return tips;
    }
    case 'documents':
      return [{ icon: '➕', text: 'Issuing a document? The form pre-fills department and site options from your org.', actionLabel: 'Issue a document', goto: '/documents/new' }];
    case 'print-requests':
      return [{ icon: '✅', text: 'Approved requests move to Issue — issuing generates the copy IDs, QR codes and server-side PDFs in one step.' }];
    case 'copies':
      return kpis
        ? [{ icon: '📍', text: `${kpis.activeControlledCopies} controlled copies are active right now. Want the location breakdown?`, actionLabel: 'Open Inventory Map', goto: '/inventory-map' }]
        : [];
    case 'verify':
      return [{ icon: '🔎', text: 'This page never exposes the underlying file — it only returns a validity verdict, even to the agent.' }];
    case 'recalls':
      return [{ icon: '🧯', text: "A recall can't close until every outstanding copy is destruction-confirmed or exception-approved.", actionLabel: 'See reconciliation %', goto: '/recall-report' }];
    case 'reports':
      return [{ icon: '📄', text: 'Every register here exports straight to CSV — the same records an inspector would ask for.' }];
    case 'users':
      return [{ icon: '🪪', text: "Roles are enforced at the API layer, not just hidden in the UI — switching a role here changes what that person can actually do." }];
    case 'audit-ledger':
      return [{ icon: '🔗', text: "Each event is hashed together with the one before it — re-verifying walks the whole chain and would catch a tampered row." }];
    case 'inventory-map':
      return [{ icon: '🗺️', text: "Grouped by each copy's declared physical location, read straight from the controlled copies table." }];
    case 'recall-report':
      return [{ icon: '📊', text: 'Reconciliation % is computed live — destroyed-with-witness or exception-approved count as reconciled.' }];
    case 'ask-audit':
      return [{ icon: '💬', text: 'Try asking about outstanding copies, recent recalls, or destruction events — it queries the live audit_events table.' }];
    case 'integrations':
      return [{ icon: '📡', text: 'MasterControl is the only integration wired up to a real sync log right now — the rest are manual-fallback.' }];
    case 'anomalies':
      return [{ icon: '🤖', text: 'These checks run over your real audit ledger — a fast-approval flag means under 60 seconds between request and approval.' }];
    case 'inspection-pack':
      return [{ icon: '🗂️', text: "Pick any document and I'll pull its real revision, print, copy and audit-event counts in one pack." }];
    default:
      return [];
  }
}

export function AgentRail() {
  const pathname = usePathname();
  const router = useRouter();
  const segment = (pathname.split('/')[1] || 'dashboard');
  const { data: kpis } = useSWRLite<Kpis>('/api/dashboard/kpis');

  // Collapse state is intentionally NOT persisted across page loads — a
  // demo walkthrough moves between personas and screens constantly, and a
  // collapse click sticking forever (via localStorage) made the whole
  // panel disappear down to a thin edge tab that's easy to miss and looks
  // like the agent is simply gone. Every fresh page load starts expanded;
  // collapsing only lasts for the current view.
  const [collapsed, setCollapsed] = useState(false);
  function toggle() {
    setCollapsed((c) => !c);
  }

  const tips = buildTips(segment, kpis ?? null);

  const [log, setLog] = useState<{ role: 'user' | 'agent'; text: string }[]>([]);
  const [question, setQuestion] = useState('');
  const [busy, setBusy] = useState(false);

  async function send() {
    const q = question.trim();
    if (!q || busy) return;
    setLog((l) => [...l, { role: 'user', text: q }]);
    setQuestion('');
    setBusy(true);
    const answer = await askAgent(q);
    setLog((l) => [...l, { role: 'agent', text: answer }]);
    setBusy(false);
  }

  if (collapsed) {
    return (
      <button
        onClick={toggle}
        title="Open PrintAssure Agent"
        className="fixed right-0 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1.5 w-10 py-3 rounded-l-xl bg-nt-teal text-nt-bg shadow-lg hover:bg-nt-tealDim z-20"
      >
        <span className="text-base">🤖</span>
        <span className="text-[10px] font-medium [writing-mode:vertical-rl] rotate-180">Agent</span>
      </button>
    );
  }

  return (
    <aside className="w-72 shrink-0 border-l border-nt-border bg-nt-panel min-h-screen flex flex-col">
      <div className="flex items-center gap-2 px-4 py-4 border-b border-nt-border">
        <div className="w-7 h-7 rounded-full bg-nt-teal/15 flex items-center justify-center text-sm">🤖</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm text-nt-text font-medium leading-tight">PrintAssure Agent</div>
          <div className="text-[11px] text-nt-muted leading-tight flex items-center gap-1 mt-0.5">
            <span className="w-1.5 h-1.5 rounded-full bg-nt-teal inline-block animate-pulse" />
            Watching this screen
          </div>
        </div>
        <button onClick={toggle} title="Collapse" className="text-nt-muted hover:text-nt-text text-xs shrink-0">
          ⟩⟨
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {tips.length > 0 && (
          <div>
            <div className="text-[10px] font-semibold tracking-wider uppercase text-nt-muted2 mb-2">On this screen</div>
            <div className="space-y-2">
              {tips.map((t, i) => (
                <div key={i} className="nt-card p-3">
                  <div className="flex gap-2">
                    <span className="text-sm shrink-0">{t.icon}</span>
                    <p className="text-xs text-nt-text leading-snug">{t.text}</p>
                  </div>
                  {t.actionLabel && t.goto && (
                    <button
                      onClick={() => router.push(t.goto!)}
                      className="mt-2 text-xs font-medium text-nt-teal hover:underline"
                    >
                      {t.actionLabel} →
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {log.length > 0 && (
          <div className="space-y-2 pt-1">
            {log.map((m, i) => (
              <div
                key={i}
                className={clsx(
                  'text-xs rounded-lg px-3 py-2 max-w-[90%]',
                  m.role === 'user' ? 'ml-auto bg-nt-teal/10 text-nt-text' : 'bg-nt-panel2 text-nt-text'
                )}
              >
                {m.text}
              </div>
            ))}
            {busy && <div className="text-xs text-nt-muted2 px-1">thinking…</div>}
          </div>
        )}
      </div>

      <div className="px-3 py-3 border-t border-nt-border flex gap-2">
        <input
          className="nt-input flex-1 text-xs"
          placeholder="Ask the agent…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') send();
          }}
        />
        <button
          onClick={send}
          disabled={busy}
          className="w-8 h-8 shrink-0 rounded-lg bg-nt-teal text-nt-bg text-sm disabled:opacity-40"
        >
          ↑
        </button>
      </div>
    </aside>
  );
}
