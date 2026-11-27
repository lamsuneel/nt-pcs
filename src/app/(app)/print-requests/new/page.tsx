'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Card, Button, RequirePermission } from '@/components/ui';
import { usePermissions } from '@/lib/use-permissions';

interface DriveSearchResult {
  externalRef: string;
  name: string;
  modifiedTime: string | null;
  webViewLink: string | null;
  linkedDocumentId: string | null;
  linkedDocumentNumber: string | null;
}

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

  // Google Drive document picker — replaces the old "select from our
  // document list" dropdown. Typing searches Drive directly; only a result
  // already linked to an approved controlled document can actually be
  // selected (resolve confirms that server-side before it's accepted).
  const [driveQuery, setDriveQuery] = useState('');
  const [driveResults, setDriveResults] = useState<DriveSearchResult[]>([]);
  const [driveNote, setDriveNote] = useState('');
  const [driveSearching, setDriveSearching] = useState(false);
  const [selectedLabel, setSelectedLabel] = useState('');
  const [resolveError, setResolveError] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-register-on-select: picking a Drive file that has no document yet
  // creates one on the spot (DRAFT, documentType PENDING_CLASSIFICATION) so
  // it has an immediate tracking ID and shows up in the Document Register
  // for a Controller to classify and approve. The print request still can't
  // be submitted until that approval happens — see print.ts.
  const [registering, setRegistering] = useState<string | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  // If arriving with a documentId already set (e.g. from a document's own
  // "Request Controlled Print" button), show its name instead of blanking
  // the field until the person searches Drive again.
  useEffect(() => {
    if (form.documentId && !selectedLabel) {
      const d = (docsData?.documents ?? []).find((x) => x.id === form.documentId);
      if (d) setSelectedLabel(`${d.documentNumber} — ${d.title}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docsData, form.documentId]);

  async function runDriveSearch(value: string) {
    if (!value.trim()) return;
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
      // Always clear the loading state, even on a network error or timeout
      // — this is what was leaving the box stuck on "Searching..." forever.
      setDriveSearching(false);
    }
  }

  function onDriveQueryChange(value: string) {
    setDriveQuery(value);
    setResolveError('');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      setDriveResults([]);
      setDriveNote('');
      return;
    }
    debounceRef.current = setTimeout(() => runDriveSearch(value), 350);
  }

  async function pickDriveResult(result: DriveSearchResult) {
    setResolveError('');
    setResolving(result.externalRef);
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      const res = await fetch(`/api/integrations/google-drive/resolve?fileId=${encodeURIComponent(result.externalRef)}`, { signal: controller.signal });
      clearTimeout(timeout);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResolveError(body.error || 'This file could not be resolved to an approved document.');
        return;
      }
      set('documentId', body.documentId);
      setSelectedLabel(`${body.documentNumber} — rev ${body.revisionLabel} (from Google Drive: ${result.name})`);
      setDriveQuery('');
      setDriveResults([]);
    } catch (err) {
      setResolveError(
        err instanceof Error && err.name === 'AbortError'
          ? 'Resolving this file timed out — try again.'
          : 'Could not reach the server to resolve this file — try again.'
      );
    } finally {
      setResolving(null);
    }
  }

  // Click an unlinked result: create its tracking record immediately, then
  // select it. It won't be submittable as a print yet (still DRAFT) — the
  // success message says so — but it now exists in the Document Register
  // for a Controller to pick up.
  async function registerAndSelect(result: DriveSearchResult) {
    setResolveError('');
    setInfoMessage('');
    setRegistering(result.externalRef);
    const res = await fetch('/api/documents/from-drive-request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalRef: result.externalRef, name: result.name }),
    });
    const body = await res.json().catch(() => ({}));
    setRegistering(null);
    if (!res.ok) {
      setResolveError(body.error || 'Could not create a tracking record for this file.');
      return;
    }
    const doc = body.document;
    setDriveQuery('');
    setDriveResults([]);
    setInfoMessage(
      `Tracking ID ${doc.documentNumber} created for "${result.name}" — it's now in the Document Register awaiting QA classification and approval. ` +
        `You'll be able to submit this print once a Document Controller approves it.`
    );
  }

  function clearSelection() {
    set('documentId', '');
    setSelectedLabel('');
  }

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

  const departments = org?.departments ?? [];

  return (
    <div className="max-w-2xl">
      <PageHeader title="Request Controlled Print" subtitle="Search Google Drive to pick up the file to print. Approved documents can be selected directly; an unlinked file gets a tracking ID and goes to QA for classification and approval." />
      <RequirePermission allowed={can(PERMISSIONS.PRINT_REQUEST)} loading={permLoading}>
      <Card>
        <form onSubmit={submit} className="space-y-4">
          <Field label="Document (search Google Drive)">
            {selectedLabel ? (
              <div className="flex items-center justify-between nt-input">
                <span className="text-sm text-nt-text truncate">{selectedLabel}</span>
                <button type="button" onClick={clearSelection} className="text-xs text-nt-muted hover:text-nt-blocked ml-2 shrink-0">
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
                  <div className="absolute z-10 mt-1 w-full nt-card max-h-80 overflow-y-auto">
                    {driveResults.map((r) => (
                      <div
                        key={r.externalRef}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-nt-panel2 border-b border-nt-border/60 last:border-0 flex items-center justify-between gap-2"
                      >
                        <button type="button" onClick={() => (r.linkedDocumentId ? pickDriveResult(r) : undefined)} className="text-left flex-1 min-w-0" disabled={!r.linkedDocumentId || resolving === r.externalRef}>
                          <div className="text-nt-text truncate">{r.name}</div>
                          <div className="text-xs mt-0.5">
                            {resolving === r.externalRef ? (
                              <span className="text-nt-muted">Resolving...</span>
                            ) : r.linkedDocumentId ? (
                              <span className="text-nt-compliant">✓ Linked — {r.linkedDocumentNumber}</span>
                            ) : (
                              <span className="text-nt-flagged">Not yet linked to a controlled document</span>
                            )}
                          </div>
                        </button>
                        {!r.linkedDocumentId && (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => registerAndSelect(r)}
                            disabled={registering === r.externalRef}
                          >
                            {registering === r.externalRef ? 'Creating...' : 'Request & track'}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {resolveError && <div className="text-nt-blocked text-xs mt-1">{resolveError}</div>}
            {infoMessage && <div className="text-nt-compliant text-xs mt-1">{infoMessage}</div>}
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
          <Button type="submit" disabled={submitting || !form.documentId}>{submitting ? 'Submitting...' : 'Submit Request'}</Button>
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
