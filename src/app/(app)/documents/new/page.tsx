'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Card, Button, RequirePermission } from '@/components/ui';
import { usePermissions } from '@/lib/use-permissions';

const DOC_TYPES = [
  'SOP', 'WI', 'BMR', 'BPR', 'STP', 'SPECIFICATION', 'FORMAT_CHECKLIST',
  'EQUIPMENT_SOP', 'CLEANING_PROCEDURE', 'CALIBRATION_PROCEDURE', 'SAFETY_PROCEDURE', 'QUALITY_MANUAL',
];

export default function NewDocumentPage() {
  const router = useRouter();
  const { data: org } = useSWRLite<{ sites: any[]; departments: any[] }>('/api/meta/org');
  const { can, loading: permLoading, PERMISSIONS } = usePermissions();
  const [form, setForm] = useState({
    documentNumber: '', title: '', documentType: 'SOP', departmentId: '', siteId: '',
    masterCopyLocation: '', revisionLabel: '01',
    hasApprovalRef: true, referenceNumber: '', approvedByName: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const res = await fetch('/api/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        documentNumber: form.documentNumber,
        title: form.title,
        documentType: form.documentType,
        departmentId: form.departmentId,
        siteId: form.siteId,
        masterCopyLocation: form.masterCopyLocation,
        revisionLabel: form.revisionLabel,
        sourceFileProvided: false,
        paperApprovalReference: form.hasApprovalRef
          ? { referenceNumber: form.referenceNumber, approvedByName: form.approvedByName }
          : undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Failed to register document');
      return;
    }
    const body = await res.json();
    router.push(`/documents/${body.document.id}`);
  }

  const departments = org?.departments ?? [];
  const sites = org?.sites ?? [];

  return (
    <div className="max-w-2xl">
      <PageHeader title="Register Document" subtitle="Works even with no DMS — this registers the document and a reference to its signed paper master." />
      <RequirePermission allowed={can(PERMISSIONS.DOCUMENT_REGISTER)} loading={permLoading}>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Document Number">
              <input className="nt-input" value={form.documentNumber} onChange={(e) => set('documentNumber', e.target.value)} placeholder="SOP-PROD-005" required />
            </Field>
            <Field label="Document Type">
              <select className="nt-input" value={form.documentType} onChange={(e) => set('documentType', e.target.value)}>
                {DOC_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Title">
            <input className="nt-input" value={form.title} onChange={(e) => set('title', e.target.value)} required />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Site">
              <select className="nt-input" value={form.siteId} onChange={(e) => set('siteId', e.target.value)} required>
                <option value="">Select site</option>
                {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </Field>
            <Field label="Department">
              <select className="nt-input" value={form.departmentId} onChange={(e) => set('departmentId', e.target.value)} required>
                <option value="">Select department</option>
                {departments.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Physical master-copy location">
            <input className="nt-input" value={form.masterCopyLocation} onChange={(e) => set('masterCopyLocation', e.target.value)} placeholder="QA Document Control Room, Rack 3" />
          </Field>
          <Field label="Revision label">
            <input className="nt-input w-24" value={form.revisionLabel} onChange={(e) => set('revisionLabel', e.target.value)} />
          </Field>

          <div className="border-t border-nt-border pt-4">
            <label className="flex items-center gap-2 text-sm text-nt-text mb-3">
              <input type="checkbox" checked={form.hasApprovalRef} onChange={(e) => set('hasApprovalRef', e.target.checked)} />
              Record the existing paper approval reference
            </label>
            {form.hasApprovalRef && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Approval reference number">
                  <input className="nt-input" value={form.referenceNumber} onChange={(e) => set('referenceNumber', e.target.value)} />
                </Field>
                <Field label="Approved by (name)">
                  <input className="nt-input" value={form.approvedByName} onChange={(e) => set('approvedByName', e.target.value)} />
                </Field>
              </div>
            )}
            <p className="text-nt-muted text-xs mt-2">
              This records evidence of the existing paper approval. It is not an electronic signature.
            </p>
          </div>

          {error && <div className="text-nt-blocked text-sm">{error}</div>}
          <Button type="submit" disabled={submitting}>{submitting ? 'Registering...' : 'Register Document'}</Button>
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
