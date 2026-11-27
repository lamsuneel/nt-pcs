'use client';

import { useParams } from 'next/navigation';
import { useState } from 'react';
import useSWRLite from '@/lib/use-swr-lite';
import { PageHeader, Card, StatusBadge, Button, LinkButton, Table, Th, Td } from '@/components/ui';
import { usePermissions } from '@/lib/use-permissions';
import { ESignDialog } from '@/components/esign-dialog';

export default function DocumentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, refetch } = useSWRLite<{ document: any; revisions: any[] }>(`/api/documents/${id}`);
  const [busy, setBusy] = useState<string | null>(null);
  const { can, PERMISSIONS, session } = usePermissions();

  const [signingRevisionId, setSigningRevisionId] = useState<string | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const [driveRef, setDriveRef] = useState('');
  const [linkingDrive, setLinkingDrive] = useState(false);
  const [driveLinkError, setDriveLinkError] = useState('');

  // Reclassification — this document was auto-created the moment a
  // Requestor picked an unlinked Drive file (see /print-requests/new and
  // POST /api/documents/from-drive-request): it has a tracking ID but a
  // placeholder number/type. A Document Controller fills these in here
  // before it can meaningfully go through approval.
  const [classNumber, setClassNumber] = useState('');
  const [classType, setClassType] = useState('SOP');
  const [classifying, setClassifying] = useState(false);
  const [classifyError, setClassifyError] = useState('');

  if (!data) return null;
  const { document: doc, revisions } = data;
  const needsClassification = doc.documentType === 'PENDING_CLASSIFICATION';

  async function classify(e: React.FormEvent) {
    e.preventDefault();
    if (!classNumber.trim()) {
      setClassifyError('Give it a real document number before classifying.');
      return;
    }
    setClassifying(true);
    setClassifyError('');
    const res = await fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ documentNumber: classNumber.trim(), documentType: classType }),
    });
    setClassifying(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setClassifyError(body.error || 'Could not save classification.');
      return;
    }
    refetch();
  }

  async function linkGoogleDrive(e: React.FormEvent) {
    e.preventDefault();
    setLinkingDrive(true);
    setDriveLinkError('');
    // Accept either a raw file ID or a full Drive URL
    // (https://drive.google.com/file/d/<ID>/view or ?id=<ID>).
    const raw = driveRef.trim();
    const match = /\/d\/([a-zA-Z0-9_-]+)/.exec(raw) || /[?&]id=([a-zA-Z0-9_-]+)/.exec(raw);
    const fileId = match ? match[1] : raw;
    const res = await fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalProvider: 'GOOGLE_DRIVE', externalRef: fileId }),
    });
    setLinkingDrive(false);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setDriveLinkError(body.error || 'Failed to link this document to Google Drive');
      return;
    }
    setDriveRef('');
    refetch();
  }

  async function unlinkGoogleDrive() {
    await fetch(`/api/documents/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ externalProvider: null, externalRef: null }),
    });
    refetch();
  }

  async function confirmApprove(fullName: string) {
    if (!signingRevisionId) return;
    setBusy(signingRevisionId);
    setSignError(null);
    const res = await fetch(`/api/documents/${id}/revisions/${signingRevisionId}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ signerFullName: fullName }),
    });
    const body = await res.json().catch(() => ({}));
    setBusy(null);
    if (!res.ok) {
      setSignError(body.error || 'Could not sign this approval.');
      return;
    }
    setSigningRevisionId(null);
    refetch();
  }

  async function newRevision() {
    setBusy('new');
    await fetch(`/api/documents/${id}/revisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ changeSummary: 'New revision issued from Document Register' }),
    });
    setBusy(null);
    refetch();
  }

  return (
    <div>
      <PageHeader
        title={doc.title}
        subtitle={`${doc.documentNumber} · ${doc.documentType.replace(/_/g, ' ')}`}
        actions={
          <>
            <LinkButton href={`/print-requests/new?documentId=${doc.id}`} variant="secondary">Request Controlled Print</LinkButton>
            <Button onClick={newRevision} disabled={busy === 'new'}>{busy === 'new' ? 'Working...' : 'Issue New Revision'}</Button>
          </>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
        <Card><div className="text-nt-muted text-xs">Master copy location</div><div className="text-nt-text text-sm mt-1">{doc.masterCopyLocation ?? '—'}</div></Card>
        <Card><div className="text-nt-muted text-xs">Source</div><div className="text-nt-text text-sm mt-1">{doc.hasNoFileYet ? 'Paper master only' : 'Digital source on file'}</div></Card>
        <Card><div className="text-nt-muted text-xs">Confidentiality</div><div className="text-nt-text text-sm mt-1">{doc.confidentiality.replace(/_/g, ' ')}</div></Card>
      </div>

      {needsClassification && can(PERMISSIONS.DOCUMENT_REGISTER) && (
        <Card className="mb-6 max-w-xl border-nt-flagged/50">
          <div className="text-nt-text text-sm font-medium mb-1">Needs classification</div>
          <p className="text-nt-muted text-xs mb-3">
            This document was auto-created when a requestor picked it up from Google Drive — it has a tracking ID
            ({doc.documentNumber}) but no real document number or type yet, and its revision can't be approved until you set them.
          </p>
          <form onSubmit={classify} className="flex gap-2 items-start">
            <input
              className="nt-input text-sm flex-1"
              value={classNumber}
              onChange={(e) => setClassNumber(e.target.value)}
              placeholder="SOP-PROD-012"
              required
            />
            <select className="nt-input text-sm" value={classType} onChange={(e) => setClassType(e.target.value)}>
              {['SOP', 'WI', 'BMR', 'BPR', 'STP', 'SPECIFICATION', 'FORMAT_CHECKLIST', 'EQUIPMENT_SOP', 'CLEANING_PROCEDURE', 'CALIBRATION_PROCEDURE', 'SAFETY_PROCEDURE', 'QUALITY_MANUAL'].map((t) => (
                <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
            <Button type="submit" disabled={classifying}>{classifying ? 'Saving...' : 'Classify'}</Button>
          </form>
          {classifyError && <div className="text-nt-blocked text-xs mt-2">{classifyError}</div>}
        </Card>
      )}

      <Card className="mb-6 max-w-xl">
        <div className="text-nt-text text-sm font-medium mb-1">Google Drive link</div>
        <p className="text-nt-muted text-xs mb-3">
          Link this document to its Google Drive file so it can be found from the Drive search when requesting a print,
          and so a Drive-triggered print request (Epic H) can resolve back to it.
        </p>
        {doc.externalProvider === 'GOOGLE_DRIVE' && doc.externalRef ? (
          <div className="flex items-center justify-between">
            <div className="text-xs text-nt-text font-mono">{doc.externalRef}</div>
            {can(PERMISSIONS.DOCUMENT_REGISTER) && (
              <Button variant="ghost" onClick={unlinkGoogleDrive}>Unlink</Button>
            )}
          </div>
        ) : can(PERMISSIONS.DOCUMENT_REGISTER) ? (
          <form onSubmit={linkGoogleDrive} className="flex gap-2">
            <input
              className="nt-input flex-1 text-sm"
              value={driveRef}
              onChange={(e) => setDriveRef(e.target.value)}
              placeholder="Google Drive file ID or link"
              required
            />
            <Button type="submit" disabled={linkingDrive}>{linkingDrive ? 'Linking...' : 'Link'}</Button>
          </form>
        ) : (
          <div className="text-nt-muted text-xs">Not linked.</div>
        )}
        {driveLinkError && <div className="text-nt-blocked text-xs mt-2">{driveLinkError}</div>}
      </Card>

      <div className="font-display text-sm text-nt-text mb-3">Revision history</div>
      <Table>
        <thead>
          <tr>
            <Th>Revision</Th><Th>Status</Th><Th>Effective Date</Th><Th>Review Due</Th><Th>Change Summary</Th><Th>Approval Reference</Th><Th></Th>
          </tr>
        </thead>
        <tbody>
          {revisions.map((r: any) => (
            <tr key={r.id}>
              <Td className="font-mono text-nt-teal">Rev {r.revisionLabel}</Td>
              <Td><StatusBadge status={r.approvalStatus} /></Td>
              <Td className="text-nt-muted">{r.effectiveDate ? new Date(r.effectiveDate).toLocaleDateString() : '—'}</Td>
              <Td className="text-nt-muted">{r.reviewDueDate ? new Date(r.reviewDueDate).toLocaleDateString() : '—'}</Td>
              <Td className="text-nt-muted">{r.changeSummary ?? '—'}</Td>
              <Td className="text-nt-muted2 font-mono text-[11px]">
                <span title={r.approvalReference?.approvedByName ? `e-signed by ${r.approvalReference.approvedByName}` : undefined}>
                  {r.approvalReference?.approvalReferenceNumber ?? '—'}
                </span>
              </Td>
              <Td>
                {r.approvalStatus !== 'APPROVED' && can(PERMISSIONS.DOCUMENT_REVISE) && (
                  <Button variant="secondary" onClick={() => { setSigningRevisionId(r.id); setSignError(null); }} disabled={!!busy}>
                    {busy === r.id ? 'Approving...' : 'Approve'}
                  </Button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>

      <ESignDialog
        open={!!signingRevisionId}
        title="Electronically Sign Revision Approval"
        description="This approval is recorded with a unique reference number and cannot be edited once signed."
        expectedName={session?.fullName ?? ''}
        busy={!!busy}
        error={signError}
        onCancel={() => { setSigningRevisionId(null); setSignError(null); }}
        onConfirm={confirmApprove}
      />
    </div>
  );
}
