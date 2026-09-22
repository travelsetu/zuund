'use client';

import { REPORT_TARGET_TYPES, type BuyerProfileDto } from '@zuund/shared';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { Avatar } from '@/components/Avatar';
import { ConfirmModal, Modal } from '@/components/Modal';
import { IntentPill, TimelineText, Verified } from '@/components/Pills';
import { api, errorMessage } from '@/lib/api';
import { RequireAuth, useAuth } from '@/lib/auth';

void REPORT_TARGET_TYPES;

function Profile({ userId }: { userId: string }) {
  const { user: me } = useAuth();
  const router = useRouter();
  const [p, setP] = useState<BuyerProfileDto | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<'REPORT' | 'BLOCK' | null>(null);
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [done, setDone] = useState<string | null>(null);

  const load = useCallback(
    () =>
      api.users
        .profile(userId)
        .then(setP)
        .catch((e) => setErr(errorMessage(e))),
    [userId],
  );
  useEffect(() => {
    void load();
  }, [load]);

  async function act(fn: () => Promise<unknown>, after?: () => void) {
    setBusy(true);
    setErr(null);
    try {
      await fn();
      await load();
      after?.();
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
      setModal(null);
    }
  }

  if (err && !p) return <p className="error">{err}</p>;
  if (!p) return <p className="muted">Loading…</p>;
  const c = p.connection;
  const isMe = me?.id === userId;

  return (
    <div className="stack narrow" style={{ margin: '0 auto' }}>
      <div className="card stack">
        <div className="row">
          <Avatar user={p.user} size="lg" />
          <div>
            <h1 style={{ marginBottom: 2 }}>{p.user.name ?? 'Buyer'}</h1>
            <Verified status={p.user.verificationStatus} />
            {p.user.city && <div className="muted">{p.user.city.name}</div>}
          </div>
        </div>
        {p.user.about && <p>{p.user.about}</p>}
        <div className="row small muted">
          <span>{p.connectionCount} connections</span>
          <span>·</span>
          <span>{p.collectiveCount} collectives</span>
        </div>
        {err && <p className="error small">{err}</p>}
        {done && <p className="success small">{done}</p>}
        {!isMe && (
          <div className="row">
            {!c || c.status === 'REJECTED' || c.status === 'CANCELLED' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => act(() => api.connections.request(userId))}
              >
                Connect
              </button>
            ) : c.status === 'PENDING' && c.requesterId === me?.id ? (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => act(() => api.connections.cancel(c.id))}
              >
                Cancel request
              </button>
            ) : c.status === 'PENDING' ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => act(() => api.connections.accept(c.id))}
                >
                  Accept request
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => act(() => api.connections.reject(c.id))}
                >
                  Decline
                </button>
              </>
            ) : c.status === 'ACCEPTED' ? (
              <>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    act(() =>
                      api.conversations
                        .openDirect(userId)
                        .then((conv) => router.push(`/messages/${conv.id}`)),
                    )
                  }
                >
                  Message
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy}
                  onClick={() => act(() => api.connections.cancel(c.id))}
                >
                  Remove connection
                </button>
              </>
            ) : null}
            <button type="button" className="ghost sm" onClick={() => setModal('REPORT')}>
              Report
            </button>
            <button type="button" className="ghost sm" onClick={() => setModal('BLOCK')}>
              Block
            </button>
          </div>
        )}
        {isMe && (
          <Link href="/profile" className="btn secondary sm">
            Edit my profile
          </Link>
        )}
      </div>

      <div className="stack">
        <h2>Looking for</h2>
        {p.activeIntents.length === 0 ? (
          <p className="muted">No active buying posts.</p>
        ) : (
          p.activeIntents.map((i) => (
            <div key={i.id} className="card">
              <strong>{i.car.displayName}</strong> <span className="muted">· {i.city.name}</span>
              <div className="small muted">
                Buying <TimelineText timeline={i.purchaseTimeline} /> ·{' '}
                <IntentPill level={i.intentLevel} />
              </div>
            </div>
          ))
        )}
      </div>

      {modal === 'REPORT' && (
        <Modal title="Report this user" onClose={() => setModal(null)}>
          <div className="stack">
            <div className="field">
              <label htmlFor="reason">Reason</label>
              <input
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Spam, dealer posing as buyer"
              />
            </div>
            <div className="field">
              <label htmlFor="details">Details (optional)</label>
              <textarea id="details" value={details} onChange={(e) => setDetails(e.target.value)} />
            </div>
            <div className="row" style={{ justifyContent: 'flex-end' }}>
              <button type="button" className="secondary" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={busy || reason.trim().length === 0}
                onClick={() =>
                  act(
                    () =>
                      api.reports.create({
                        targetType: 'USER',
                        targetId: userId,
                        reason: reason.trim(),
                        details: details.trim() || undefined,
                      }),
                    () => setDone('Thanks, our team will review this report.'),
                  )
                }
              >
                Submit report
              </button>
            </div>
          </div>
        </Modal>
      )}
      {modal === 'BLOCK' && (
        <ConfirmModal
          title="Block this user?"
          body="They will no longer see your posts or be able to contact you, and you will not see theirs."
          confirmLabel="Block"
          danger
          busy={busy}
          onClose={() => setModal(null)}
          onConfirm={() =>
            act(
              () => api.connections.block(userId),
              () => router.push('/posts'),
            )
          }
        />
      )}
    </div>
  );
}

export default function BuyerPage() {
  const { userId } = useParams<{ userId: string }>();
  return (
    <RequireAuth>
      <Profile userId={userId} />
    </RequireAuth>
  );
}
