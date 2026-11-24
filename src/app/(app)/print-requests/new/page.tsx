'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Card, Button, RequirePermission } from '@/components/ui';
import { usePermissions } from '@/lib/use-permissions';

export default function NewPrintRequestPage() {
  const router = useRouter();
  const search = useSearchParams();
  const { data: docsData } = useSWRLite<{ documents: any[] }>('/api/documents');
  const { data: org } = useSWRLite<{ departments: any[] }>('/api/meta/org');
  const { can, loading: permLoading, PERMISSIONS } = usePermissions();

  const [form, setForm] = useState({
    documentId: search.get('documentId') ?? '',
    numberOfCopies: 1,
    departmentId: '',
    destinationLocation: '',
    intendedPurpose: '',
    reasonForPrinting: '',
    printer: '',
    classification: 'CONTROLLED',
  });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const res = await fetch('/api/print-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, numberOfCopies: Number(form.numberOfCopies) }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Failed to submit request');
      return;
    }
    router.push('/print-requests');
  }

  const docs = (docsData?.documents ?? []).filter((d) => d.currentRevisionId);
  const departments = org?.departments ?? [];

  return (
    <div className="max-w-2xl">
      <PageHeader title="Request Controlled Print" subtitle="Only approved revisions can be requested for controlled printing." />
      <RequirePermission allowed={can(PERMISSIONS.PRINT_REQUEST)} loading={permLoading}>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Document">
            <select className="nt-input" value={form.documentId} onChange={(e) => set('documentId', e.target.value)} required>
              <option value="">Select document</option>
              {docs.map((d: any) => <option key={d.id} value={d.id}>{d.documentNumber} — {d.title}</option>)}
            </select>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Number of copies">
              <input type="number" min={1} className="nt-input" value={form.numberOfCopies} onChange={(e) => set('numberOfCopies', Number(e.target.value) as any)} />
            </Field>
            <Field label="Classification">
              <select className="nt-input" value={form.classification} onChange={(e) => set('classification', e.target.value)}>
                <option value="CONTROLLED">Controlled</option>
                <option value="UNCONTROLLED_REFERENCE">Uncontrolled reference</option>
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Receiving department">
              <select className="nt-input" value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)} required>
                <option value="">Select department</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Destination location">
              <input className="nt-input" value={form.destinationLocation} onChange={(e) => set('destinationLocation', e.target.value)} placeholder="Production Block A - Line 2" required />
            </Field>
          </div>
          <Field label="Reason for printing">
            <input className="nt-input" value={form.reasonForPrinting} onChange={(e) => set('reasonForPrinting', e.target.value)} required />
          </Field>
          <Field label="Printer">
            <input className="nt-input" value={form.printer} onChange={(e) => set('printer', e.target.value)} placeholder="QA-Printer-01" />
          </Field>

          {error && <div className="text-nt-blocked text-sm">{error}</div>}
          <Button type="submit" disabled={submitting}>{submitting ? 'Submitting...' : 'Submit Request'}</Button>
        </form>
      </Card>
      </RequirePermission>
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
