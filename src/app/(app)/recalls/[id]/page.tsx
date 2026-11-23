'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Card, Table, Th, Td, StatusBadge, Button } from '@/components/ui';

export default function RecallDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, refetch } = useSWRLite<{ recall: any; items: any[]; copies: any[] }>(`/api/recalls/${id}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [closeError, setCloseError] = useState<any>(null);

  if (!data) return null;
  const { recall, items, copies } = data;
  const copyById = Object.fromEntries(copies.map((c: any) => [c.id, c]));

  async function act(itemId: string, action: string, body?: any) {
    setBusy(itemId + action);
    await fetch(`/api/recalls/items/${itemId}/${action}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    setBusy(null);
    refetch();
  }

  async function destroy(itemId: string) {
    const witnessName = prompt('Witness name for destruction?');
    if (!witnessName) return;
    await act(itemId, 'destroy', { witnessName });
  }

  async function requestException(itemId: string) {
    const reason = prompt('Reason for exception?');
    if (!reason) return;
    await act(itemId, 'exception', { reason });
  }

  async function closeRecall() {
    setCloseError(null);
    const res = await fetch(`/api/recalls/${id}/close`, { method: 'POST' });
    if (!res.ok) {
      setCloseError(await res.json());
      return;
    }
    refetch();
  }

  return (
    <div>
      <PageHeader
        title="Recall Reconciliation"
        subtitle={`Status: ${recall.status.replace(/_/g, ' ')}`}
        actions={<Button onClick={closeRecall} disabled={recall.status === 'RECONCILED'}>Close Recall</Button>}
      />

      {closeError && (
        <Card className="mb-5 border-nt-blocked/40">
          <div className="text-nt-blocked text-sm font-medium mb-2">{closeError.error}</div>
          <div className="text-nt-muted text-xs">{closeError.outstandingItems?.length} item(s) still unresolved — a recall cannot be marked complete while copies are outstanding.</div>
        </Card>
      )}

      <Table>
        <thead>
          <tr><Th>Copy</Th><Th>Status</Th><Th></Th></tr>
        </thead>
        <tbody>
          {items.map((item: any) => {
            const copy = copyById[item.controlledCopyId];
            return (
              <tr key={item.id}>
                <Td className="font-mono text-nt-teal text-xs">{copy?.copyIdentifier}</Td>
                <Td><StatusBadge status={item.status} /></Td>
                <Td className="space-x-2 whitespace-nowrap">
                  {item.status === 'RECALL_INITIATED' && (
                    <Button variant="secondary" onClick={() => act(item.id, 'acknowledge')} disabled={!!busy}>Acknowledge</Button>
                  )}
                  {item.status === 'RECALL_ACKNOWLEDGED' && (
                    <Button variant="secondary" onClick={() => act(item.id, 'retrieve')} disabled={!!busy}>Mark Retrieved</Button>
                  )}
                  {item.status === 'PHYSICALLY_RETRIEVED' && (
                    <Button onClick={() => destroy(item.id)} disabled={!!busy}>Confirm Destruction</Button>
                  )}
                  {!['DESTRUCTION_CONFIRMED', 'EXCEPTION_APPROVED'].includes(item.status) && (
                    <>
                      <Button variant="ghost" onClick={() => act(item.id, 'escalate')} disabled={!!busy}>Escalate</Button>
                      <Button variant="ghost" onClick={() => requestException(item.id)} disabled={!!busy}>Request Exception</Button>
                    </>
                  )}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </div>
  );
}
