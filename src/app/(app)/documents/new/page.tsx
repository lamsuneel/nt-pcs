'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Card, Button, RequirePermission } from '@/components/ui';
import { usePermissions } from '@/lib/use-permissions';

const DOC_TYPES = [
  'SOP', 'WI', 'BMR', 'BPR', 'STP', 'SPECIFICATION', 'FORMAT_CHECKLIST',
  'EQUIPMENT_SOP', 'CLEANING_PROCEDURE', 'CALIBRATION_PROCEDURE', 'SAFETY_PROCEDURE', 'QUALITY_MANUAL',
];

interface DriveSearchResult {
  externalRef: string;
  name: string;
  modifiedTime: string | null;
  webViewLink: string | null;
  linkedDocumentId: string | null;
  linkedDocumentNumber: string | null;
}

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

  // Google Drive search — lets the Controller pick up the already-approved
  // source file right here instead of issuing first and linking Drive
  // separately afterward. Optional: the document can still be issued with
  // no digital source (hasNoFileYet), same as before.
  const [driveQuery, setDriveQuery] = useState('');
  const [driveResults, setDriveResults] = useState<DriveSearchResult[]>([]);
  const [driveNote, setDriveNote] = useState('');
  const [driveSearching, setDriveSearching] = useState(false);
  const [selectedDrive, setSelectedDrive] = useState<DriveSearchResult | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function set<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  function onDriveQueryChange(value: string) {
    setDriveQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setDriveResults([]);
      setDriveNote('');
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setDriveSearching(true);
      setDriveNote('');
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 12000);
        const res = await fetch(`/api/integrations/google-drive/search?q=${encodeURIComponent(value)}`, { signal: controller.signal });
        clearTimeout(timeout);
        const body = await res.json().catch(() => ({ results: [] }));
        setDriveResults(body.results ?? []);
        setDriveNote(body.note ?? '');
      } catch (err) {
        setDriveResults([]);
        setDriveNote(
          err instanceof Error && err.name === 'AbortError'
            ? 'Google Drive search timed out — try again.'
            : 'Could not reach Google Drive search right now — try again.'
        );
      } finally {
        // Always clear the loading state, even on a network error or
        // timeout — this is what was leaving the box stuck on "Searching..."
        // forever with no result and no error shown.
        setDriveSearching(false);
      }
    }, 350);
  }

  function pickDrive(result: DriveSearchResult) {
    setSelectedDrive(result);
    if (!form.title) set('title', result.name.replace(/\.[^/.]+$/, ''));
    setDriveQuery('');
    setDriveResults([]);
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
        sourceFileProvided: !!selectedDrive,
        externalProvider: selectedDrive ? 'GOOGLE_DRIVE' : undefined,
        externalRef: selectedDrive ? selectedDrive.externalRef : undefined,
        paperApprovalReference: form.hasApprovalRef
          ? { referenceNumber: form.referenceNumber, approvedByName: form.approvedByName }
          : undefined,
      }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Failed to issue document');
      return;
    }
    const body = await res.json();
    router.push(`/documents/${body.document.id}`);
  }

  const departments = org?.departments ?? [];
  const sites = org?.sites ?? [];
  const willBeApproved = form.hasApprovalRef && form.approvedByName.trim().length > 0;

  return (
    <div className="max-w-2xl">
      <PageHeader title="Issue Document" subtitle="Works even with no DMS — this issues the document into the controlled register, with a reference to its signed paper master." />
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
          <Field label="Source file (search Google Drive, optional)">
            {selectedDrive ? (
              <div className="flex items-center justify-between nt-input">
                <span className="text-sm text-nt-text truncate">{selectedDrive.name}</span>
                <button type="button" onClick={() => setSelectedDrive(null)} className="text-xs text-nt-muted hover:text-nt-blocked ml-2 shrink-0">
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  className="nt-input"
                  value={driveQuery}
                  onChange={(e) => onDriveQueryChange(e.target.value)}
                  placeholder="Start typing a file name to search Google Drive..."
                />
                {driveSearching && <div className="text-xs text-nt-muted mt-1">Searching Google Drive...</div>}
                {driveNote && !driveSearching && <div className="text-xs text-nt-muted mt-1">{driveNote}</div>}
                {driveResults.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full nt-card max-h-64 overflow-y-auto">
                    {driveResults.map((r) => (
                      <button
                        key={r.externalRef}
                        type="button"
                        onClick={() => pickDrive(r)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-nt-panel2 border-b border-nt-border/60 last:border-0"
                      >
                        <div className="text-nt-text">{r.name}</div>
                        {r.linkedDocumentId && (
                          <div className="text-xs mt-0.5 text-nt-flagged">Already linked to {r.linkedDocumentNumber} — picking it will re-link it here instead</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <p className="text-nt-muted text-xs mt-1">
              Leave blank to issue with no digital source yet (paper master only) — you can link Drive from the document's page later.
            </p>
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
                  <input className="nt-input" value={form.approvedByName} onChange={(e) => set('approvedByName', e.target.value)} placeholder="Required to issue as APPROVED" />
                </Field>
              </div>
            )}
            <p className="text-nt-muted text-xs mt-2">
              This records evidence of the existing paper approval. It is not an electronic signature.
            </p>
            <p className={`text-xs mt-2 ${willBeApproved ? 'text-nt-compliant' : 'text-nt-flagged'}`}>
              {willBeApproved
                ? 'This document will be issued as APPROVED — a Requestor can select it for a controlled print immediately.'
                : 'Without an approver name, this is issued as DRAFT — a Document Controller must approve it on its own page before it can be printed.'}
            </p>
          </div>

          {error && <div className="text-nt-blocked text-sm">{error}</div>}
          <Button type="submit" disabled={submitting}>{submitting ? 'Issuing...' : willBeApproved ? 'Issue as Approved Document' : 'Issue Document (Draft)'}</Button>
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
