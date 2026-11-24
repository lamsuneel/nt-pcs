'use client';

import useSWRLite from '@/lib/use-swr-lite';
import { useEffect, useState } from 'react';
import { PageHeader, Card, StatusBadge, EmptyState } from '@/components/ui';

interface Recall {
  id: string;
  initiatedAt: string;
  status: string;
  isEmergencyWithdrawal: boolean;
}

export default function RecallReportPage() {
  const { data } = useSWRLite<{ recalls: Recall[] }>('/api/recalls');
  const recalls = data?.recalls ?? [];
  const [details, setDetails] = useState<Record<string, { items: any[] }>>({});

  useEffect(() => {
    recalls.forEach((r) => {
      if (details[r.id]) return;
      fetch(`/api/recalls/${r.id}`, { credentials: 'include' })
        .then((res) => res.json())
        .then((body) => setDetails((d) => ({ ...d, [r.id]: { items: body.items ?? [] } })));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recalls.map((r) => r.id).join(',')]);

  return (
    <div>
      <PageHeader
        title="Recall Effectiveness"
        subtitle="How fast each recall reconciled every outstanding copy — destroyed-with-witness or exception-approved — against the clock."
      />
      {recalls.length === 0 && <EmptyState message="No recalls to report on yet." />}
      <div className="space-y-4">
        {recalls.map((r) => {
          const items = details[r.id]?.items ?? [];
          const total = items.length;
          const reconciled = items.filter((i: any) => ['RETRIEVED', 'DESTROYED', 'EXCEPTION_APPROVED', 'RECALL_ACKNOWLEDGED'].includes(i.status)).length;
          const pct = total ? Math.round((reconciled / total) * 100) : 0;
          const days = Math.max(1, Math.round((Date.now() - new Date(r.initiatedAt).getTime()) / 86400000));
          return (
            <Card key={r.id}>
              <div className="flex items-center justify-between flex-wrap gap-2 mb-3">
                <div>
                  <div className="text-nt-text text-sm font-medium">{r.isEmergencyWithdrawal ? 'Emergency withdrawal' : 'Revision recall'}</div>
                  <div className="text-nt-muted text-xs mt-0.5">Initiated {new Date(r.initiatedAt).toLocaleDateString()} · {days} day{days === 1 ? '' : 's'} in</div>
                </div>
                <StatusBadge status={r.status} />
              </div>
              <div className="w-full h-2 rounded-full bg-nt-panel2 overflow-hidden">
                <div className="h-full bg-nt-teal transition-all" style={{ width: `${pct}%` }} />
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-nt-muted">
                <span>{reconciled} of {total} copies reconciled</span>
                <span className="font-mono text-nt-teal">{pct}%</span>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
