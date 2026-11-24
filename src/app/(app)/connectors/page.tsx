'use client';

import { PageHeader, Card, StatusBadge } from '@/components/ui';

const CONNECTORS = [
  { name: 'MasterControl', status: 'IN DISCUSSION', note: 'Partnership connector — PrintAssure owns physical-copy accountability, MasterControl remains the DMS/QMS source of truth.' },
  { name: 'Veeva Vault', status: 'PLANNED', note: 'Document metadata and approval-status sync.' },
  { name: 'AmpleLogic', status: 'PLANNED', note: 'Document metadata and approval-status sync.' },
  { name: 'Caliber', status: 'PLANNED', note: 'Document metadata and approval-status sync.' },
  { name: 'SharePoint', status: 'AVAILABLE', note: 'Manual import/export is already supported without a live connector.' },
];

export default function ConnectorsPage() {
  return (
    <div>
      <PageHeader
        title="Connectors"
        subtitle="Max-tier preview — the adapter contract (DocumentProvider) this layer is built against, and where each partner sits today."
      />
      <div className="space-y-2">
        {CONNECTORS.map((c) => (
          <Card key={c.name} className="flex items-center justify-between gap-4">
            <div>
              <div className="text-sm text-nt-text">{c.name}</div>
              <div className="text-nt-muted text-xs mt-0.5">{c.note}</div>
            </div>
            <StatusBadge status={c.status === 'IN DISCUSSION' ? 'REQUESTED' : c.status === 'AVAILABLE' ? 'ACTIVE' : 'DRAFT'} />
          </Card>
        ))}
      </div>
    </div>
  );
}
