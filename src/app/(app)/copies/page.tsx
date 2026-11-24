'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Table, Th, Td, StatusBadge, EmptyState, Button } from '@/components/ui';
import Link from 'next/link';
import { usePermissions } from '@/lib/use-permissions';

const STATUS_FILTERS = ['ALL', 'PRINTED', 'ISSUED', 'ACTIVE', 'RECALL_PENDING', 'RETURNED', 'DESTROYED', 'LOST', 'DAMAGED'];

export default function CopiesPage() {
  const search = useSearchParams();
  const [status, setStatus] = useState(search.get('status') ?? 'ALL');
  const { data, refetch } = useSWRLite<{ copies: any[] }>(status === 'ALL' ? '/api/copies' : `/api/copies?status=${status}`);
  const [busy, setBusy] = useState<string | null>(null);
  const rows = data?.copies ?? [];
  const { can, PERMISSIONS } = usePermissions();

  async function distribute(id: string) {
    const physicalLocation = prompt('Physical location?') ?? '';
    if (!physicalLocation) return;
    setBusy(id);
    await fetch(`/api/copies/${id}/distribute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ physicalLocation, departmentId: rows.find((r) => r.id === id)?.issuedToDepartmentId }),
    });
    setBusy(null);
    refetch();
  }

  async function acknowledge(id: string) {
    setBusy(id);
    await fetch(`/api/copies/${id}/acknowledge`, { method: 'POST' });
    setBusy(null);
    refetch();
  }

  async function markStatus(id: string, newStatus: string) {
    setBusy(id);
    await fetch(`/api/copies/${id}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    setBusy(null);
    refetch();
  }

  return (
    <div>
      <PageHeader title="Controlled Copies" subtitle="Physical lifecycle of every printed controlled copy." />

      <div className="flex gap-2 mb-5 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-pill border ${status === s ? 'bg-nt-teal/15 text-nt-teal border-nt-teal/40' : 'text-nt-muted border-nt-border hover:text-nt-text'}`}
          >
            {s.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {rows.length === 0 && <EmptyState message="No copies in this status." />}

      {rows.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>Copy ID</Th><Th>Marking</Th><Th>Location</Th><Th>Print Outcome</Th><Th>Status</Th><Th></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <Td className="font-mono text-nt-teal text-xs">
                  <Link href={`/copies/${r.id}`} className="hover:underline">{r.copyIdentifier}</Link>
                </Td>
                <Td><StatusBadge status={r.marking} /></Td>
                <Td className="text-nt-muted">{r.destinationLocation ?? '—'}</Td>
                <Td className="text-nt-muted text-xs">{r.printOutcome ?? '—'}</Td>
                <Td><StatusBadge status={r.status} /></Td>
                <Td className="space-x-2 whitespace-nowrap">
                  {r.status === 'PRINTED' && can(PERMISSIONS.COPY_ISSUE) && <Button variant="secondary" onClick={() => distribute(r.id)} disabled={!!busy}>Issue</Button>}
                  {r.status === 'ISSUED' && can(PERMISSIONS.COPY_ACKNOWLEDGE) && <Button variant="secondary" onClick={() => acknowledge(r.id)} disabled={!!busy}>Acknowledge</Button>}
                  {['ISSUED', 'ACTIVE'].includes(r.status) && can(PERMISSIONS.COPY_INVENTORY_MANAGE) && (
                    <>
                      <Button variant="ghost" onClick={() => markStatus(r.id, 'LOST')} disabled={!!busy}>Lost</Button>
                      <Button variant="ghost" onClick={() => markStatus(r.id, 'DAMAGED')} disabled={!!busy}>Damaged</Button>
                    </>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
