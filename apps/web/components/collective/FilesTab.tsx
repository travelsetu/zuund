'use client';

import { shareFileRequestSchema, type SharedFileDto, type SharedFileType } from '@zuund/shared';
import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, errorMessage } from '@/lib/api';
import { formatDate } from '@/lib/format';
import { LoadMore } from '../LoadMore';

export function FilesTab({ collectiveId, viewerId }: { collectiveId: string; viewerId: string }) {
  const [items, setItems] = useState<SharedFileDto[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState<SharedFileType>('LINK');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState<File | null>(null);

  const load = useCallback(async () => {
    const p = await api.collectives.files(collectiveId);
    setItems(p.items);
    setCursor(p.nextCursor);
  }, [collectiveId]);
  useEffect(() => {
    load().catch((e) => setErr(errorMessage(e)));
  }, [load]);

  async function more() {
    if (!cursor) return;
    setBusy(true);
    const p = await api.collectives.files(collectiveId, cursor);
    setItems((prev) => [...(prev ?? []), ...p.items]);
    setCursor(p.nextCursor);
    setBusy(false);
  }
  async function share(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      let fileId: string | undefined;
      if (type !== 'LINK') {
        if (!file) throw new Error('Choose a file to upload');
        fileId = (await api.files.upload(file)).id;
      }
      const parsed = shareFileRequestSchema.safeParse({
        type,
        title,
        description: description || undefined,
        fileId,
        url: type === 'LINK' ? url : undefined,
      });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? 'Check the details');
      const s = await api.collectives.shareFile(collectiveId, parsed.data);
      setItems((prev) => [s, ...(prev ?? [])]);
      setAdding(false);
      setTitle('');
      setDescription('');
      setUrl('');
      setFile(null);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }
  async function remove(id: string) {
    setBusy(true);
    try {
      await api.collectives.removeShared(id);
      setItems((prev) => (prev ?? []).filter((x) => x.id !== id));
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
          Brochures, spec sheets, price lists, reviews. Buyer information only.
        </p>
        <button type="button" className="sm" onClick={() => setAdding((v) => !v)}>
          {adding ? 'Cancel' : '+ Share'}
        </button>
      </div>
      {adding && (
        <form className="card stack" onSubmit={share} noValidate>
          <div className="radio-row">
            {(['LINK', 'DOCUMENT', 'IMAGE'] as const).map((t) => (
              <label key={t} className={type === t ? 'on' : ''}>
                <input type="radio" name="ft" checked={type === t} onChange={() => setType(t)} />{' '}
                {t === 'LINK' ? 'Link' : t === 'DOCUMENT' ? 'Document' : 'Image'}
              </label>
            ))}
          </div>
          <div className="field">
            <label htmlFor="t">Title</label>
            <input
              id="t"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Creta 2026 brochure"
            />
          </div>
          {type === 'LINK' ? (
            <div className="field">
              <label htmlFor="u">URL</label>
              <input
                id="u"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://"
              />
            </div>
          ) : (
            <div className="field">
              <label htmlFor="f">File</label>
              <input
                id="f"
                type="file"
                accept={type === 'IMAGE' ? 'image/*' : '.pdf,.doc,.docx,.xls,.xlsx,.txt'}
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="d">Description (optional)</label>
            <textarea id="d" value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          {err && <p className="error small">{err}</p>}
          <button type="submit" disabled={busy}>
            Share
          </button>
        </form>
      )}
      {!adding && err && <p className="error small">{err}</p>}
      {items === null ? (
        <p className="muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="muted">Nothing shared yet.</p>
      ) : (
        <div className="list">
          {items.map((s) => (
            <div key={s.id} className="list-item">
              <span className="avatar">
                {s.type === 'LINK' ? '🔗' : s.type === 'IMAGE' ? '🖼️' : '📄'}
              </span>
              <div className="grow">
                <a href={s.url ?? s.file?.url ?? '#'} target="_blank" rel="noreferrer">
                  <strong>{s.title}</strong>
                </a>
                {s.description && <div className="small">{s.description}</div>}
                <div className="small muted">
                  {s.sharer.name ?? 'Member'} · {formatDate(s.createdAt)}
                  {s.file ? ` · ${Math.round(s.file.sizeBytes / 1024)} KB` : ''}
                </div>
              </div>
              {s.sharer.id === viewerId && (
                <button
                  type="button"
                  className="ghost sm"
                  disabled={busy}
                  onClick={() => remove(s.id)}
                >
                  Remove
                </button>
              )}
            </div>
          ))}
        </div>
      )}
      <LoadMore cursor={cursor} busy={busy} onClick={more} />
    </div>
  );
}
