'use client';

import {
  ACTIVITY_TYPES,
  createActivityRequestSchema,
  type ActivityDto,
  type ActivityType,
} from '@zuund/shared';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { LoadMore } from '../LoadMore';
import { StatusPill } from '../Pills';

const TYPE_LABELS: Record<ActivityType, string> = {
  ONLINE: 'Online',
  IN_PERSON: 'In person',
  HYBRID: 'Hybrid',
};

export function ActivitiesTab({
  collectiveId,
  viewerId,
}: {
  collectiveId: string;
  viewerId: string;
}) {
  const [items, setItems] = useState<ActivityDto[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    type: 'ONLINE' as ActivityType,
    date: '',
    startTime: '',
    endTime: '',
    meetingLink: '',
    location: '',
  });

  const load = useCallback(async () => {
    const p = await api.collectives.activities(collectiveId);
    setItems(p.items);
    setCursor(p.nextCursor);
  }, [collectiveId]);
  useEffect(() => {
    load().catch((e) => setErr(errorMessage(e)));
  }, [load]);

  async function more() {
    if (!cursor) return;
    setBusy(true);
    const p = await api.collectives.activities(collectiveId, cursor);
    setItems((prev) => [...(prev ?? []), ...p.items]);
    setCursor(p.nextCursor);
    setBusy(false);
  }
  function patch(a: ActivityDto) {
    setItems((prev) => (prev ?? []).map((x) => (x.id === a.id ? a : x)));
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const parsed = createActivityRequestSchema.safeParse({
      title: form.title,
      description: form.description || undefined,
      type: form.type,
      date: form.date,
      startTime: form.startTime,
      endTime: form.endTime || undefined,
      meetingLink: form.meetingLink || undefined,
      location: form.location || undefined,
    });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? 'Check the details');
    setBusy(true);
    try {
      const a = await api.collectives.createActivity(collectiveId, parsed.data);
      setItems((prev) => [a, ...(prev ?? [])]);
      setAdding(false);
      setForm({
        title: '',
        description: '',
        type: 'ONLINE',
        date: '',
        startTime: '',
        endTime: '',
        meetingLink: '',
        location: '',
      });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function act(fn: () => Promise<ActivityDto>) {
    setBusy(true);
    setErr(null);
    try {
      patch(await fn());
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="stack">
      <div className="spread">
        <p className="muted small" style={{ margin: 0 }}>
          Group calls, showroom visits, meetups. Meeting links are external (Meet, Zoom).
        </p>
        <button type="button" className="sm" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : '+ New activity'}
        </button>
      </div>
      {adding && (
        <form className="card stack" onSubmit={create} noValidate>
          <div className="field">
            <label htmlFor="at">Title</label>
            <input id="at" value={form.title} onChange={set('title')} />
          </div>
          <div className="radio-row">
            {ACTIVITY_TYPES.map((t) => (
              <label key={t} className={form.type === t ? 'on' : ''}>
                <input
                  type="radio"
                  name="atype"
                  checked={form.type === t}
                  onChange={() => setForm((f) => ({ ...f, type: t }))}
                />{' '}
                {TYPE_LABELS[t]}
              </label>
            ))}
          </div>
          <div className="grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
            <div className="field">
              <label htmlFor="ad">Date</label>
              <input id="ad" type="date" value={form.date} onChange={set('date')} />
            </div>
            <div className="field">
              <label htmlFor="as">Start</label>
              <input id="as" type="time" value={form.startTime} onChange={set('startTime')} />
            </div>
            <div className="field">
              <label htmlFor="ae">End (optional)</label>
              <input id="ae" type="time" value={form.endTime} onChange={set('endTime')} />
            </div>
          </div>
          {form.type !== 'IN_PERSON' && (
            <div className="field">
              <label htmlFor="al">Meeting link</label>
              <input
                id="al"
                type="url"
                value={form.meetingLink}
                onChange={set('meetingLink')}
                placeholder="https://meet.google.com/…"
              />
            </div>
          )}
          {form.type !== 'ONLINE' && (
            <div className="field">
              <label htmlFor="aloc">Location</label>
              <input
                id="aloc"
                value={form.location}
                onChange={set('location')}
                placeholder="Showroom, café, area"
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="adesc">Description (optional)</label>
            <textarea id="adesc" value={form.description} onChange={set('description')} />
          </div>
          {err && <p className="error small">{err}</p>}
          <button type="submit" disabled={busy}>
            Create activity
          </button>
        </form>
      )}
      {!adding && err && <p className="error small">{err}</p>}
      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="muted">No activities yet.</p>
      ) : (
        items.map((a) => (
          <div key={a.id} className="card stack">
            <div className="spread">
              <h3 style={{ margin: 0 }}>{a.title}</h3>
              <span className="row">
                <span className="pill accent">{TYPE_LABELS[a.type]}</span>
                <StatusPill status={a.status} />
              </span>
            </div>
            <div className="small">
              📅{' '}
              {new Date(a.date + 'T00:00:00').toLocaleDateString('en-IN', {
                weekday: 'short',
                day: 'numeric',
                month: 'short',
              })}{' '}
              · {a.startTime}
              {a.endTime ? `–${a.endTime}` : ''}
              {a.location ? ` · 📍 ${a.location}` : ''}
              {a.meetingLink ? (
                <>
                  {' '}
                  ·{' '}
                  <a href={a.meetingLink} target="_blank" rel="noreferrer">
                    Join link
                  </a>
                </>
              ) : null}
            </div>
            {a.description && <p className="small">{a.description}</p>}
            <div className="row small muted">
              <span>
                {a.goingCount} going · by {a.creator.name ?? 'Member'}
              </span>
            </div>
            {a.status === 'SCHEDULED' && (
              <div className="row">
                <button
                  type="button"
                  className={`sm${a.myStatus === 'GOING' ? '' : ' secondary'}`}
                  disabled={busy}
                  onClick={() => act(() => api.collectives.rsvp(a.id, 'GOING'))}
                >
                  Going{a.myStatus === 'GOING' ? ' ✓' : ''}
                </button>
                <button
                  type="button"
                  className={`sm${a.myStatus === 'NOT_GOING' ? '' : ' secondary'}`}
                  disabled={busy}
                  onClick={() => act(() => api.collectives.rsvp(a.id, 'NOT_GOING'))}
                >
                  Not going{a.myStatus === 'NOT_GOING' ? ' ✓' : ''}
                </button>
                {a.creator.id === viewerId && (
                  <button
                    type="button"
                    className="ghost sm"
                    disabled={busy}
                    onClick={() => act(() => api.collectives.cancelActivity(a.id))}
                  >
                    Cancel activity
                  </button>
                )}
              </div>
            )}
          </div>
        ))
      )}
      <LoadMore cursor={cursor} busy={busy} onClick={more} />
    </div>
  );
}
