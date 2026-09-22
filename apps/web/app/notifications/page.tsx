'use client';

import type { NotificationDto } from '@zuund/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LoadMore } from '@/components/LoadMore';
import { api, errorMessage } from '@/lib/api';
import { RequireAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';

function linkFor(n: NotificationDto): string | null {
  const d = n.data ?? {};
  if (typeof d.conversationId === 'string') return `/messages/${d.conversationId}`;
  if (typeof d.collectiveId === 'string') return `/collectives/${d.collectiveId}`;
  if (typeof d.userId === 'string') return `/buyers/${d.userId}`;
  if (typeof d.buyingIntentId === 'string') return `/posts/${d.buyingIntentId}`;
  if (n.type === 'CONNECTION_REQUEST') return '/connections';
  return null;
}

function Notifications() {
  const [items, setItems] = useState<NotificationDto[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.notifications
      .list()
      .then((p) => {
        setItems(p.items);
        setCursor(p.nextCursor);
      })
      .catch((e) => setErr(errorMessage(e)));
  }, []);

  async function more() {
    if (!cursor) return;
    setBusy(true);
    const p = await api.notifications.list(cursor);
    setItems((prev) => [...(prev ?? []), ...p.items]);
    setCursor(p.nextCursor);
    setBusy(false);
  }
  async function markAll() {
    await api.notifications.markAllRead();
    const now = new Date().toISOString();
    setItems((prev) => (prev ?? []).map((n) => ({ ...n, readAt: n.readAt ?? now })));
  }
  function markOne(n: NotificationDto) {
    if (n.readAt) return;
    api.notifications.markRead(n.id).catch(() => {});
    setItems((prev) =>
      (prev ?? []).map((x) => (x.id === n.id ? { ...x, readAt: new Date().toISOString() } : x)),
    );
  }

  return (
    <div className="stack">
      <div className="spread">
        <h1>Notifications</h1>
        <button type="button" className="secondary sm" onClick={markAll}>
          Mark all read
        </button>
      </div>
      {err && <p className="error">{err}</p>}
      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="muted">Nothing yet.</p>
      ) : (
        <div className="list">
          {items.map((n) => {
            const href = linkFor(n);
            const inner = (
              <>
                <div className="grow">
                  <div className={n.readAt ? '' : 'unread'}>{n.title}</div>
                  <div className="small muted">{n.body}</div>
                </div>
                <span className="small muted">{timeAgo(n.createdAt)}</span>
              </>
            );
            return href ? (
              <Link key={n.id} href={href} className="list-item" onClick={() => markOne(n)}>
                {inner}
              </Link>
            ) : (
              <div
                key={n.id}
                className="list-item"
                onClick={() => markOne(n)}
                role="button"
                tabIndex={0}
              >
                {inner}
              </div>
            );
          })}
        </div>
      )}
      <LoadMore cursor={cursor} busy={busy} onClick={more} />
    </div>
  );
}

export default function NotificationsPage() {
  return (
    <RequireAuth>
      <Notifications />
    </RequireAuth>
  );
}
