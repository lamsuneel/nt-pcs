'use client';

import { useState } from 'react';
import { Button } from '@/components/ui';

interface ESignDialogProps {
  open: boolean;
  title: string;
  description: string;
  expectedName: string;
  busy?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (fullName: string) => void;
}

export function ESignDialog({ open, title, description, expectedName, busy, error, onCancel, onConfirm }: ESignDialogProps) {
  const [typed, setTyped] = useState('');
  if (!open) return null;

  const matches = typed.trim().toLowerCase() === expectedName.trim().toLowerCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="nt-card w-full max-w-md">
        <div className="text-nt-text text-sm font-semibold mb-1">{title}</div>
        <p className="text-nt-muted text-xs mb-4">{description}</p>

        <div className="rounded-lg bg-nt-panel2 border border-nt-border p-3 mb-4">
          <p className="text-nt-text text-xs leading-relaxed">
            By typing my full name below and confirming, I am electronically signing this record. This signature is
            legally binding and equivalent to my handwritten signature.
          </p>
        </div>

        <label className="text-xs text-nt-muted block mb-1">Type your full name to sign ({expectedName})</label>
        <input
          autoFocus
          className="nt-input w-full"
          placeholder={expectedName}
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches && !busy) onConfirm(typed.trim());
          }}
        />
        {error && <div className="text-nt-blocked text-xs mt-2">{error}</div>}

        <div className="flex justify-end gap-2 mt-5">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button onClick={() => onConfirm(typed.trim())} disabled={!matches || busy}>
            {busy ? 'Signing…' : 'Sign & Approve'}
          </Button>
        </div>
      </div>
    </div>
  );
}
