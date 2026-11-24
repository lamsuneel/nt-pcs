'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';
import { usePermissions } from '@/lib/use-permissions';
import { PERMISSIONS, PermissionKey } from '@/lib/permissions';

type NavItem = { href: string; label: string; requires?: PermissionKey[] };

const NAV_GROUPS: { label: string; tag?: 'pro' | 'max'; items: NavItem[] }[] = [
  {
    label: 'Basic',
    items: [
      { href: '/dashboard', label: 'Overview' },
      { href: '/documents', label: 'Document Register' },
      { href: '/print-requests', label: 'Print Requests' },
      { href: '/copies', label: 'Controlled Copies' },
      { href: '/verify', label: 'QR Verification' },
      { href: '/recalls', label: 'Revision & Recall' },
      { href: '/reports', label: 'Audit Reports', requires: [PERMISSIONS.AUDIT_READ] },
      { href: '/users', label: 'Users & Roles', requires: [PERMISSIONS.AUDIT_READ, PERMISSIONS.ADMIN_MANAGE] },
    ],
  },
  {
    label: 'Pro',
    tag: 'pro',
    items: [
      { href: '/audit-ledger', label: 'Audit Ledger', requires: [PERMISSIONS.AUDIT_READ] },
      { href: '/inventory-map', label: 'Inventory Map', requires: [PERMISSIONS.COPY_INVENTORY_MANAGE, PERMISSIONS.AUDIT_READ] },
      { href: '/recall-report', label: 'Recall Effectiveness', requires: [PERMISSIONS.AUDIT_READ, PERMISSIONS.RECALL_INITIATE] },
      { href: '/ask-audit', label: 'Ask the Audit Trail', requires: [PERMISSIONS.AUDIT_READ] },
      { href: '/integrations', label: 'Integration Events', requires: [PERMISSIONS.ADMIN_MANAGE, PERMISSIONS.AUDIT_READ] },
    ],
  },
  {
    label: 'Max',
    tag: 'max',
    items: [
      { href: '/print-server', label: 'Print Server', requires: [PERMISSIONS.ADMIN_MANAGE, PERMISSIONS.AUDIT_READ] },
      { href: '/follow-me', label: 'Follow-Me Print' },
      { href: '/mobile', label: 'Mobile App' },
      { href: '/anomalies', label: 'AI Anomaly Watch', requires: [PERMISSIONS.AUDIT_READ] },
      { href: '/inspection-pack', label: 'Inspection Pack', requires: [PERMISSIONS.AUDIT_READ] },
      { href: '/connectors', label: 'Connectors', requires: [PERMISSIONS.ADMIN_MANAGE] },
    ],
  },
];

export function SideNav({ fullName, roles }: { fullName: string; roles: string[] }) {
  const pathname = usePathname();
  const router = useRouter();
  const { canAny, loading } = usePermissions();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  // While the session permission check is in flight, show every item rather
  // than flashing an empty sidebar; items that aren't allowed disappear a
  // moment later once the role's permission set is known.
  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => loading || !i.requires || canAny(i.requires)),
  })).filter((g) => g.items.length > 0);

  return (
    <aside className="w-64 shrink-0 border-r border-nt-border bg-nt-panel min-h-screen flex flex-col">
      <div className="px-5 py-5 flex items-center gap-2 border-b border-nt-border">
        <div className="w-7 h-7 rounded-lg bg-nt-teal flex items-center justify-center text-nt-bg font-display font-semibold text-xs">PA</div>
        <div>
          <div className="font-display text-sm text-nt-text leading-tight">PrintAssure</div>
          <div className="text-[10px] text-nt-muted leading-tight">by NeuraTrace</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {groups.map((group) => (
          <div key={group.label} className="mb-3">
            <div className="flex items-center gap-1.5 px-3 pt-2 pb-1">
              <span className="text-[10px] font-semibold tracking-wider uppercase text-nt-muted2">{group.label}</span>
              {group.tag && (
                <span
                  className={clsx(
                    'text-[9px] font-bold tracking-wide rounded px-1.5 py-0.5',
                    group.tag === 'pro' && 'bg-nt-teal/15 text-nt-teal',
                    group.tag === 'max' && 'bg-nt-flagged/15 text-nt-flagged'
                  )}
                >
                  {group.tag.toUpperCase()}
                </span>
              )}
            </div>
            {group.items.map((item) => {
              const active = pathname === item.href || pathname.startsWith(item.href + '/');
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition',
                    active ? 'bg-nt-teal/10 text-nt-teal font-medium' : 'text-nt-muted hover:text-nt-text hover:bg-nt-panel2'
                  )}
                >
                  <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', active ? 'bg-nt-teal' : 'bg-nt-border')} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-nt-border">
        <div className="text-xs text-nt-text font-medium truncate">{fullName}</div>
        <div className="text-[10px] text-nt-muted truncate">{roles.join(', ')}</div>
        <button onClick={logout} className="mt-2 text-xs text-nt-muted hover:text-nt-blocked transition">
          Sign out
        </button>
      </div>
    </aside>
  );
}
