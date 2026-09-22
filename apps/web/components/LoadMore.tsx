'use client';

export function LoadMore({
  cursor,
  busy,
  onClick,
}: {
  cursor: string | null;
  busy: boolean;
  onClick: () => void;
}) {
  if (!cursor) return null;
  return (
    <div className="center-text" style={{ marginTop: 12 }}>
      <button type="button" className="secondary" onClick={onClick} disabled={busy}>
        {busy ? 'Loading…' : 'Load more'}
      </button>
    </div>
  );
}
