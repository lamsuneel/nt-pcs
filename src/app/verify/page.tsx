'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function VerifyEntryPage() {
  const router = useRouter();
  const [token, setToken] = useState('');

  function go(e: React.FormEvent) {
    e.preventDefault();
    if (token.trim()) router.push(`/verify/${token.trim()}`);
  }

  return (
    <div className="min-h-screen bg-nt-bg flex items-center justify-center px-4 font-sans">
      <div className="w-full max-w-sm text-center">
        <div className="w-10 h-10 rounded-lg bg-nt-teal flex items-center justify-center text-nt-bg font-display font-semibold text-lg mx-auto mb-4">N</div>
        <h1 className="font-display text-lg text-nt-text mb-1">Scan a controlled copy</h1>
        <p className="text-nt-muted text-sm mb-6">Point your phone camera at the QR code on a controlled copy, or enter its code below.</p>
        <form onSubmit={go} className="space-y-3">
          <input
            className="nt-input text-center"
            placeholder="QR code value"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            autoFocus
          />
          <button className="w-full rounded-pill bg-nt-teal text-nt-bg py-2.5 text-sm font-medium">Check validity</button>
        </form>
      </div>
    </div>
  );
}
