'use client';

import { useState } from 'react';
import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, LinkButton, Table, Th, Td, StatusBadge, Button, EmptyState } from '@/components/ui';
import { usePermissions } from '@/lib/use-permissions';
import { ESignDialog } from '@/components/esign-dialog';

export default function PrintRequestsPage() {
  const { data, refetch } = useSWRLite<{ printRequests: any[] }>('/api/print-requests');
  const [busy, setBusy] = useState<string | null>(null);
  const rows = data?.printRequests ?? [];
  const { can, PERMISSIONS, session } = usePermissions();

  const [signingId, setSigningId] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);

  async function reject(id: string) {
    setBusy(id + 'reject');
    const comments = prompt('Reason for rejection?') ?? '';
    await fetch(`/api/print-requests/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comments }),
    });
    setBusy(null);
    refetch();
  }

  async function issue(id: string) {
    setBusy(id + 'issue');
    await fetch(`/api/print-requests/${id}/issue`, { method: 'POST' });
    setBusy(null);
    refetch();
  }

  async function confirmApprove(fullName: string) {
    if (!signingId) return;
    setBusy(signingId + 'approve');
    setSignError(null);
    const res = await fetch(`/api/print-requests/${signingId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signerFullName: fullName }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setSignError(body.error || 'Could not sign this approval.');
      return;
    }
    setSigningId(null);
    refetch();
  }

  return (
    <div>
      <PageHeader
        title="Print Requests"
        subtitle="Request, approve and issue controlled prints. Approving requires an electronic signature; issuing generates unique copy IDs, QR codes and server-side PDFs."
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
                      <Button variant="secondary" onClick={() => { setSigningId(r.id); setSignError(null); }} disabled={!!busy}>Approve</Button>
                      <Button variant="danger" onClick={() => reject(r.id)} disabled={!!busy}>Reject</Button>
                    </>
                  )}
                  {r.status === 'APPROVED' && (
                    <div className="inline-flex items-center gap-2">
                      {r.latestApproval?.approvalReferenceNumber && (
                        <span className="text-nt-muted2 text-[11px] font-mono" title={`e-signed by ${r.latestApproval.signerFullName}`}>
                          ref {r.latestApproval.approvalReferenceNumber}
                        </span>
                      )}
                      {can(PERMISSIONS.PRINT_ISSUE) && (
                        <Button onClick={() => issue(r.id)} disabled={!!busy}>
                          {busy === r.id + 'issue' ? 'Generating PDFs...' : 'Issue & Generate Copies'}
                        </Button>
                      )}
                    </div>
                  )}
                  {r.status === 'REQUESTED' && !can(PERMISSIONS.PRINT_APPROVE) && <span className="text-nt-muted2 text-xs">Awaiting QA Head/Manager</span>}
                  {r.status === 'APPROVED' && !can(PERMISSIONS.PRINT_ISSUE) && !r.latestApproval?.approvalReferenceNumber && <span className="text-nt-muted2 text-xs">Awaiting Document Controller</span>}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}

      <ESignDialog
        open={!!signingId}
        title="Electronically Sign Approval"
        description="This approval is recorded with a unique reference number and cannot be edited once signed."
        expectedName={session?.fullName ?? ''}
        busy={!!busy}
        error={signError}
        onCancel={() => { setSigningId(null); setSignError(null); }}
        onConfirm={confirmApprove}
      />
    </div>
  );
}
