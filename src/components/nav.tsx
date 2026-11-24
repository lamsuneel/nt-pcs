'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clsx } from 'clsx';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview' },
  { href: '/documents', label: 'Document Register' },
  { href: '/print-requests', label: 'Print Requests' },
  { href: '/copies', label: 'Controlled Copies' },
  { href: '/copies', label: 'Distribution', hidden: true },
  { href: '/verify', label: 'QR Verification' },
  { href: '/recalls', label: 'Revision & Recall' },
  { href: '/reports', label: 'Audit Reports' },
  { href: '/users', label: 'Users & Roles' },
  { href: '/integrations', label: 'Integrations' },
  { href: '/onboarding', label: 'Settings' },
];

export function SideNav({ fullName, roles }: { fullName: string; roles: string[] }) {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  }

  return (
    <aside className="w-60 shrink-0 border-r border-nt-border bg-nt-panel min-h-screen flex flex-col">
      <div className="px-5 py-5 flex items-center gap-2 border-b border-nt-border">
        <div className="w-7 h-7 rounded-lg bg-nt-teal flex items-center justify-center text-nt-bg font-display font-semibold text-xs">PA</div>
        <div>
          <div className="font-display text-sm text-nt-text leading-tight">PrintAssure</div>
          <div className="text-[10px] text-nt-muted leading-tight">Print Control</div>
        </div>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.filter((i) => !i.hidden).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(
                'block rounded-lg px-3 py-2 text-sm transition',
                active ? 'bg-nt-teal/10 text-nt-teal font-medium' : 'text-nt-muted hover:text-nt-text hover:bg-nt-panel2'
              )}
            >
              {item.label}
            </Link>
          );
        })}
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
