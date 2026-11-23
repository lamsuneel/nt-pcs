'use client';

import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Table, Th, Td, StatusBadge } from '@/components/ui';

export default function UsersPage() {
  const { data } = useSWRLite<{ users: any[] }>('/api/meta/users');
  const rows = data?.users ?? [];

  return (
    <div>
      <PageHeader title="Users & Roles" subtitle="RBAC is enforced at the API layer, not only in the UI. Default roles: System Administrator, QA Head, Document Controller, QA Manager, Department Head, Employee, Auditor." />
      <Table>
        <thead><tr><Th>Name</Th><Th>Email</Th><Th>Roles</Th><Th>Status</Th></tr></thead>
        <tbody>
          {rows.map((u: any) => (
            <tr key={u.id}>
              <Td>{u.fullName}</Td>
              <Td className="text-nt-muted font-mono text-xs">{u.email}</Td>
              <Td>{u.roles.map((r: string) => <StatusBadge key={r} status={r} />)}</Td>
              <Td><StatusBadge status={u.isActive ? 'ACTIVE' : 'INACTIVE'} /></Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
}
