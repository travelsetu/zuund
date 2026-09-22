'use client';

import type { CollectiveMemberDto } from '@zuund/shared';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { Avatar } from '../Avatar';
import { LoadMore } from '../LoadMore';
import { IntentPill, TimelineText, Verified } from '../Pills';

export function MembersTab({ collectiveId }: { collectiveId: string }) {
  const [items, setItems] = useState<CollectiveMemberDto[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.collectives
      .members(collectiveId)
      .then((p) => {
        setItems(p.items);
        setCursor(p.nextCursor);
      })
      .catch((e) => setErr(errorMessage(e)));
  }, [collectiveId]);

  async function more() {
    if (!cursor) return;
    setBusy(true);
    const p = await api.collectives.members(collectiveId, cursor);
    setItems((prev) => [...(prev ?? []), ...p.items]);
    setCursor(p.nextCursor);
    setBusy(false);
  }

  if (err) return <p className="error">{err}</p>;
  if (items === null) return <p className="muted">Loading…</p>;
  return (
    <div className="stack">
      <div className="list">
        {items.map((m) => (
          <Link key={m.membershipId} href={`/buyers/${m.user.id}`} className="list-item">
            <Avatar user={m.user} />
            <div className="grow">
              <strong>{m.user.name ?? 'Member'}</strong>{' '}
              <Verified status={m.user.verificationStatus} />
              <div className="small muted">
                {m.user.city?.name ?? ''} · Buying <TimelineText timeline={m.purchaseTimeline} /> ·{' '}
                <IntentPill level={m.intentLevel} /> · joined {formatDate(m.joinedAt)}
              </div>
            </div>
          </Link>
        ))}
      </div>
      <LoadMore cursor={cursor} busy={busy} onClick={more} />
    </div>
  );
}
