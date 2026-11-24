'use client';

import { useState } from 'react';
import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, LinkButton, Table, Th, Td, StatusBadge, Button, EmptyState } from '@/components/ui';
import { usePermissions } from '@/lib/use-permissions';

export default function PrintRequestsPage() {
  const { data, refetch } = useSWRLite<{ printRequests: any[] }>('/api/print-requests');
  const [busy, setBusy] = useState<string | null>(null);
  const rows = data?.printRequests ?? [];
  const { can, PERMISSIONS } = usePermissions();

  async function act(id: string, action: 'approve' | 'reject' | 'issue') {
    setBusy(id + action);
    const comments = action === 'reject' ? prompt('Reason for rejection?') ?? '' : undefined;
    await fetch(`/api/print-requests/${id}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comments }),
    });
    setBusy(null);
    refetch();
  }

  return (
    <div>
      <PageHeader
        title="Print Requests"
        subtitle="Request, approve and issue controlled prints. Issuing generates unique copy IDs, QR codes and server-side PDFs."
        actions={can(PERMISSIONS.PRINT_REQUEST) ? <LinkButton href="/print-requests/new">Request Controlled Print</LinkButton> : undefined}
      />

      {rows.length === 0 && <EmptyState message="No print requests yet." />}

      {rows.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>Requested</Th><Th>Copies</Th><Th>Destination</Th><Th>Classification</Th><Th>Status</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="text-nt-muted">{new Date(r.requestedAt).toLocaleString()}</Td>
                <Td>{r.numberOfCopies}</Td>
                <Td className="text-nt-muted">{r.destinationLocation}</Td>
                <Td><StatusBadge status={r.classification} /></Td>
                <Td><StatusBadge status={r.status} /></Td>
                <Td className="space-x-2 whitespace-nowrap">
                  {r.status === 'REQUESTED' && can(PERMISSIONS.PRINT_APPROVE) && (
                    <>
                      <Button variant="secondary" onClick={() => act(r.id, 'approve')} disabled={!!busy}>Approve</Button>
                      <Button variant="danger" onClick={() => act(r.id, 'reject')} disabled={!!busy}>Reject</Button>
                    </>
                  )}
                  {r.status === 'APPROVED' && can(PERMISSIONS.PRINT_ISSUE) && (
                    <Button onClick={() => act(r.id, 'issue')} disabled={!!busy}>
                      {busy === r.id + 'issue' ? 'Generating PDFs...' : 'Issue & Generate Copies'}
                    </Button>
                  )}
                  {r.status === 'REQUESTED' && !can(PERMISSIONS.PRINT_APPROVE) && <span className="text-nt-muted2 text-xs">Awaiting QA Head/Manager</span>}
                  {r.status === 'APPROVED' && !can(PERMISSIONS.PRINT_ISSUE) && <span className="text-nt-muted2 text-xs">Awaiting Document Controller</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
