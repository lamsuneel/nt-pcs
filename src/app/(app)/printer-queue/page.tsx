'use client';

import { useState } from 'react';
import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Card, Button, StatusBadge, Table, Th, Td, RequirePermission, EmptyState } from '@/components/ui';
import { usePermissions } from '@/lib/use-permissions';

interface Printer {
  id: string;
  name: string;
  siteId: string;
  connectionEndpoint: string | null;
  supportedPaperSizes: string[];
  isApproved: boolean;
  status: 'ACTIVE' | 'PAUSED' | 'CIRCUIT_OPEN';
  consecutiveFailures: number;
  circuitOpenUntil: string | null;
}

interface PrintJob {
  id: string;
  printerId: string;
  status: string;
  priority: string;
  source: string;
  requestedPages: number;
  confirmedPages: number | null;
  attempts: number;
  lastError: string | null;
  exceptionReason: string | null;
  queuedAt: string;
}

export default function PrinterQueuePage() {
  const { data, refetch } = useSWRLite<{ printers: Printer[] }>('/api/printers');
  const { data: jobsData, refetch: refetchJobs } = useSWRLite<{ jobs: PrintJob[] }>('/api/printers/jobs/all');
  const { data: org } = useSWRLite<{ sites: any[] }>('/api/meta/org');
  const { can, loading: permLoading, PERMISSIONS } = usePermissions();

  const printers = data?.printers ?? [];
  const jobs = jobsData?.jobs ?? [];
  const sites = org?.sites ?? [];

  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: '', siteId: '', connectionEndpoint: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function createPrinter(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const res = await fetch('/api/printers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, connectionEndpoint: form.connectionEndpoint || null }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Failed to create printer');
      return;
    }
    setForm({ name: '', siteId: '', connectionEndpoint: '' });
    setShowNew(false);
    refetch();
  }

  async function action(printerId: string, path: 'reset-circuit' | 'pause' | 'resume') {
    await fetch(`/api/printers/${printerId}/${path}`, { method: 'POST' });
    refetch();
  }

  const jobsByPrinter = jobs.reduce<Record<string, PrintJob[]>>((acc, j) => {
    (acc[j.printerId] ??= []).push(j);
    return acc;
  }, {});

  return (
    <div>
      <PageHeader
        title="Printer & Queue"
        subtitle="Every printer is its own isolated queue — a stuck or offline printer only ever delays jobs bound for it. A printer that fails repeatedly trips its circuit breaker and stops being routed to automatically until it recovers."
        actions={
          <RequirePermission allowed={can(PERMISSIONS.PRINT_ISSUE)} loading={permLoading}>
            <Button onClick={() => setShowNew((v) => !v)}>{showNew ? 'Cancel' : 'Register Printer'}</Button>
          </RequirePermission>
        }
      />

      {showNew && (
        <Card className="mb-6 max-w-xl">
          <form onSubmit={createPrinter} className="space-y-4">
            <Field label="Printer name">
              <input
                className="nt-input"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="QA-Printer-01, or QA-Printer-01 (flaky) to test retry behavior"
                required
              />
            </Field>
            <Field label="Site">
              <select className="nt-input" value={form.siteId} onChange={(e) => setForm((f) => ({ ...f, siteId: e.target.value }))} required>
                <option value="">Select site</option>
                {sites.map((s: any) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Connection endpoint (optional)">
              <input
                className="nt-input"
                value={form.connectionEndpoint}
                onChange={(e) => setForm((f) => ({ ...f, connectionEndpoint: e.target.value }))}
                placeholder="Leave blank to use the simulated driver — no real hardware required"
              />
            </Field>
            {error && <div className="text-nt-blocked text-sm">{error}</div>}
            <Button type="submit" disabled={submitting}>{submitting ? 'Creating...' : 'Create Printer'}</Button>
          </form>
        </Card>
      )}

      {printers.length === 0 ? (
        <EmptyState message="No printers registered yet. Register one (the simulated driver works with no real hardware) to start dispatching print jobs." />
      ) : (
        <div className="space-y-4">
          {printers.map((p) => {
            const pJobs = jobsByPrinter[p.id] ?? [];
            const deadLetterCount = pJobs.filter((j) => j.status === 'DEAD_LETTER').length;
            const queuedCount = pJobs.filter((j) => j.status === 'QUEUED' || j.status === 'DISPATCHED').length;
            return (
              <Card key={p.id}>
                <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
                  <div>
                    <div className="text-nt-text font-medium">{p.name}</div>
                    <div className="text-nt-muted text-xs mt-0.5 font-mono">
                      {p.connectionEndpoint ?? 'simulated driver'} · queue: print-jobs:{p.id.slice(0, 8)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={p.status} />
                    {p.status === 'CIRCUIT_OPEN' && (
                      <Button variant="secondary" onClick={() => action(p.id, 'reset-circuit')}>
                        Force-close circuit
                      </Button>
                    )}
                    {p.status === 'PAUSED' ? (
                      <Button variant="secondary" onClick={() => action(p.id, 'resume')}>Resume</Button>
                    ) : (
                      <Button variant="ghost" onClick={() => action(p.id, 'pause')}>Pause</Button>
                    )}
                  </div>
                </div>
                <div className="flex gap-4 text-xs text-nt-muted mb-3">
                  <span>In queue: {queuedCount}</span>
                  <span>Consecutive failures: {p.consecutiveFailures}</span>
                  {deadLetterCount > 0 && <span className="text-nt-blocked">Dead-lettered: {deadLetterCount}</span>}
                  {p.circuitOpenUntil && new Date(p.circuitOpenUntil) > new Date() && (
                    <span>Circuit cools down until {new Date(p.circuitOpenUntil).toLocaleTimeString()}</span>
                  )}
                </div>
                {pJobs.length > 0 && (
                  <Table>
                    <thead>
                      <tr><Th>Status</Th><Th>Priority</Th><Th>Source</Th><Th>Pages</Th><Th>Attempts</Th><Th>Queued</Th><Th>Last error</Th></tr>
                    </thead>
                    <tbody>
                      {pJobs.slice(0, 10).map((j) => (
                        <tr key={j.id}>
                          <Td><StatusBadge status={j.status} /></Td>
                          <Td>{j.priority}</Td>
                          <Td className="text-xs text-nt-muted">{j.source}</Td>
                          <Td>{j.confirmedPages ?? '—'} / {j.requestedPages}</Td>
                          <Td>{j.attempts}</Td>
                          <Td className="text-xs text-nt-muted">{new Date(j.queuedAt).toLocaleString()}</Td>
                          <Td className="text-xs text-nt-blocked">{j.lastError ?? j.exceptionReason ?? ''}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs text-nt-muted block mb-1">{label}</label>
      {children}
    </div>
  );
}
