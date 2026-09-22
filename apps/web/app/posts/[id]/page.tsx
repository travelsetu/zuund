'use client';

import {
  BUYER_FILTERS,
  INTENT_LEVELS,
  INTENT_LEVEL_LABELS,
  PURCHASE_TIMELINES,
  PURCHASE_TIMELINE_LABELS,
  type BuyerDiscoveryDto,
  type BuyerDto,
  type BuyerFilter,
  type BuyingIntentDto,
  type CollectiveDto,
  type IntentLevel,
  type PurchaseTimeline,
} from '@zuund/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { BuyerCard } from '@/components/BuyerCard';
import { LoadMore } from '@/components/LoadMore';
import { ConfirmModal } from '@/components/Modal';
import { PassPanel } from '@/components/PassPanel';
import { StatusPill } from '@/components/Pills';
import { api, errorMessage } from '@/lib/api';
import { RequireAuth, useAuth } from '@/lib/auth';
import { formatDate } from '@/lib/format';

const FILTER_LABELS: Record<BuyerFilter, string> = {
  ALL: 'All',
  RECENT: 'Recently joined',
  READY: 'Ready',
  COMMITTED: 'Committed',
  INTERESTED: 'Interested',
};

function PostDetail({ id }: { id: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [intent, setIntent] = useState<BuyingIntentDto | null>(null);
  const [disc, setDisc] = useState<BuyerDiscoveryDto | null>(null);
  const [filter, setFilter] = useState<BuyerFilter>('ALL');
  const [collective, setCollective] = useState<CollectiveDto | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'CLOSE' | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  const loadIntent = useCallback(async () => {
    const i = await api.intents.get(id);
    setIntent(i);
    return i;
  }, [id]);

  const loadCollective = useCallback(async (i: BuyingIntentDto) => {
    if (i.membership) {
      setCollective(await api.collectives.get(i.membership.collectiveId));
      return;
    }
    const page = await api.collectives.list({ carId: i.car.id, cityId: i.city.id });
    setCollective(page.items[0] ?? null);
  }, []);

  useEffect(() => {
    loadIntent()
      .then((i) => loadCollective(i))
      .catch((e) => setErr(errorMessage(e)));
  }, [loadIntent, loadCollective]);

  useEffect(() => {
    if (!intent) return;
    api.buyers
      .discover({ carId: intent.car.id, cityId: intent.city.id, filter })
      .then(setDisc)
      .catch((e) => setErr(errorMessage(e)));
  }, [intent?.car.id, intent?.city.id, filter, intent]);

  async function loadMore() {
    if (!intent || !disc?.nextCursor) return;
    setLoadingMore(true);
    try {
      const page = await api.buyers.discover({
        carId: intent.car.id,
        cityId: intent.city.id,
        filter,
        cursor: disc.nextCursor,
      });
      setDisc({ ...page, items: [...disc.items, ...page.items] });
    } finally {
      setLoadingMore(false);
    }
  }

  function patchBuyer(b: BuyerDto) {
    setDisc((d) =>
      d ? { ...d, items: d.items.map((x) => (x.buyingIntentId === b.buyingIntentId ? b : x)) } : d,
    );
  }

  async function run(fn: () => Promise<BuyingIntentDto>) {
    setBusy(true);
    setErr(null);
    try {
      setIntent(await fn());
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  }

  if (!intent) return err ? <p className="error">{err}</p> : <p className="muted">Loading…</p>;
  const editable = intent.status === 'ACTIVE' || intent.status === 'PAUSED';

  return (
    <div className="stack">
      <div>
        <Link href="/posts" className="small">
          ← My posts
        </Link>
        <div className="spread">
          <h1 style={{ margin: 0 }}>
            {intent.car.displayName} · {intent.city.name}
          </h1>
          <StatusPill status={intent.status} />
        </div>
        <p className="muted small">Created {formatDate(intent.createdAt)}</p>
      </div>

      {disc && (
        <div className="card stat">
          <span className="num">{disc.totalActiveBuyers}</span>
          <span>
            {disc.totalActiveBuyers === 1 ? 'person' : 'people'} in {intent.city.name}{' '}
            {disc.totalActiveBuyers === 1 ? 'is' : 'are'} looking to buy {intent.car.displayName}
          </span>
        </div>
      )}

      <div className="card stack">
        <h2>Your post</h2>
        {err && <p className="error">{err}</p>}
        <div
          className="grid"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
        >
          <div>
            <label htmlFor="level">Your intent</label>
            <select
              id="level"
              value={intent.intentLevel}
              disabled={!editable || busy}
              onChange={(e) =>
                run(() => api.intents.changeLevel(id, e.target.value as IntentLevel))
              }
            >
              {INTENT_LEVELS.map((l) => (
                <option key={l} value={l}>
                  {INTENT_LEVEL_LABELS[l]}
                </option>
              ))}
            </select>
            <p className="small muted">
              None of these mean a guaranteed purchase. Change it any time.
            </p>
          </div>
          <div>
            <label htmlFor="timeline">Buying timeline</label>
            <select
              id="timeline"
              value={intent.purchaseTimeline}
              disabled={!editable || busy}
              onChange={(e) =>
                run(() => api.intents.updateTimeline(id, e.target.value as PurchaseTimeline))
              }
            >
              {PURCHASE_TIMELINES.map((t) => (
                <option key={t} value={t}>
                  {PURCHASE_TIMELINE_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="row">
          {intent.status === 'ACTIVE' && (
            <button
              type="button"
              className="secondary sm"
              disabled={busy}
              onClick={() => run(() => api.intents.transition(id, 'PAUSE'))}
            >
              Pause post
            </button>
          )}
          {intent.status === 'PAUSED' && (
            <button
              type="button"
              className="secondary sm"
              disabled={busy}
              onClick={() => run(() => api.intents.transition(id, 'RESUME'))}
            >
              Resume post
            </button>
          )}
          {editable && (
            <button
              type="button"
              className="danger sm"
              disabled={busy}
              onClick={() => setConfirm('CLOSE')}
            >
              Close post
            </button>
          )}
        </div>
      </div>

      <PassPanel intent={intent} collective={collective} />

      <div className="stack">
        <h2>Buyers like you</h2>
        <div className="chips">
          {BUYER_FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              className={`chip${filter === f ? ' active' : ''}`}
              onClick={() => setFilter(f)}
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>
        {!disc ? (
          <p className="muted">Loading buyers…</p>
        ) : disc.items.length === 0 ? (
          <p className="muted">No other buyers match this filter yet. Check back soon.</p>
        ) : (
          <div className="grid">
            {disc.items.map((b) => (
              <BuyerCard
                key={b.buyingIntentId}
                buyer={b}
                viewerId={user!.id}
                onChange={patchBuyer}
              />
            ))}
          </div>
        )}
        {disc && <LoadMore cursor={disc.nextCursor} busy={loadingMore} onClick={loadMore} />}
      </div>

      {confirm === 'CLOSE' && (
        <ConfirmModal
          title="Close this buying post?"
          body="Closing is final. Your post history stays, and you can create a new post later if you are still buying."
          confirmLabel="Close post"
          danger
          busy={busy}
          onClose={() => setConfirm(null)}
          onConfirm={() =>
            run(() => api.intents.transition(id, 'CLOSE')).then(() => router.refresh())
          }
        />
      )}
    </div>
  );
}

export default function PostPage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <PostDetail id={id} />
    </RequireAuth>
  );
}
