'use client';

import { changePasswordRequestSchema } from '@zuund/shared';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { RequireAuth, useAuth } from '@/lib/auth';

function Settings() {
  const { logout } = useAuth();
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (next !== confirm) return setErr('New passwords do not match');
    const parsed = changePasswordRequestSchema.safeParse({
      currentPassword: current,
      newPassword: next,
    });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? 'Check your details');
    setBusy(true);
    try {
      await api.auth.changePassword(parsed.data);
      // The server ends every session on a password change; sign in again.
      await logout();
      router.push('/login?next=%2Fposts');
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="narrow stack" style={{ margin: '0 auto' }}>
      <h1>Settings</h1>
      <form className="card pad-lg stack" onSubmit={onSubmit} noValidate>
        <h2>Change password</h2>
        <div className="field">
          <label htmlFor="cur">Current password</label>
          <input
            id="cur"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="new">New password (8+ characters)</label>
          <input
            id="new"
            type="password"
            autoComplete="new-password"
            value={next}
            onChange={(e) => setNext(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="conf">Confirm new password</label>
          <input
            id="conf"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        {err && <p className="error">{err}</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Change password'}
        </button>
        <p className="small muted">You will be signed out everywhere and asked to sign in again.</p>
      </form>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <RequireAuth>
      <Settings />
    </RequireAuth>
  );
}
