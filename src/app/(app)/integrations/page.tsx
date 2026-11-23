'use client';

import { PageHeader, Card, StatusBadge } from '@/components/ui';

const ADAPTERS = [
  { key: 'mastercontrol', name: 'MasterControl' },
  { key: 'veeva', name: 'Veeva Vault' },
  { key: 'amplelogic', name: 'AmpleLogic' },
  { key: 'caliber', name: 'Caliber' },
  { key: 'sharepoint', name: 'SharePoint' },
];

export default function IntegrationsPage() {
  return (
    <div>
      <PageHeader
        title="Integrations"
        subtitle="NeuraTrace is standalone first, integration-ready second. The external DMS/QMS remains the source of truth for approved versions when connected — NTPCS owns physical-copy accountability either way."
      />
      <div className="grid grid-cols-2 gap-4">
        {ADAPTERS.map((a) => (
          <Card key={a.key} className="flex items-center justify-between">
            <div>
              <div className="text-sm text-nt-text">{a.name}</div>
              <div className="text-nt-muted text-xs mt-0.5">Not connected — manual import/export fallback active</div>
            </div>
            <StatusBadge status="DRAFT" />
          </Card>
        ))}
      </div>
      <Card className="mt-6">
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
