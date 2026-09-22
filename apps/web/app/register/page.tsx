'use client';

import { registerRequestSchema, type CityDto } from '@zuund/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

function RegisterForm() {
  const { register } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get('next') || '/posts';
  const [cities, setCities] = useState<CityDto[]>([]);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [cityId, setCityId] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.catalog
      .cities()
      .then(setCities)
      .catch(() => {});
    try {
      const draft = sessionStorage.getItem('zuund:draft-post');
      if (draft) setCityId(JSON.parse(draft).cityId ?? '');
    } catch {
      /* ignore */
    }
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const parsed = registerRequestSchema.safeParse({
      name,
      email,
      password,
      cityId: cityId || undefined,
    });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? 'Check your details');
    setBusy(true);
    try {
      await register(parsed.data);
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
        <h1>Create your account</h1>
        <p className="muted">Real buyers only. Your email is never shown to other buyers.</p>
        <div className="field">
          <label htmlFor="name">Your name</label>
          <input
            id="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
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
          <label htmlFor="password">Password (8+ characters)</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <div className="field">
          <label htmlFor="city">City (optional)</label>
          <select id="city" value={cityId} onChange={(e) => setCityId(e.target.value)}>
            <option value="">Choose a city</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}, {c.state}
              </option>
            ))}
          </select>
        </div>
        {err && <p className="error">{err}</p>}
        <button type="submit" className="block" disabled={busy}>
          {busy ? 'Creating…' : 'Create account'}
        </button>
        <p className="small muted center-text">
          Already have an account?{' '}
          <Link href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link>
        </p>
      </form>
    </div>
  );
}

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterForm />
    </Suspense>
  );
}
