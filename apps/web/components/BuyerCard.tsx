'use client';

import type { BuyerDto } from '@zuund/shared';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { Avatar } from './Avatar';
import { IntentPill, TimelineText, Verified } from './Pills';

/** Section 17: name, verified, city, looking for, buying timeline, intent, Connect / Message. Nothing private. */
export function BuyerCard({
  buyer,
  viewerId,
  onChange,
}: {
  buyer: BuyerDto;
  viewerId: string;
  onChange?: (b: BuyerDto) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const c = buyer.connection;

  async function connect() {
    setBusy(true);
    setErr(null);
    try {
      const conn = await api.connections.request(buyer.user.id);
      onChange?.({
        ...buyer,
        connection: { id: conn.id, status: conn.status, requesterId: conn.requesterId },
      });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function accept() {
    if (!c) return;
    setBusy(true);
    try {
      const conn = await api.connections.accept(c.id);
      onChange?.({
        ...buyer,
        connection: { id: conn.id, status: conn.status, requesterId: conn.requesterId },
      });
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function message() {
    setBusy(true);
    try {
      const conv = await api.conversations.openDirect(buyer.user.id);
      router.push(`/messages/${conv.id}`);
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="card buyer-card">
      <div className="row">
        <Avatar user={buyer.user} />
        <div>
          <Link href={`/buyers/${buyer.user.id}`}>
            <strong>{buyer.user.name ?? 'Buyer'}</strong>
          </Link>{' '}
          <Verified status={buyer.user.verificationStatus} />
          <div className="small muted">{buyer.city.name}</div>
        </div>
      </div>
      <dl className="kv">
        <dt>Looking for</dt>
        <dd>{buyer.car.displayName}</dd>
        <dt>Buying</dt>
        <dd>
          <TimelineText timeline={buyer.purchaseTimeline} />
        </dd>
        <dt>Intent</dt>
        <dd>
          <IntentPill level={buyer.intentLevel} />
        </dd>
      </dl>
      {err && <p className="error small">{err}</p>}
      <div className="row">
        {!c || c.status === 'REJECTED' || c.status === 'CANCELLED' ? (
          <button type="button" className="sm" onClick={connect} disabled={busy}>
            Connect
          </button>
        ) : c.status === 'PENDING' && c.requesterId === viewerId ? (
          <span className="pill warn">Request sent</span>
        ) : c.status === 'PENDING' ? (
          <button type="button" className="sm" onClick={accept} disabled={busy}>
            Accept request
          </button>
        ) : c.status === 'ACCEPTED' ? (
          <>
            <span className="pill success">Connected</span>
            <button type="button" className="sm secondary" onClick={message} disabled={busy}>
              Message
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
