'use client';

import { updateProfileRequestSchema, type CityDto } from '@zuund/shared';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { Avatar } from '@/components/Avatar';
import { Verified } from '@/components/Pills';
import { api, errorMessage } from '@/lib/api';
import { RequireAuth, useAuth } from '@/lib/auth';

function ProfileForm() {
  const { user, refresh } = useAuth();
  const [cities, setCities] = useState<CityDto[]>([]);
  const [name, setName] = useState(user?.name ?? '');
  const [cityId, setCityId] = useState(user?.city?.id ?? '');
  const [about, setAbout] = useState(user?.about ?? '');
  const [photo, setPhoto] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.catalog
      .cities()
      .then(setCities)
      .catch(() => {});
  }, []);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setOk(false);
    setBusy(true);
    try {
      let photoFileId: string | undefined;
      if (photo) photoFileId = (await api.files.upload(photo)).id;
      const parsed = updateProfileRequestSchema.safeParse({
        name,
        cityId: cityId || null,
        about: about || null,
        photoFileId,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check your details');
      await api.users.updateMe(parsed.data);
      await refresh();
      setPhoto(null);
      setOk(true);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;
  return (
    <div className="narrow stack" style={{ margin: '0 auto' }}>
      <h1>Your profile</h1>
      <form className="card pad-lg stack" onSubmit={onSubmit} noValidate>
        <div className="row">
          <Avatar user={user} size="lg" />
          <div>
            <strong>{user.name}</strong> <Verified status={user.verificationStatus} />
            <div className="small muted">{user.email} · never shown to other buyers</div>
            <Link href={`/buyers/${user.id}`} className="small">
              View as others see you
            </Link>
          </div>
        </div>
        <div className="field">
          <label htmlFor="photo">Profile photo</label>
          <input
            id="photo"
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input id="name" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="city">City</label>
          <select id="city" value={cityId} onChange={(e) => setCityId(e.target.value)}>
            <option value="">Not set</option>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}, {c.state}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="about">About (optional, up to 500 characters)</label>
          <textarea
            id="about"
            value={about}
            maxLength={500}
            onChange={(e) => setAbout(e.target.value)}
            placeholder="A line or two about what you are looking for."
          />
        </div>
        {err && <p className="error">{err}</p>}
        {ok && <p className="success">Saved.</p>}
        <button type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </form>
      <p className="small muted">
        Verification is done by the zuund team.{' '}
        {user.verificationStatus === 'VERIFIED'
          ? 'Your account is verified.'
          : 'Your account is not verified yet.'}
      </p>
    </div>
  );
}

export default function ProfilePage() {
  return (
    <RequireAuth>
      <ProfileForm />
    </RequireAuth>
  );
}
