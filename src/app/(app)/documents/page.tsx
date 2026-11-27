'use client';

import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, LinkButton, Table, Th, Td, StatusBadge, EmptyState } from '@/components/ui';
import Link from 'next/link';
import { usePermissions } from '@/lib/use-permissions';

interface DocRow {
  id: string;
  documentNumber: string;
  title: string;
  documentType: string;
  isActive: boolean;
  masterCopyLocation: string | null;
  hasNoFileYet: boolean;
}

export default function DocumentsPage() {
  const { data, loading } = useSWRLite<{ documents: DocRow[] }>('/api/documents');
  const docs = data?.documents ?? [];
  const { can, PERMISSIONS } = usePermissions();

  return (
    <div>
      <PageHeader
        title="Document Register"
        subtitle="The master register of controlled documents — works with or without a DMS."
        actions={can(PERMISSIONS.DOCUMENT_REGISTER) ? <LinkButton href="/documents/new">Issue Document</LinkButton> : undefined}
      />

      {!loading && docs.length === 0 && <EmptyState message="No documents registered yet." />}

      {docs.length > 0 && (
        <Table>
          <thead>
            <tr>
              <Th>Document #</Th>
              <Th>Title</Th>
              <Th>Type</Th>
              <Th>Master Location</Th>
              <Th>Source</Th>
              <Th></Th>
            </tr>
          </thead>
          <tbody>
            {docs.map((d) => (
              <tr key={d.id}>
                <Td className="font-mono text-nt-teal">{d.documentNumber}</Td>
                <Td>{d.title}</Td>
                <Td><StatusBadge status={d.documentType} /></Td>
                <Td className="text-nt-muted">{d.masterCopyLocation ?? '—'}</Td>
                <Td className="text-nt-muted">{d.hasNoFileYet ? 'Paper master only' : 'Digital source on file'}</Td>
                <Td>
                  <Link href={`/documents/${d.id}`} className="text-nt-teal text-xs hover:underline">
                    Open →
                  </Link>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </div>
  );
}
