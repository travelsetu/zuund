'use client';

import { loginRequestSchema } from '@zuund/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function LoginForm() {
  const { login } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/posts';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const parsed = loginRequestSchema.safeParse({ email, password });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? 'Check your details');
    setBusy(true);
    try {
      await login(parsed.data);
      router.replace(next);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="narrow" style={{ margin: '24px auto' }}>
      <form className="card pad-lg stack" onSubmit={onSubmit} noValidate>
        <h1>Sign in</h1>
        <div className="field">
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        {err && <p className="error">{err}</p>}
        <button type="submit" className="block" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="small muted center-text">
          New to zuund?{' '}
          <Link href={`/register?next=${encodeURIComponent(next)}`}>Create an account</Link>
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
