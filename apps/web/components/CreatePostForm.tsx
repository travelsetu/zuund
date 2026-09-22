'use client';

import {
  PURCHASE_TIMELINES,
  PURCHASE_TIMELINE_LABELS,
  type CarDto,
  type CityDto,
  type PurchaseTimeline,
} from '@zuund/shared';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { api, ApiRequestError, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';

interface Draft {
  car: CarDto | null;
  cityId: string;
  purchaseTimeline: PurchaseTimeline | '';
}
const DRAFT_KEY = 'zuund:draft-post';

/** Steps 2–6 of the journey: car → city → timeline → create. Sign-in happens only at the end. */
export function CreatePostForm() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [cities, setCities] = useState<CityDto[]>([]);
  const [q, setQ] = useState('');
  const [results, setResults] = useState<CarDto[]>([]);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>({ car: null, cityId: '', purchaseTimeline: '' });
  const [err, setErr] = useState<string | null>(null);
  const [existingId, setExistingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const autoSubmitted = useRef(false);
  const params = useSearchParams();

  useEffect(() => {
    api.catalog
      .cities()
      .then(setCities)
      .catch(() => {});
    try {
      const saved = sessionStorage.getItem(DRAFT_KEY);
      if (saved) {
        const d = JSON.parse(saved) as Draft;
        setDraft(d);
        if (d.car) setQ(d.car.displayName);
        return;
      }
    } catch {
      /* ignore */
    }
    // "Create New Buying Post" after an expired pass arrives with the same car and city.
    const carId = params.get('carId');
    const cityId = params.get('cityId');
    if (cityId) setDraft((d) => ({ ...d, cityId }));
    if (carId) {
      api.catalog
        .cars(params.get('carName') ?? '')
        .then((cars) => {
          const car = cars.find((c) => c.id === carId);
          if (car) {
            setDraft((d) => ({ ...d, car }));
            setQ(car.displayName);
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      api.catalog
        .cars(q)
        .then(setResults)
        .catch(() => setResults([]));
    }, 150);
    return () => clearTimeout(t);
  }, [q, open]);

  // Came back from sign-in with a complete draft: create it without another click.
  useEffect(() => {
    if (loading || !user || autoSubmitted.current) return;
    if (draft.car && draft.cityId && draft.purchaseTimeline && sessionStorage.getItem(DRAFT_KEY)) {
      autoSubmitted.current = true;
      void submit();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, draft]);

  async function submit() {
    if (!draft.car || !draft.cityId || !draft.purchaseTimeline)
      return setErr('Choose a car, a city and a buying timeline');
    setErr(null);
    setExistingId(null);
    if (!user) {
      sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      router.push('/register?next=%2F');
      return;
    }
    setBusy(true);
    try {
      const intent = await api.intents.create({
        carId: draft.car.id,
        cityId: draft.cityId,
        purchaseTimeline: draft.purchaseTimeline,
        intentLevel: 'INTERESTED',
      });
      sessionStorage.removeItem(DRAFT_KEY);
      router.push(`/posts/${intent.id}`);
    } catch (e) {
      sessionStorage.removeItem(DRAFT_KEY);
      if (e instanceof ApiRequestError && e.status === 409) {
        setErr(
          'You already have an active buying post for this car in this city. Find it under My posts.',
        );
      } else setErr(errorMessage(e));
      setBusy(false);
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void submit();
  }

  return (
    <form className="card pad-lg stack" onSubmit={onSubmit} noValidate>
      <div className="field relative">
        <label htmlFor="car">Car</label>
        <input
          id="car"
          placeholder="Search a car, e.g. Creta"
          value={q}
          autoComplete="off"
          onChange={(e) => {
            setQ(e.target.value);
            setDraft((d) => ({ ...d, car: null }));
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {open && results.length > 0 && !draft.car && (
          <div className="dropdown-list" role="listbox">
            {results.map((c) => (
              <button
                key={c.id}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setDraft((d) => ({ ...d, car: c }));
                  setQ(c.displayName);
                  setOpen(false);
                }}
              >
                {c.displayName}
              </button>
            ))}
          </div>
        )}
        {draft.car && <p className="small success">Selected: {draft.car.displayName}</p>}
      </div>
      <div className="field">
        <label htmlFor="city">City</label>
        <select
          id="city"
          value={draft.cityId}
          onChange={(e) => setDraft((d) => ({ ...d, cityId: e.target.value }))}
        >
          <option value="">Choose your city</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}, {c.state}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label>When do you plan to buy?</label>
        <div className="radio-row">
          {PURCHASE_TIMELINES.map((t) => (
            <label key={t} className={draft.purchaseTimeline === t ? 'on' : ''}>
              <input
                type="radio"
                name="timeline"
                value={t}
                checked={draft.purchaseTimeline === t}
                onChange={() => setDraft((d) => ({ ...d, purchaseTimeline: t }))}
              />
              {PURCHASE_TIMELINE_LABELS[t]}
            </label>
          ))}
        </div>
      </div>
      {err && (
        <p className="error">
          {err}
          {existingId && (
            <>
              {' '}
              <Link href={`/posts/${existingId}`}>Open that post</Link>
            </>
          )}
        </p>
      )}
      <button type="submit" className="block" disabled={busy}>
        {busy ? 'Creating…' : user ? 'Create buying post' : 'Continue'}
      </button>
      <p className="small muted center-text">
        Creating a post is free. No budget, no dealer, no commitment.
      </p>
    </form>
  );
}
