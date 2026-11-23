'use client';

import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Table, Th, Td, StatusBadge, EmptyState } from '@/components/ui';
import Link from 'next/link';

export default function RecallsPage() {
  const { data } = useSWRLite<{ recalls: any[] }>('/api/recalls');
  const rows = data?.recalls ?? [];

  return (
    <div>
      <PageHeader title="Revision & Recall" subtitle="New revisions trigger a recall of every active copy of the superseded revision — reconciliation is required before a recall can be closed." />
      {rows.length === 0 && <EmptyState message="No recalls yet." />}
      {rows.length > 0 && (
        <Table>
          <thead>
            <tr><Th>Initiated</Th><Th>Type</Th><Th>Status</Th><Th></Th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="text-nt-muted">{new Date(r.initiatedAt).toLocaleString()}</Td>
                <Td>{r.isEmergencyWithdrawal ? 'Emergency withdrawal' : 'Revision recall'}</Td>
                <Td><StatusBadge status={r.status} /></Td>
                <Td><Link href={`/recalls/${r.id}`} className="text-nt-teal text-xs hover:underline">Open →</Link></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
