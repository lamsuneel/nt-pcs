'use client';

import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Card, StatusBadge } from '@/components/ui';

interface Integration {
  id: string;
  providerKey: string;
  displayName: string;
  isActive: boolean;
  lastSuccessfulSyncAt: string | null;
}
interface SyncLog {
  id: string;
  integrationId: string;
  startedAt: string;
  status: string;
  recordsSynced: number | null;
  errorMessage: string | null;
}

export default function IntegrationsPage() {
  const { data, error } = useSWRLite<{ integrations: Integration[]; logs: SyncLog[] }>('/api/meta/integrations');
  const integrations = data?.integrations ?? [];
  const logs = data?.logs ?? [];

  return (
    <div>
      <PageHeader
        title="Integration Events"
        subtitle="PrintAssure is standalone first, integration-ready second. The external DMS/QMS remains the source of truth for approved versions when connected — PrintAssure owns physical-copy accountability either way."
      />
      {error && <Card className="mb-5 text-sm text-nt-blocked">{error}</Card>}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {integrations.map((a) => (
          <Card key={a.id} className="flex items-center justify-between">
            <div>
              <div className="text-sm text-nt-text">{a.displayName}</div>
              <div className="text-nt-muted text-xs mt-0.5">
                {a.isActive && a.lastSuccessfulSyncAt
                  ? `Last synced ${new Date(a.lastSuccessfulSyncAt).toLocaleString()}`
                  : 'Not connected — manual import/export fallback active'}
              </div>
            </div>
            <StatusBadge status={a.isActive ? 'ACTIVE' : 'DRAFT'} />
          </Card>
        ))}
      </div>

      <div className="section-title text-nt-muted text-xs uppercase tracking-wide mb-2">Recent sync events</div>
      <div className="space-y-2 mb-6">
        {logs.map((l) => {
          const integ = integrations.find((i) => i.id === l.integrationId);
          return (
            <Card key={l.id} className="flex items-center justify-between py-3">
              <div>
                <div className="text-nt-text text-sm">{integ?.displayName ?? 'Unknown'}</div>
                <div className="text-nt-muted text-xs mt-0.5">
                  {new Date(l.startedAt).toLocaleString()} · {l.recordsSynced ?? 0} records{l.errorMessage ? ` · ${l.errorMessage}` : ''}
                </div>
              </div>
              <StatusBadge status={l.status === 'SUCCESS' ? 'ACTIVE' : l.status === 'FAILED' ? 'LOST' : l.status} />
            </Card>
          );
        })}
      </div>

      <Card>
        <div className="text-sm text-nt-text font-medium mb-1">A failed sync never issues an obsolete document</div>
        <p className="text-nt-muted text-xs">
          If a configured integration fails, print requests against that document type are held, not silently approved
          against stale metadata. Sync logs, last-success timestamps and conflict detection are part of the adapter
          contract (DocumentProvider) this layer is built against.
        </p>
      </Card>
    </div>
  );
}
