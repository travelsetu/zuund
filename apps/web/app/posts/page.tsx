'use client';

import type { BuyingIntentDto } from '@zuund/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { IntentPill, StatusPill, TimelineText } from '@/components/Pills';
import { api, errorMessage } from '@/lib/api';
import { RequireAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';

function PostsList() {
  const [items, setItems] = useState<BuyingIntentDto[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.intents
      .list()
      .then((p) => setItems(p.items))
      .catch((e) => setErr(errorMessage(e)));
  }, []);

  return (
    <div className="stack">
      <div className="spread">
        <h1>My buying posts</h1>
        <Link href="/posts/new" className="btn sm">
          + New post
        </Link>
      </div>
      {err && <p className="error">{err}</p>}
      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <div className="card center-text">
          <p>You have no buying posts yet.</p>
          <Link href="/" className="btn">
            Tell us what you want to buy
          </Link>
        </div>
      ) : (
        <div className="list">
          {items.map((i) => (
            <Link key={i.id} href={`/posts/${i.id}`} className="list-item">
              <div className="grow">
                <div className="row">
                  <strong>{i.car.displayName}</strong>
                  <span className="muted">· {i.city.name}</span>
                  <StatusPill status={i.status} />
                </div>
                <div className="small muted">
                  Buying <TimelineText timeline={i.purchaseTimeline} /> ·{' '}
                  <IntentPill level={i.intentLevel} /> · created {formatDate(i.createdAt)}
                </div>
                {i.pass && (
                  <div className="small">
                    Buying Pass: <StatusPill status={i.pass.status} />
                    {i.pass.status === 'ACTIVE' && i.pass.expiresAt && (
                      <span className="muted"> · valid until {formatDate(i.pass.expiresAt)}</span>
                    )}
                  </div>
                )}
              </div>
              <span className="muted">›</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PostsPage() {
  return (
    <RequireAuth>
      <PostsList />
    </RequireAuth>
  );
}
