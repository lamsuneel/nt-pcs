'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface VerifyResult {
  verdict: 'GREEN' | 'AMBER' | 'RED' | 'GREY';
  message?: string;
  documentTitle?: string;
  documentNumber?: string;
  revisionLabel?: string;
  copyIdentifier?: string;
  status?: string;
  marking?: string;
  authorizedLocation?: string;
  issuedToDepartment?: string | null;
  lastVerificationAt?: string | null;
  serverTimeUtc: string;
}

const VERDICT_STYLE: Record<string, { bg: string; label: string }> = {
  GREEN: { bg: 'bg-nt-compliant', label: 'VALID CONTROLLED COPY' },
  AMBER: { bg: 'bg-nt-flagged', label: 'VERIFICATION REQUIRED' },
  RED: { bg: 'bg-nt-blocked', label: 'INVALID — SUPERSEDED / RECALLED / EXPIRED' },
  GREY: { bg: 'bg-nt-muted', label: 'UNKNOWN OR UNREGISTERED COPY' },
};

export default function VerifyResultPage() {
  const { qrToken } = useParams<{ qrToken: string }>();
  const [result, setResult] = useState<VerifyResult | null>(null);
  const [offline, setOffline] = useState(false);
  const [lastGoodSync, setLastGoodSync] = useState<string | null>(null);

  useEffect(() => {
    const cacheKey = `ntpcs_verify_cache_${qrToken}`;
    async function run() {
      try {
        const res = await fetch(`/api/verify/${qrToken}`);
        const data = await res.json();
        setResult(data);
        try { localStorage.setItem(cacheKey, JSON.stringify({ data, syncedAt: new Date().toISOString() })); } catch {}
        fetch(`/api/verify/${qrToken}/scan`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ verdict: data.verdict, scannedOffline: false }),
        }).catch(() => {});
      } catch {
        setOffline(true);
        try {
          const cached = localStorage.getItem(cacheKey);
          if (cached) {
            const parsed = JSON.parse(cached);
            setResult(parsed.data);
            setLastGoodSync(parsed.syncedAt);
          } else {
            setResult({ verdict: 'GREY', serverTimeUtc: new Date().toISOString() });
          }
        } catch {
          setResult({ verdict: 'GREY', serverTimeUtc: new Date().toISOString() });
        }
      }
    }
    run();
  }, [qrToken]);

  if (!result) {
    return <div className="min-h-screen bg-nt-bg flex items-center justify-center text-nt-muted font-sans">Checking…</div>;
  }

  const style = VERDICT_STYLE[result.verdict];

  return (
    <div className="min-h-screen bg-nt-bg font-sans">
      <div className={`${style.bg} text-nt-bg px-5 py-8 text-center`}>
        <div className="font-display text-2xl tracking-tight">{style.label}</div>
        {result.copyIdentifier && <div className="font-mono text-xs mt-1 opacity-80">{result.copyIdentifier}</div>}
      </div>

      <div className="px-5 py-6 max-w-sm mx-auto">
        {offline && (
          <div className="mb-4 rounded-lg border border-nt-flagged/40 bg-nt-flagged/10 text-nt-flagged text-xs px-3 py-2">
            Offline — showing cached result from {lastGoodSync ? new Date(lastGoodSync).toLocaleString() : 'an earlier sync'}. This is not guaranteed current.
          </div>
        )}

        {result.message && <div className="text-nt-muted text-sm mb-4">{result.message}</div>}

        {result.documentNumber && (
          <div className="nt-card p-4 space-y-3 text-sm">
            <Row label="Document" value={`${result.documentNumber}`} />
            <Row label="Title" value={result.documentTitle} />
            <Row label="Revision" value={result.revisionLabel} />
            <Row label="Status" value={result.status?.replace(/_/g, ' ')} />
            <Row label="Marking" value={result.marking?.replace(/_/g, ' ')} />
            <Row label="Authorized location" value={result.authorizedLocation} />
            <Row label="Issued to department" value={result.issuedToDepartment ?? '—'} />
            <Row label="Last verification" value={result.lastVerificationAt ? new Date(result.lastVerificationAt).toLocaleString() : 'None recorded'} />
          </div>
        )}

        <div className="text-nt-muted text-[11px] mt-4 text-center">
          Server time: {new Date(result.serverTimeUtc).toLocaleString()}
        </div>
        <div className="text-nt-muted text-[11px] mt-1 text-center">
          Scanning confirms copy validity only. It does not grant access to the full document.
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-nt-muted">{label}</span>
      <span className="text-nt-text text-right">{value ?? '—'}</span>
    </div>
  );
}
