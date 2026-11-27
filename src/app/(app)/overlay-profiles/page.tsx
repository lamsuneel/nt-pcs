'use client';

import { useState } from 'react';
import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Card, Button, RequirePermission, EmptyState } from '@/components/ui';
import { usePermissions } from '@/lib/use-permissions';

interface StampField {
  key: string;
  label: string;
  value: string;
  page: 'first' | 'all';
  x: number;
  y: number;
  fontSize: number;
  bold: boolean;
}

interface OverlayProfile {
  id: string;
  name: string;
  paperSize: string;
  logoFileKey: string | null;
  stampFields: StampField[];
  isDefault: boolean;
}

// Matches the reference stamped-SOP convention (Master Copy / Reviewed — No
// Change / Next Review Date / Reviewed By / Date). The Document Controller
// edits values and positions from here; these are just sane starting
// points so a profile is usable in one pass instead of five blank rows.
const STARTER_FIELDS: StampField[] = [
  { key: 'master_copy', label: '', value: 'MASTER COPY', page: 'first', x: 220, y: 780, fontSize: 14, bold: true },
  { key: 'reviewed', label: '', value: 'REVIEWED — NO CHANGE', page: 'first', x: 180, y: 760, fontSize: 11, bold: true },
  { key: 'next_review', label: 'Next Review Date', value: '', page: 'first', x: 50, y: 150, fontSize: 9, bold: false },
  { key: 'reviewed_by', label: 'Reviewed By', value: '', page: 'first', x: 50, y: 135, fontSize: 9, bold: false },
  { key: 'review_date', label: 'Date', value: '', page: 'first', x: 50, y: 120, fontSize: 9, bold: false },
];

export default function OverlayProfilesPage() {
  const { data, refetch } = useSWRLite<{ overlayProfiles: OverlayProfile[] }>('/api/overlay-profiles');
  const { can, loading: permLoading, PERMISSIONS } = usePermissions();
  const profiles = data?.overlayProfiles ?? [];

  const [showNew, setShowNew] = useState(false);
  const [name, setName] = useState('');
  const [logoDataUrl, setLogoDataUrl] = useState<string | null>(null);
  const [fields, setFields] = useState<StampField[]>(STARTER_FIELDS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setLogoDataUrl(reader.result as string);
    reader.readAsDataURL(file);
  }

  function updateField(idx: number, patch: Partial<StampField>) {
    setFields((f) => f.map((field, i) => (i === idx ? { ...field, ...patch } : field)));
  }

  async function createProfile(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    const res = await fetch('/api/overlay-profiles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, stampFields: fields, logoDataUrl }),
    });
    setSubmitting(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error || 'Failed to create overlay profile');
      return;
    }
    setName('');
    setLogoDataUrl(null);
    setFields(STARTER_FIELDS);
    setShowNew(false);
    refetch();
  }

  return (
    <div>
      <PageHeader
        title="Print Review — Overlay & Stamps"
        subtitle="Your logo and controlled-copy stamps (Master Copy, Reviewed — No Change, Next Review Date, etc.), laid out once per profile and assigned to documents at registration — not re-resolved on every print."
        actions={
          <RequirePermission allowed={can(PERMISSIONS.DOCUMENT_REGISTER)} loading={permLoading}>
            <Button onClick={() => setShowNew((v) => !v)}>{showNew ? 'Cancel' : 'New Overlay Profile'}</Button>
          </RequirePermission>
        }
      />

      {showNew && (
        <Card className="mb-6 max-w-3xl">
          <form onSubmit={createProfile} className="space-y-5">
            <div>
              <label className="text-xs text-nt-muted block mb-1">Profile name</label>
              <input className="nt-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="BeNova Labs — Standard SOP Stamp" required />
            </div>

            <div>
              <label className="text-xs text-nt-muted block mb-1">Logo (PNG or JPEG)</label>
              <input type="file" accept="image/png,image/jpeg" onChange={onLogoFile} className="text-sm text-nt-muted" />
              {logoDataUrl && <img src={logoDataUrl} alt="Logo preview" className="h-12 mt-2 object-contain" />}
            </div>

            <div>
              <div className="text-xs text-nt-muted uppercase tracking-wide mb-2">Stamp fields</div>
              <div className="space-y-2">
                {fields.map((field, idx) => (
                  <div key={field.key} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      className="nt-input col-span-3 text-xs"
                      value={field.label}
                      onChange={(e) => updateField(idx, { label: e.target.value })}
                      placeholder="Label (optional)"
                    />
                    <input
                      className="nt-input col-span-4 text-xs"
                      value={field.value}
                      onChange={(e) => updateField(idx, { value: e.target.value })}
                      placeholder="Value"
                    />
                    <input
                      type="number"
                      className="nt-input col-span-1 text-xs"
                      value={field.x}
                      onChange={(e) => updateField(idx, { x: Number(e.target.value) })}
                      title="X position"
                    />
                    <input
                      type="number"
                      className="nt-input col-span-1 text-xs"
                      value={field.y}
                      onChange={(e) => updateField(idx, { y: Number(e.target.value) })}
                      title="Y position"
                    />
                    <select
                      className="nt-input col-span-2 text-xs"
                      value={field.page}
                      onChange={(e) => updateField(idx, { page: e.target.value as 'first' | 'all' })}
                    >
                      <option value="first">First page</option>
                      <option value="all">All pages</option>
                    </select>
                    <label className="col-span-1 text-xs text-nt-muted flex items-center gap-1">
                      <input type="checkbox" checked={field.bold} onChange={(e) => updateField(idx, { bold: e.target.checked })} />
                      Bold
                    </label>
                  </div>
                ))}
              </div>
              <button
                type="button"
                className="text-xs text-nt-teal mt-2"
                onClick={() =>
                  setFields((f) => [...f, { key: `field_${f.length}_${Date.now()}`, label: '', value: '', page: 'all', x: 50, y: 100, fontSize: 9, bold: false }])
                }
              >
                + Add field
              </button>
            </div>

            {error && <div className="text-nt-blocked text-sm">{error}</div>}
            <Button type="submit" disabled={submitting}>{submitting ? 'Saving...' : 'Save Overlay Profile'}</Button>
          </form>
        </Card>
      )}

      {profiles.length === 0 ? (
        <EmptyState message="No overlay profiles yet. Create one to control exactly what appears on printed copies — logo, Master Copy / Reviewed stamps, and their positions." />
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {profiles.map((p) => (
            <Card key={p.id}>
              <div className="flex items-center justify-between mb-2">
                <div className="text-nt-text font-medium">{p.name}</div>
                {p.isDefault && <span className="text-xs text-nt-teal">Default</span>}
              </div>
              <div className="text-nt-muted text-xs mb-3">{p.stampFields.length} stamp field(s) · {p.paperSize}</div>
              <a href={`/api/overlay-profiles/${p.id}/preview`} target="_blank" rel="noreferrer" className="text-xs text-nt-teal underline">
                Preview against a sample document →
              </a>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
