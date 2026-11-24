import { clsx } from 'clsx';
import Link from 'next/link';
import React from 'react';

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={clsx('nt-card p-5', className)}>{children}</div>;
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
      <div>
        <h1 className="font-display text-2xl text-nt-text tracking-tight">{title}</h1>
        {subtitle && <p className="text-nt-muted text-sm mt-1 max-w-2xl">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const styles = {
    primary: 'bg-nt-teal text-nt-bg hover:bg-nt-tealDim',
    secondary: 'bg-nt-panel2 text-nt-text border border-nt-border hover:border-nt-teal/50',
    danger: 'bg-nt-blocked text-white hover:opacity-90',
    ghost: 'bg-transparent text-nt-muted hover:text-nt-text',
  };
  return (
    <button
      className={clsx('rounded-pill px-4 py-2 text-sm font-medium transition disabled:opacity-40 disabled:cursor-not-allowed', styles[variant], className)}
      {...props}
    >
      {children}
    </button>
  );
}

export function LinkButton({ href, children, variant = 'primary' }: { href: string; children: React.ReactNode; variant?: 'primary' | 'secondary' }) {
  const styles = {
    primary: 'bg-nt-teal text-nt-bg hover:bg-nt-tealDim',
    secondary: 'bg-nt-panel2 text-nt-text border border-nt-border hover:border-nt-teal/50',
  };
  return (
    <Link href={href} className={clsx('rounded-pill px-4 py-2 text-sm font-medium transition inline-block', styles[variant])}>
      {children}
    </Link>
  );
}

const STATUS_COLORS: Record<string, string> = {
  GREEN: 'bg-nt-compliant/15 text-nt-compliant border-nt-compliant/40',
  ACTIVE: 'bg-nt-compliant/15 text-nt-compliant border-nt-compliant/40',
  APPROVED: 'bg-nt-compliant/15 text-nt-compliant border-nt-compliant/40',
  DESTRUCTION_CONFIRMED: 'bg-nt-compliant/15 text-nt-compliant border-nt-compliant/40',
  RECONCILED: 'bg-nt-compliant/15 text-nt-compliant border-nt-compliant/40',
  AMBER: 'bg-nt-flagged/15 text-nt-flagged border-nt-flagged/40',
  ISSUED: 'bg-nt-flagged/15 text-nt-flagged border-nt-flagged/40',
  PRINTED: 'bg-nt-flagged/15 text-nt-flagged border-nt-flagged/40',
  REQUESTED: 'bg-nt-flagged/15 text-nt-flagged border-nt-flagged/40',
  RECALL_PENDING: 'bg-nt-flagged/15 text-nt-flagged border-nt-flagged/40',
  OUTSTANDING: 'bg-nt-flagged/15 text-nt-flagged border-nt-flagged/40',
  PARTIALLY_RECONCILED: 'bg-nt-flagged/15 text-nt-flagged border-nt-flagged/40',
  RED: 'bg-nt-blocked/15 text-nt-blocked border-nt-blocked/40',
  LOST: 'bg-nt-blocked/15 text-nt-blocked border-nt-blocked/40',
  DAMAGED: 'bg-nt-blocked/15 text-nt-blocked border-nt-blocked/40',
  REJECTED: 'bg-nt-blocked/15 text-nt-blocked border-nt-blocked/40',
  SUPERSEDED: 'bg-nt-blocked/15 text-nt-blocked border-nt-blocked/40',
  EXPIRED: 'bg-nt-blocked/15 text-nt-blocked border-nt-blocked/40',
  DESTROYED: 'bg-nt-muted/15 text-nt-muted border-nt-muted/40',
  GREY: 'bg-nt-muted/15 text-nt-muted border-nt-muted/40',
  DRAFT: 'bg-nt-muted/15 text-nt-muted border-nt-muted/40',
};

export function StatusBadge({ status }: { status: string }) {
  const style = STATUS_COLORS[status] ?? 'bg-nt-info/15 text-nt-info border-nt-info/40';
  return (
    <span className={clsx('inline-flex items-center rounded-pill border px-2.5 py-0.5 text-xs font-medium font-mono', style)}>
      {status.replace(/_/g, ' ')}
    </span>
  );
}

export function KpiTile({ label, value, href }: { label: string; value: string | number; href?: string }) {
  const content = (
    <Card className="hover:border-nt-teal/40 transition cursor-pointer">
      <div className="text-nt-muted text-xs uppercase tracking-wide">{label}</div>
      <div className="font-display text-3xl text-nt-text mt-2">{value}</div>
    </Card>
  );
  return href ? <Link href={href}>{content}</Link> : content;
}

export function EmptyState({ message }: { message: string }) {
  return <div className="text-nt-muted text-sm py-10 text-center">{message}</div>;
}

export function RequirePermission({
  allowed,
  loading,
  children,
}: {
  allowed: boolean;
  loading: boolean;
  children: React.ReactNode;
}) {
  if (loading) return null;
  if (!allowed) {
    return (
      <Card className="max-w-lg">
        <div className="text-nt-text text-sm font-medium mb-1">Not available for your role</div>
        <p className="text-nt-muted text-xs">
          Your current persona doesn&apos;t hold the permission this action requires. Switch to a role that does, or ask whoever
          holds it to carry it out.
        </p>
      </Card>
    );
  }
  return <>{children}</>;
}

export function Table({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto nt-card">
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function Th({ children }: { children?: React.ReactNode }) {
  return <th className="text-left text-nt-muted font-medium text-xs uppercase tracking-wide px-4 py-3 border-b border-nt-border">{children}</th>;
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={clsx('px-4 py-3 border-b border-nt-border/60 text-nt-text', className)}>{children}</td>;
}
