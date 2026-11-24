'use client';

import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Card, EmptyState } from '@/components/ui';

interface AuditRow {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string | null;
  summary: string;
  createdAt: string;
}

const FAST_APPROVAL_THRESHOLD_SECONDS = 60;

export default function AnomaliesPage() {
  const { data, error } = useSWRLite<{ rows: AuditRow[] }>('/api/reports/audit-trail?format=json');
  const rows = data?.rows ?? [];

  // Real anomaly check #1: a print request approved implausibly fast.
  // Pairs each PRINT_REQUESTED event with its PRINT_APPROVED event (same
  // entityId) and flags anything approved in under a minute of being filed —
  // too fast for a human to have actually reviewed it.
  const requested = rows.filter((r) => r.eventType === 'PRINT_REQUESTED');
  const approved = rows.filter((r) => r.eventType === 'PRINT_APPROVED');
  const fastApprovals = requested
    .map((req) => {
      const match = approved.find((a) => a.entityId === req.entityId);
      if (!match) return null;
      const seconds = (new Date(match.createdAt).getTime() - new Date(req.createdAt).getTime()) / 1000;
      return { req, match, seconds };
    })
    .filter((x): x is { req: AuditRow; match: AuditRow; seconds: number } => !!x && x.seconds >= 0 && x.seconds < FAST_APPROVAL_THRESHOLD_SECONDS);

  // Real anomaly check #2: more than one destruction event recorded for the
  // same copy (entityId) — a red flag for double-counted destructions.
  const destructions = rows.filter((r) => r.eventType.toLowerCase().includes('destr'));
  const byEntity = new Map<string, AuditRow[]>();
  for (const d of destructions) {
    if (!d.entityId) continue;
    byEntity.set(d.entityId, [...(byEntity.get(d.entityId) ?? []), d]);
  }
  const duplicateDestructions = Array.from(byEntity.entries()).filter(([, v]) => v.length > 1);

  const totalAnomalies = fastApprovals.length + duplicateDestructions.length;

  return (
    <div>
      <PageHeader
        title="AI Anomaly Watch"
        subtitle="Two rule-based checks run over the real audit ledger below — no sample data, no model. A full Max-tier deployment would add a trained anomaly-detection model scoring the whole event graph; these two are plain, explainable rules you can verify by eye."
      />

      <Card className="mb-6 bg-nt-panel2/60">
        <div className="text-nt-text text-sm font-medium mb-2">What's being checked</div>
        <ul className="text-nt-muted text-xs space-y-1.5 list-disc pl-4">
          <li><b className="text-nt-text">Unusually fast approvals</b> — for every print request, the time between its "requested" and "approved" audit events is measured. Anything approved in under {FAST_APPROVAL_THRESHOLD_SECONDS} seconds is flagged — too fast for a human to have actually opened and reviewed it.</li>
          <li><b className="text-nt-text">Duplicate destruction events</b> — the ledger is grouped by the controlled copy each destruction event refers to. A copy destroyed more than once is flagged, since a copy can only physically be destroyed once.</li>
        </ul>
      </Card>

      {error && <Card className="mb-5 text-sm text-nt-blocked">{error}</Card>}
      {!error && totalAnomalies === 0 && <EmptyState message="No anomalies detected against the current ledger." />}

      {fastApprovals.length > 0 && (
        <div className="mb-6">
          <div className="text-nt-text text-sm font-medium mb-2">Unusually fast approvals</div>
          <div className="space-y-2">
            {fastApprovals.map(({ req, seconds }) => (
              <Card key={req.id} className="border-nt-flagged/30">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-nt-text">{req.summary}</div>
                  <span className="font-mono text-xs text-nt-flagged">{Math.round(seconds)}s to approve</span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {duplicateDestructions.length > 0 && (
        <div>
          <div className="text-nt-text text-sm font-medium mb-2">Duplicate destruction events</div>
          <div className="space-y-2">
            {duplicateDestructions.map(([entityId, events]) => (
              <Card key={entityId} className="border-nt-blocked/30">
                <div className="text-sm text-nt-text">{events.length} destruction events for the same record</div>
                <div className="text-nt-muted text-xs mt-1 font-mono">{entityId}</div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
