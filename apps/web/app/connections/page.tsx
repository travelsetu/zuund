'use client';

import type { ConnectionDto } from '@zuund/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { LoadMore } from '@/components/LoadMore';
import { Verified } from '@/components/Pills';
import { api, errorMessage } from '@/lib/api';
import { RequireAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';

type Box = 'ACCEPTED' | 'INCOMING' | 'OUTGOING' | 'BLOCKED';
const TABS: Array<{ box: Box; label: string }> = [
  { box: 'ACCEPTED', label: 'Connections' },
  { box: 'INCOMING', label: 'Requests' },
  { box: 'OUTGOING', label: 'Sent' },
  { box: 'BLOCKED', label: 'Blocked' },
];

function Connections() {
  const router = useRouter();
  const [box, setBox] = useState<Box>('ACCEPTED');
  const [items, setItems] = useState<ConnectionDto[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setItems(null);
    const p = await api.connections.list(box);
    setItems(p.items);
    setCursor(p.nextCursor);
  }, [box]);
  useEffect(() => {
    load().catch((e) => setErr(errorMessage(e)));
  }, [load]);

  async function more() {
    if (!cursor) return;
    setBusy(true);
    const p = await api.connections.list(box, cursor);
    setItems((prev) => [...(prev ?? []), ...p.items]);
    setCursor(p.nextCursor);
    setBusy(false);
  }
  async function act(fn: () => Promise<unknown>) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await load();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <h1>Connections</h1>
      <div className="tabs">
        {TABS.map((t) => (
          <button
            key={t.box}
            type="button"
            className={`tab${box === t.box ? ' active' : ''}`}
            onClick={() => setBox(t.box)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {err && <p className="error">{err}</p>}
      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="muted">
          {box === 'ACCEPTED'
            ? 'No connections yet. Find buyers on your buying post.'
            : box === 'INCOMING'
              ? 'No pending requests.'
              : box === 'OUTGOING'
                ? 'No sent requests.'
                : 'You have not blocked anyone.'}
        </p>
      ) : (
        <div className="list">
          {items.map((c) => (
            <div key={c.id} className="list-item">
              <Avatar user={c.otherUser} />
              <div className="grow">
                <Link href={`/buyers/${c.otherUser.id}`}>
                  <strong>{c.otherUser.name ?? 'Buyer'}</strong>
                </Link>{' '}
                <Verified status={c.otherUser.verificationStatus} />
                <div className="small muted">
                  {c.otherUser.city?.name ?? ''} ·{' '}
                  {box === 'ACCEPTED'
                    ? `connected ${timeAgo(c.acceptedAt ?? c.createdAt)}`
                    : timeAgo(c.createdAt)}
                </div>
              </div>
              <div className="row">
                {box === 'ACCEPTED' && (
                  <button
                    type="button"
                    className="sm"
                    disabled={busy}
                    onClick={() =>
                      act(() =>
                        api.conversations
                          .openDirect(c.otherUser.id)
                          .then((conv) => router.push(`/messages/${conv.id}`)),
                      )
                    }
                  >
                    Message
                  </button>
                )}
                {box === 'INCOMING' && (
                  <>
                    <button
                      type="button"
                      className="sm"
                      disabled={busy}
                      onClick={() => act(() => api.connections.accept(c.id))}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="sm secondary"
                      disabled={busy}
                      onClick={() => act(() => api.connections.reject(c.id))}
                    >
                      Decline
                    </button>
                  </>
                )}
                {box === 'OUTGOING' && (
                  <button
                    type="button"
                    className="sm secondary"
                    disabled={busy}
                    onClick={() => act(() => api.connections.cancel(c.id))}
                  >
                    Cancel
                  </button>
                )}
                {box === 'BLOCKED' && (
                  <button
                    type="button"
                    className="sm secondary"
                    disabled={busy}
                    onClick={() => act(() => api.connections.unblock(c.otherUser.id))}
                  >
                    Unblock
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      <LoadMore cursor={cursor} busy={busy} onClick={more} />
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <RequireAuth>
      <Connections />
    </RequireAuth>
  );
}
