'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

// MVP scope = two personas only: Document Controller, and Requestor (which
// can be any role holding PRINT_REQUEST). Kept here: Document Controller,
// plus the roles that actually exercise the Requestor persona today
// (DEPARTMENT_HEAD, EMPLOYEE). Every other demo role still exists and can
// log in directly by email — this list is just the quick-select shortcut.
const DEMO_USERS = [
  ['Document Controller', 'srinivas.mullapudi@neuratrace.co'],
  ['Production Dept Head', 'production.head@demo-pharma.local'],
  ['QA Executive (Employee)', 'qa.executive@demo-pharma.local'],
  ['Production Employee', 'production.employee@demo-pharma.local'],
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('srinivas.mullapudi@neuratrace.co');
  const [password, setPassword] = useState('Password123!');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    setLoading(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Login failed');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-nt-bg flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <img src="/brand/nt-logo-mark.png" alt="PrintAssure" className="w-16 h-16 rounded-xl object-contain" />
          <div className="font-display text-xl text-nt-text mt-3">PrintAssure</div>
          <div className="flex items-center gap-1.5 text-xs text-nt-muted mt-1.5">
            by <img src="/brand/nt-logo-wordmark.png" alt="NeuraTrace" className="h-4 w-auto rounded object-contain" />
          </div>
        </div>
        <div className="nt-card p-7">
          <h1 className="font-display text-lg text-nt-text mb-1">Print Control System</h1>
          <p className="text-nt-muted text-xs mb-6">Demo Pharma Laboratories Pvt Ltd — Unit 1</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-xs text-nt-muted block mb-1">Email</label>
              <input
                className="w-full bg-nt-panel2 border border-nt-border rounded-lg px-3 py-2 text-sm text-nt-text outline-none focus:border-nt-teal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-nt-muted block mb-1">Password</label>
              <input
                type="password"
                className="w-full bg-nt-panel2 border border-nt-border rounded-lg px-3 py-2 text-sm text-nt-text outline-none focus:border-nt-teal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && <div className="text-nt-blocked text-xs">{error}</div>}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-pill bg-nt-teal text-nt-bg py-2.5 text-sm font-medium hover:bg-nt-tealDim transition disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-nt-border">
            <div className="grid grid-cols-2 gap-1.5">
              {DEMO_USERS.map(([role, mail]) => (
                <button
                  key={mail}
                  onClick={() => setEmail(mail)}
                  className="text-left text-[11px] text-nt-muted hover:text-nt-teal px-2 py-1 rounded bg-nt-panel2/60 truncate"
                  type="button"
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
