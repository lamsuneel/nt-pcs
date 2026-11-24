'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Card, StatusBadge, Button, LinkButton, Table, Th, Td } from '@/components/ui';

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, refetch } = useSWRLite<{ document: any; revisions: any[] }>(`/api/documents/${id}`);
  const [busy, setBusy] = useState<string | null>(null);

  if (!data) return null;
  const { document: doc, revisions } = data;

  async function approveRevision(revisionId: string) {
    setBusy(revisionId);
    await fetch(`/api/documents/${id}/revisions/${revisionId}/approve`, { method: 'POST' });
    setBusy(null);
    refetch();
  }

  async function newRevision() {
    setBusy('new');
    await fetch(`/api/documents/${id}/revisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changeSummary: 'New revision registered from Document Register' }),
    });
    setBusy(null);
    refetch();
  }

  return (
    <div>
      <PageHeader
        title={doc.title}
        subtitle={`${doc.documentNumber} · ${doc.documentType.replace(/_/g, ' ')}`}
        actions={
          <>
            <LinkButton href={`/print-requests/new?documentId=${doc.id}`} variant="secondary">Request Controlled Print</LinkButton>
            <Button onClick={newRevision} disabled={busy === 'new'}>{busy === 'new' ? 'Working...' : 'Register New Revision'}</Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><div className="text-nt-muted text-xs">Master copy location</div><div className="text-nt-text text-sm mt-1">{doc.masterCopyLocation ?? '—'}</div></Card>
        <Card><div className="text-nt-muted text-xs">Source</div><div className="text-nt-text text-sm mt-1">{doc.hasNoFileYet ? 'Paper master only' : 'Digital source on file'}</div></Card>
        <Card><div className="text-nt-muted text-xs">Confidentiality</div><div className="text-nt-text text-sm mt-1">{doc.confidentiality.replace(/_/g, ' ')}</div></Card>
      </div>

      <div className="font-display text-sm text-nt-text mb-3">Revision history</div>
      <Table>
        <thead>
          <tr>
            <Th>Revision</Th><Th>Status</Th><Th>Effective Date</Th><Th>Review Due</Th><Th>Change Summary</Th><Th></Th>
          </tr>
        </thead>
        <tbody>
          {revisions.map((r: any) => (
            <tr key={r.id}>
              <Td className="font-mono text-nt-teal">Rev {r.revisionLabel}</Td>
              <Td><StatusBadge status={r.approvalStatus} /></Td>
              <Td className="text-nt-muted">{r.effectiveDate ? new Date(r.effectiveDate).toLocaleDateString() : '—'}</Td>
              <Td className="text-nt-muted">{r.reviewDueDate ? new Date(r.reviewDueDate).toLocaleDateString() : '—'}</Td>
              <Td className="text-nt-muted">{r.changeSummary ?? '—'}</Td>
              <Td>
                {r.approvalStatus !== 'APPROVED' && (
                  <Button variant="secondary" onClick={() => approveRevision(r.id)} disabled={busy === r.id}>
                    {busy === r.id ? 'Approving...' : 'Approve'}
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
