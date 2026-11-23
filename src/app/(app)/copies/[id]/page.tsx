'use client';

import { useParams } from 'next/navigation';
import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Card, StatusBadge, LinkButton } from '@/components/ui';

export default function CopyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data } = useSWRLite<{ copy: any; distributions: any[]; acknowledgements: any[] }>(`/api/copies/${id}`);
  if (!data) return null;
  const { copy, distributions, acknowledgements } = data;
  const verifyUrl = `/verify/${copy.qrToken}`;

  return (
    <div>
      <PageHeader
        title={copy.copyIdentifier}
        subtitle="Controlled copy lifecycle record"
        actions={
          <>
            <LinkButton href={`/api/copies/${id}/pdf`} variant="secondary">View / Download PDF</LinkButton>
            <LinkButton href={verifyUrl} variant="secondary">Open QR Verification Page</LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><div className="text-nt-muted text-xs">Status</div><div className="mt-2"><StatusBadge status={copy.status} /></div></Card>
        <Card><div className="text-nt-muted text-xs">Marking</div><div className="mt-2"><StatusBadge status={copy.marking} /></div></Card>
        <Card><div className="text-nt-muted text-xs">Print outcome</div><div className="text-nt-text text-sm mt-2">{copy.printOutcome ?? '—'} {copy.printOutcomeNote ? `(${copy.printOutcomeNote})` : ''}</div></Card>
      </div>

      <div className="font-display text-sm text-nt-text mb-3">Distribution history</div>
      <Card className="mb-6">
        {distributions.length === 0 ? <div className="text-nt-muted text-sm">Not yet issued to a location.</div> : (
          <ul className="space-y-2 text-sm">
            {distributions.map((d: any) => (
              <li key={d.id} className="text-nt-text">
                Issued to <span className="text-nt-teal">{d.physicalLocation}</span> on {new Date(d.issueDate).toLocaleString()}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="font-display text-sm text-nt-text mb-3">Acknowledgements</div>
      <Card>
        {acknowledgements.length === 0 ? <div className="text-nt-muted text-sm">Not yet acknowledged by the receiving department.</div> : (
          <ul className="space-y-2 text-sm">
            {acknowledgements.map((a: any) => (
              <li key={a.id} className="text-nt-text">Acknowledged {new Date(a.acknowledgementDate).toLocaleString()}</li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
