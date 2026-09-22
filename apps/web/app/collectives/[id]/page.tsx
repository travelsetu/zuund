'use client';

import { BUYING_PASS_VALIDITY_DAYS, type BuyingIntentDto, type CollectiveDto } from '@zuund/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { MessageThread } from '@/components/MessageThread';
import { ConfirmModal } from '@/components/Modal';
import { PassPanel } from '@/components/PassPanel';
import { PassStatus } from '@/components/PassStatus';
import { StatusPill } from '@/components/Pills';
import { ActivitiesTab } from '@/components/collective/ActivitiesTab';
import { FilesTab } from '@/components/collective/FilesTab';
import { MembersTab } from '@/components/collective/MembersTab';
import { PollsTab } from '@/components/collective/PollsTab';
import { api, ApiRequestError, errorMessage } from '@/lib/api';
import { RequireAuth, useAuth } from '@/lib/auth';

type Tab = 'DISCUSSION' | 'MEMBERS' | 'POLLS' | 'FILES' | 'ACTIVITIES';
const TABS: Array<{ id: Tab; label: string }> = [
  { id: 'DISCUSSION', label: 'Discussion' },
  { id: 'MEMBERS', label: 'Members' },
  { id: 'POLLS', label: 'Polls' },
  { id: 'FILES', label: 'Files' },
  { id: 'ACTIVITIES', label: 'Activities' },
];

function Collective({ id }: { id: string }) {
  const { user } = useAuth();
  const router = useRouter();
  const [col, setCol] = useState<CollectiveDto | null>(null);
  const [intent, setIntent] = useState<BuyingIntentDto | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>('DISCUSSION');
  const [err, setErr] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [busy, setBusy] = useState(false);

  const [expired, setExpired] = useState(false);
  const load = useCallback(async () => {
    const c = await api.collectives.get(id).catch((e) => {
      if (e instanceof ApiRequestError && e.code === 'BUYING_PASS_EXPIRED') setExpired(true);
      throw e;
    });
    setCol(c);
    if (c.membership) setIntent(await api.intents.get(c.membership.buyingIntentId));
    else {
      // Which of my active posts matches this collective?
      const mine = await api.intents.list();
      setIntent(
        mine.items.find(
          (i) => i.status === 'ACTIVE' && i.car.id === c.car.id && i.city.id === c.city.id,
        ) ?? null,
      );
    }
  }, [id]);
  useEffect(() => {
    load().catch((e) => {
      setErr(errorMessage(e));
      if (e instanceof ApiRequestError && e.code === 'BUYING_PASS_EXPIRED') {
        api.intents
          .list()
          .then((p) =>
            setIntent(
              p.items.find(
                (i) => i.membership?.collectiveId === id || i.pass?.status === 'EXPIRED',
              ) ?? null,
            ),
          )
          .catch(() => {});
      }
    });
  }, [load, id]);

  async function leave() {
    setBusy(true);
    try {
      await api.collectives.leave(id);
      router.push(intent ? `/posts/${intent.id}` : '/posts');
    } catch (e) {
      setErr(errorMessage(e));
      setBusy(false);
      setLeaving(false);
    }
  }

  if (!col) {
    if (expired && intent) {
      return (
        <div className="narrow stack" style={{ margin: '0 auto' }}>
          <h1>Collective</h1>
          <PassStatus intent={intent} />
        </div>
      );
    }
    return err ? <p className="error">{err}</p> : <p className="muted">Loading…</p>;
  }
  const active = col.membership?.status === 'ACTIVE';

  return (
    <div className="stack">
      <div>
        {intent && (
          <Link href={`/posts/${intent.id}`} className="small">
            ← My buying post
          </Link>
        )}
        <div className="spread">
          <h1 style={{ margin: 0 }}>{col.name}</h1>
          <StatusPill status={col.status} />
        </div>
        <p className="muted small">
          {col.car.displayName} · {col.city.name} · {col.activeMemberCount} active{' '}
          {col.activeMemberCount === 1 ? 'member' : 'members'}
        </p>
      </div>
      {err && <p className="error">{err}</p>}

      {!active ? (
        intent === undefined ? (
          <p className="muted">Loading…</p>
        ) : intent ? (
          <PassPanel intent={intent} collective={col} />
        ) : (
          <div className="card stack">
            <p>
              This collective is for buyers of <strong>{col.car.displayName}</strong> in{' '}
              <strong>{col.city.name}</strong>. Create a buying post for it to join; the ₹500 Buying
              Pass is per post and valid {BUYING_PASS_VALIDITY_DAYS} days from payment.
            </p>
            <Link href="/posts/new" className="btn">
              Create a buying post
            </Link>
          </div>
        )
      ) : (
        <>
          <div className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                className={`tab${tab === t.id ? ' active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'DISCUSSION' && col.conversationId && (
            <MessageThread conversationId={col.conversationId} viewerId={user!.id} showSender />
          )}
          {tab === 'MEMBERS' && <MembersTab collectiveId={id} />}
          {tab === 'POLLS' && <PollsTab collectiveId={id} viewerId={user!.id} />}
          {tab === 'FILES' && <FilesTab collectiveId={id} viewerId={user!.id} />}
          {tab === 'ACTIVITIES' && <ActivitiesTab collectiveId={id} viewerId={user!.id} />}
          <hr className="divider" />
          <div className="row">
            {intent?.pass?.status === 'ACTIVE' && (
              <span className="small muted">
                Buying Pass active until{' '}
                {new Date(intent.pass.expiresAt!).toLocaleDateString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            )}
            <button
              type="button"
              className="ghost sm"
              style={{ marginLeft: 'auto' }}
              onClick={() => setLeaving(true)}
            >
              Leave collective
            </button>
          </div>
        </>
      )}

      {leaving && (
        <ConfirmModal
          title="Leave this collective?"
          body="Your membership becomes Left and you lose access to the discussion, polls, files and activities. Your buying post, payment history and messages are kept. Whether the Buying Pass is refunded follows the refund policy; by default it is not."
          confirmLabel="Leave"
          danger
          busy={busy}
          onClose={() => setLeaving(false)}
          onConfirm={leave}
        />
      )}
    </div>
  );
}

export default function CollectivePage() {
  const { id } = useParams<{ id: string }>();
  return (
    <RequireAuth>
      <Collective id={id} />
    </RequireAuth>
  );
}
