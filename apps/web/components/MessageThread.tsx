'use client';

import type { MessageDto } from '@zuund/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { Avatar } from './Avatar';

const EMOJIS = ['👍', '❤️', '😂', '🙌', '🤔'];
const POLL_MS = 5000;

/**
 * One conversation: newest at the bottom, "load older" at the top, a composer
 * with an optional attachment, reactions, read receipts, and a 5s poll for
 * new messages while mounted (no websockets in Phase 1).
 */
export function MessageThread({
  conversationId,
  viewerId,
  showSender,
}: {
  conversationId: string;
  viewerId: string;
  showSender?: boolean;
}) {
  const [messages, setMessages] = useState<MessageDto[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const newestRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    const page = await api.conversations.messages(conversationId);
    const asc = [...page.items].reverse();
    setMessages(asc);
    setCursor(page.nextCursor);
    newestRef.current = asc[asc.length - 1]?.id ?? null;
    await api.conversations.markRead(conversationId).catch(() => {});
  }, [conversationId]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .catch((e) => !cancelled && setErr(errorMessage(e)))
      .finally(() => !cancelled && setLoading(false));
    const t = setInterval(() => {
      api.conversations
        .messages(conversationId)
        .then((page) => {
          if (cancelled) return;
          const asc = [...page.items].reverse();
          setMessages((prev) => {
            const known = new Set(asc.map((m) => m.id));
            const older = prev.filter(
              (m) => !known.has(m.id) && new Date(m.createdAt) < new Date(asc[0]?.createdAt ?? 0),
            );
            return [...older, ...asc];
          });
          const newest = asc[asc.length - 1];
          if (newest && newest.id !== newestRef.current && newest.sender.id !== viewerId) {
            api.conversations.markRead(conversationId).catch(() => {});
          }
          newestRef.current = newest?.id ?? null;
        })
        .catch(() => {});
    }, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(t);
    };
  }, [conversationId, load, viewerId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  async function loadOlder() {
    if (!cursor) return;
    const page = await api.conversations.messages(conversationId, cursor);
    setMessages((prev) => [...[...page.items].reverse(), ...prev]);
    setCursor(page.nextCursor);
  }

  async function send() {
    if (!text.trim() && !file) return;
    setSending(true);
    setErr(null);
    try {
      let attachmentId: string | undefined;
      if (file) attachmentId = (await api.files.upload(file)).id;
      const m = await api.conversations.send(conversationId, {
        content: text.trim(),
        attachmentId,
      });
      setMessages((prev) => [...prev, m]);
      newestRef.current = m.id;
      setText('');
      setFile(null);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  async function react(m: MessageDto, emoji: string) {
    await api.conversations.react(m.id, emoji).catch(() => {});
    setMessages((prev) =>
      prev.map((x) => {
        if (x.id !== m.id) return x;
        const existing = x.reactions.find((r) => r.emoji === emoji);
        const reactions = existing
          ? x.reactions
              .map((r) =>
                r.emoji === emoji
                  ? { ...r, count: r.count + (r.reacted ? -1 : 1), reacted: !r.reacted }
                  : r,
              )
              .filter((r) => r.count > 0)
          : [...x.reactions, { emoji, count: 1, reacted: true }];
        return { ...x, reactions };
      }),
    );
  }

  if (loading) return <p className="muted">Loading messages…</p>;

  return (
    <div>
      {cursor && (
        <div className="center-text">
          <button type="button" className="ghost sm" onClick={loadOlder}>
            Load older messages
          </button>
        </div>
      )}
      <div className="thread">
        {messages.length === 0 && <p className="muted center-text">No messages yet. Say hello.</p>}
        {messages.map((m) => {
          const mine = m.sender.id === viewerId;
          return (
            <div key={m.id} className={`msg${mine ? ' mine' : ''}`}>
              {showSender && !mine && (
                <div className="sender row" style={{ gap: 6 }}>
                  <Avatar user={m.sender} /> {m.sender.name ?? 'Member'}
                </div>
              )}
              {m.deletedAt ? (
                <em className="muted small">Message deleted</em>
              ) : (
                <>
                  {m.content && (
                    <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {m.content}
                    </div>
                  )}
                  {m.attachment &&
                    (m.attachment.mimeType.startsWith('image/') ? (
                      <a href={m.attachment.url} target="_blank" rel="noreferrer">
                        <img
                          className="attach"
                          src={m.attachment.url}
                          alt={m.attachment.fileName}
                        />
                      </a>
                    ) : (
                      <a href={m.attachment.url} target="_blank" rel="noreferrer">
                        📎 {m.attachment.fileName}
                      </a>
                    ))}
                </>
              )}
              <div className="reactions">
                {m.reactions.map((r) => (
                  <button
                    key={r.emoji}
                    type="button"
                    className={r.reacted ? 'on' : ''}
                    onClick={() => react(m, r.emoji)}
                  >
                    {r.emoji} {r.count}
                  </button>
                ))}
                {!m.deletedAt && (
                  <details style={{ display: 'inline' }}>
                    <summary
                      className="small muted"
                      style={{ cursor: 'pointer', listStyle: 'none' }}
                    >
                      +
                    </summary>
                    <span className="reactions">
                      {EMOJIS.map((e) => (
                        <button key={e} type="button" onClick={() => react(m, e)}>
                          {e}
                        </button>
                      ))}
                    </span>
                  </details>
                )}
              </div>
              <div className="meta">
                <span>{formatDateTime(m.createdAt)}</span>
                {mine && !m.deletedAt && (
                  <span>
                    {m.deliveryState === 'READ'
                      ? 'Read'
                      : m.deliveryState === 'DELIVERED'
                        ? 'Delivered'
                        : 'Sent'}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {err && <p className="error small">{err}</p>}
      <div className="composer">
        <label className="btn secondary sm" style={{ margin: 0 }} title="Attach a file">
          📎
          <input
            type="file"
            hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
          />
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={file ? `Attach ${file.name}…` : 'Write a message'}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              void send();
            }
          }}
        />
        <button type="button" onClick={send} disabled={sending || (!text.trim() && !file)}>
          Send
        </button>
      </div>
      {file && (
        <p className="small muted">
          {file.name}{' '}
          <button type="button" className="ghost sm" onClick={() => setFile(null)}>
            remove
          </button>
        </p>
      )}
    </div>
  );
}
