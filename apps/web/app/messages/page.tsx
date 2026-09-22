'use client';

import type { ConversationDto } from '@zuund/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { LoadMore } from '@/components/LoadMore';
import { api, errorMessage } from '@/lib/api';
import { RequireAuth } from '@/lib/auth';
import { timeAgo } from '@/lib/format';

function Conversations() {
  const [items, setItems] = useState<ConversationDto[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.conversations
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
    const p = await api.conversations.list(cursor);
    setItems((prev) => [...(prev ?? []), ...p.items]);
    setCursor(p.nextCursor);
    setBusy(false);
  }

  return (
    <div className="stack">
      <h1>Messages</h1>
      {err && <p className="error">{err}</p>}
      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="muted">No conversations yet. Connect with a buyer to start one.</p>
      ) : (
        <div className="list">
          {items.map((c) => (
            <Link
              key={c.id}
              href={`/messages/${c.id}`}
              className={`list-item${c.unreadCount > 0 ? ' unread' : ''}`}
            >
              {c.otherUser ? <Avatar user={c.otherUser} /> : <span className="avatar">👥</span>}
              <div className="grow">
                <div className="spread">
                  <span className="truncate">{c.otherUser?.name ?? 'Collective discussion'}</span>
                  <span className="small muted">
                    {c.lastMessage ? timeAgo(c.lastMessage.createdAt) : ''}
                  </span>
                </div>
                <div className="small muted truncate">
                  {c.lastMessage ? c.lastMessage.content || '📎 Attachment' : 'No messages yet'}
                </div>
              </div>
              {c.unreadCount > 0 && (
                <span className="badge-dot" style={{ position: 'static' }}>
                  {c.unreadCount}
                </span>
              )}
            </Link>
          ))}
        </div>
      )}
      <LoadMore cursor={cursor} busy={busy} onClick={more} />
    </div>
  );
}

export default function MessagesPage() {
  return (
    <RequireAuth>
      <Conversations />
    </RequireAuth>
  );
}
