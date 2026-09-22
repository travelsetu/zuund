'use client';

import { createPollRequestSchema, type PollDto } from '@zuund/shared';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { LoadMore } from '../LoadMore';

function Poll({
  poll,
  viewerId,
  onChange,
}: {
  poll: PollDto;
  viewerId: string;
  onChange: (p: PollDto) => void;
}) {
  const [selected, setSelected] = useState<string[]>(
    poll.options.filter((o) => o.voted).map((o) => o.id),
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const voted = poll.options.some((o) => o.voted);
  const open =
    poll.status === 'ACTIVE' && (!poll.expiresAt || new Date(poll.expiresAt) > new Date());
  const canVote = open && (!voted || poll.allowVoteChange);
  const showResults = voted || !open;

  function toggle(id: string) {
    if (!canVote) return;
    setSelected((s) =>
      poll.multipleChoice ? (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]) : [id],
    );
  }
  async function vote() {
    setBusy(true);
    setErr(null);
    try {
      onChange(await api.collectives.vote(poll.id, selected));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function close() {
    setBusy(true);
    try {
      onChange(await api.collectives.closePoll(poll.id));
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card stack">
      <div className="spread">
        <h3 style={{ margin: 0 }}>{poll.question}</h3>
        <span className={`pill ${open ? 'success' : ''}`}>{open ? 'Open' : 'Closed'}</span>
      </div>
      <div className="small muted">
        by {poll.creator.name ?? 'Member'} · {formatDateTime(poll.createdAt)} ·{' '}
        {poll.multipleChoice ? 'multiple choice' : 'single choice'}
        {poll.allowVoteChange ? ' · votes can be changed' : ''}
        {poll.expiresAt ? ` · closes ${formatDateTime(poll.expiresAt)}` : ''} · {poll.totalVotes}{' '}
        {poll.totalVotes === 1 ? 'vote' : 'votes'}
      </div>
      <div>
        {poll.options.map((o) => {
          const pct = poll.totalVotes ? Math.round((o.voteCount / poll.totalVotes) * 100) : 0;
          return (
            <label
              key={o.id}
              className="poll-option"
              style={{ cursor: canVote ? 'pointer' : 'default' }}
            >
              {showResults && <span className="bar" style={{ width: `${pct}%` }} />}
              {canVote && (
                <input
                  type={poll.multipleChoice ? 'checkbox' : 'radio'}
                  name={poll.id}
                  checked={selected.includes(o.id)}
                  onChange={() => toggle(o.id)}
                  style={{ width: 'auto' }}
                />
              )}
              <span>
                {o.label}
                {o.voted ? ' ✓' : ''}
              </span>
              {showResults && (
                <span className="pct">
                  {o.voteCount} · {pct}%
                </span>
              )}
            </label>
          );
        })}
      </div>
      {err && <p className="error small">{err}</p>}
      <div className="row">
        {canVote && (
          <button
            type="button"
            className="sm"
            disabled={busy || selected.length === 0}
            onClick={vote}
          >
            {voted ? 'Change vote' : 'Vote'}
          </button>
        )}
        {open && poll.creator.id === viewerId && (
          <button type="button" className="sm secondary" disabled={busy} onClick={close}>
            Close poll
          </button>
        )}
      </div>
    </div>
  );
}

export function PollsTab({ collectiveId, viewerId }: { collectiveId: string; viewerId: string }) {
  const [items, setItems] = useState<PollDto[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [multi, setMulti] = useState(false);
  const [change, setChange] = useState(false);
  const [expires, setExpires] = useState('');

  const load = useCallback(async () => {
    const p = await api.collectives.polls(collectiveId);
    setItems(p.items);
    setCursor(p.nextCursor);
  }, [collectiveId]);
  useEffect(() => {
    load().catch((e) => setErr(errorMessage(e)));
  }, [load]);

  async function more() {
    if (!cursor) return;
    setBusy(true);
    const p = await api.collectives.polls(collectiveId, cursor);
    setItems((prev) => [...(prev ?? []), ...p.items]);
    setCursor(p.nextCursor);
    setBusy(false);
  }
  async function create(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const parsed = createPollRequestSchema.safeParse({
      question,
      options: options.map((o) => o.trim()).filter(Boolean),
      multipleChoice: multi,
      allowVoteChange: change,
      expiresAt: expires ? new Date(expires).toISOString() : undefined,
    });
    if (!parsed.success) return setErr(parsed.error.issues[0]?.message ?? 'Check the poll');
    setBusy(true);
    try {
      const p = await api.collectives.createPoll(collectiveId, parsed.data);
      setItems((prev) => [p, ...(prev ?? [])]);
      setCreating(false);
      setQuestion('');
      setOptions(['', '']);
      setMulti(false);
      setChange(false);
      setExpires('');
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <div className="spread">
        <p className="muted small" style={{ margin: 0 }}>
          Ask the group: variants, colours, timing, dealers you have visited.
        </p>
        <button type="button" className="sm" onClick={() => setCreating((v) => !v)}>
          {creating ? 'Cancel' : '+ New poll'}
        </button>
      </div>
      {creating && (
        <form className="card stack" onSubmit={create} noValidate>
          <div className="field">
            <label htmlFor="q">Question</label>
            <input
              id="q"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Which variant are you considering?"
            />
          </div>
          <div className="field">
            <label>Options (2–10)</label>
            <div className="stack" style={{ gap: 6 }}>
              {options.map((o, i) => (
                <div key={i} className="row" style={{ flexWrap: 'nowrap' }}>
                  <input
                    value={o}
                    onChange={(e) =>
                      setOptions((os) => os.map((x, j) => (j === i ? e.target.value : x)))
                    }
                    placeholder={`Option ${i + 1}`}
                  />
                  {options.length > 2 && (
                    <button
                      type="button"
                      className="ghost sm"
                      onClick={() => setOptions((os) => os.filter((_, j) => j !== i))}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            {options.length < 10 && (
              <button
                type="button"
                className="ghost sm"
                onClick={() => setOptions((os) => [...os, ''])}
              >
                + Add option
              </button>
            )}
          </div>
          <label className="check">
            <input type="checkbox" checked={multi} onChange={(e) => setMulti(e.target.checked)} />{' '}
            Allow choosing more than one option
          </label>
          <label className="check">
            <input type="checkbox" checked={change} onChange={(e) => setChange(e.target.checked)} />{' '}
            Allow members to change their vote
          </label>
          <div className="field">
            <label htmlFor="exp">Closes at (optional)</label>
            <input
              id="exp"
              type="datetime-local"
              value={expires}
              onChange={(e) => setExpires(e.target.value)}
            />
          </div>
          {err && <p className="error small">{err}</p>}
          <button type="submit" disabled={busy}>
            Create poll
          </button>
        </form>
      )}
      {!creating && err && <p className="error small">{err}</p>}
      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="muted">No polls yet.</p>
      ) : (
        items.map((p) => (
          <Poll
            key={p.id}
            poll={p}
            viewerId={viewerId}
            onChange={(np) => setItems((prev) => prev!.map((x) => (x.id === np.id ? np : x)))}
          />
        ))
      )}
      <LoadMore cursor={cursor} busy={busy} onClick={more} />
    </div>
  );
}
