'use client';

import useSWRLite from '@/lib/use-swr-lite';
import { KpiTile, PageHeader, LinkButton, Card } from '@/components/ui';
import { usePermissions } from '@/lib/use-permissions';

interface Kpis {
  totalRegisteredDocuments: number;
  activeControlledCopies: number;
  pendingPrintApprovals: number;
  copiesAwaitingAcknowledgement: number;
  pendingRecalls: number;
  lostOrDamagedCopies: number;
}

export default function DashboardPage() {
  const { data } = useSWRLite<Kpis>('/api/dashboard/kpis');
  const { can, PERMISSIONS } = usePermissions();

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Every printed GMP document, authorized, identifiable, traceable and accounted for."
        actions={
          <>
            {can(PERMISSIONS.DOCUMENT_REGISTER) && <LinkButton href="/documents/new" variant="secondary">Register Document</LinkButton>}
            {can(PERMISSIONS.PRINT_REQUEST) && <LinkButton href="/print-requests/new">Request Controlled Print</LinkButton>}
          </>
        }
      />

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <KpiTile label="Registered Documents" value={data?.totalRegisteredDocuments ?? '—'} href="/documents" />
        <KpiTile label="Active Controlled Copies" value={data?.activeControlledCopies ?? '—'} href="/copies" />
        <KpiTile label="Pending Print Approvals" value={data?.pendingPrintApprovals ?? '—'} href="/print-requests" />
        <KpiTile label="Copies Awaiting Acknowledgement" value={data?.copiesAwaitingAcknowledgement ?? '—'} href="/copies?status=ISSUED" />
        <KpiTile label="Pending Recalls" value={data?.pendingRecalls ?? '—'} href="/recalls" />
        <KpiTile label="Lost / Damaged Copies" value={data?.lostOrDamagedCopies ?? '—'} href="/copies" />
      </div>

      <Card>
        <div className="font-display text-sm text-nt-text mb-3">Quick actions</div>
        <div className="flex flex-wrap gap-2">
          {can(PERMISSIONS.DOCUMENT_REGISTER) && <LinkButton href="/documents/new" variant="secondary">Register Document</LinkButton>}
          {can(PERMISSIONS.PRINT_REQUEST) && <LinkButton href="/print-requests/new" variant="secondary">Request Controlled Print</LinkButton>}
          {can(PERMISSIONS.COPY_ISSUE) && <LinkButton href="/copies" variant="secondary">Issue Copy</LinkButton>}
          <LinkButton href="/verify" variant="secondary">Scan QR</LinkButton>
          {can(PERMISSIONS.RECALL_INITIATE) && <LinkButton href="/recalls" variant="secondary">Initiate Recall</LinkButton>}
          {can(PERMISSIONS.AUDIT_READ) && <LinkButton href="/reports" variant="secondary">Generate Audit Report</LinkButton>}
        </div>
      </Card>
    </div>
  );
}
