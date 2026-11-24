'use client';

import useSWRLite from '@/lib/use-swr-lite';
import { KpiTile, PageHeader, LinkButton, Card } from '@/components/ui';

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

  return (
    <div>
      <PageHeader
        title="Overview"
        subtitle="Every printed GMP document, authorized, identifiable, traceable and accounted for."
        actions={
          <>
            <LinkButton href="/documents/new" variant="secondary">Register Document</LinkButton>
            <LinkButton href="/print-requests/new">Request Controlled Print</LinkButton>
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
          <LinkButton href="/documents/new" variant="secondary">Register Document</LinkButton>
          <LinkButton href="/print-requests/new" variant="secondary">Request Controlled Print</LinkButton>
          <LinkButton href="/copies" variant="secondary">Issue Copy</LinkButton>
          <LinkButton href="/verify" variant="secondary">Scan QR</LinkButton>
          <LinkButton href="/recalls" variant="secondary">Initiate Recall</LinkButton>
          <LinkButton href="/reports" variant="secondary">Generate Audit Report</LinkButton>
        </div>
      </Card>
    </div>
  );
}
