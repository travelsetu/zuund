import { useEffect, useState, type ReactNode } from 'react';
import { ApiRequestError } from '@/lib/api';

// ── Badge ──
const TONES: Record<string, string> = {
  ACTIVE: 'good',
  SUCCESS: 'good',
  VERIFIED: 'good',
  ACCEPTED: 'good',
  RESOLVED: 'good',
  READY: 'good',
  PENDING: 'warn',
  PENDING_PAYMENT: 'warn',
  INITIATED: 'warn',
  PAUSED: 'warn',
  UNDER_REVIEW: 'warn',
  OPEN: 'warn',
  COMMITTED: 'warn',
  FAILED: 'bad',
  SUSPENDED: 'bad',
  BLOCKED: 'bad',
  REMOVED: 'bad',
  CANCELLED: 'bad',
  EXPIRED: 'neutral',
  CLOSED: 'neutral',
  ARCHIVED: 'neutral',
  LEFT: 'neutral',
  REFUNDED: 'neutral',
  DEACTIVATED: 'neutral',
  DISMISSED: 'neutral',
  UNVERIFIED: 'neutral',
  INTERESTED: 'neutral',
  ADMIN: 'accent',
  USER: 'neutral',
};

export function Badge({ value }: { value: string | null | undefined }) {
  if (!value) return <span className="muted">—</span>;
  return (
    <span className={`badge badge-${TONES[value] ?? 'neutral'}`}>{value.replace(/_/g, ' ')}</span>
  );
}

// ── Stat tile ──
export function StatTile({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">{value}</div>
      {hint && <div className="stat-hint muted">{hint}</div>}
    </div>
  );
}

// ── Table ──
export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  width?: string;
}

export function Table<T>({
  columns,
  rows,
  rowKey,
  empty = 'Nothing here.',
  loading,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: string;
  loading?: boolean;
}) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c.key} style={c.width ? { width: c.width } : undefined}>
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={rowKey(r)}>
              {columns.map((c) => (
                <td key={c.key}>{c.render(r)}</td>
              ))}
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="muted center">
                {loading ? 'Loading…' : empty}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Filters bar ──
export function Filters({ children, onReset }: { children: ReactNode; onReset?: () => void }) {
  return (
    <div className="filters">
      {children}
      {onReset && (
        <button type="button" className="secondary small" onClick={onReset}>
          Reset
        </button>
      )}
    </div>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Any</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

/** Text input that applies after a short pause, so typing does not fire a request per key. */
export function SearchInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  useEffect(() => {
    const t = setTimeout(() => {
      if (draft !== value) onChange(draft);
    }, 350);
    return () => clearTimeout(t);
  }, [draft, value, onChange]);
  return (
    <label className="field">
      <span>{label}</span>
      <input value={draft} placeholder={placeholder} onChange={(e) => setDraft(e.target.value)} />
    </label>
  );
}

// ── Load more ──
export function LoadMore({
  nextCursor,
  loading,
  onClick,
  count,
}: {
  nextCursor: string | null;
  loading: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <div className="load-more">
      <span className="muted">{count} loaded</span>
      {nextCursor && (
        <button type="button" className="secondary small" disabled={loading} onClick={onClick}>
          {loading ? 'Loading…' : 'Load more'}
        </button>
      )}
    </div>
  );
}

// ── Confirm dialog ──
export interface ConfirmSpec {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** Show a note textarea. */
  withNote?: boolean;
  /** Show an optional amount input (₹), returned in paise. */
  withAmount?: { max: number };
  onConfirm: (input: { note: string; amountPaise?: number }) => Promise<void>;
}

export function ConfirmDialog({
  spec,
  onClose,
}: {
  spec: ConfirmSpec | null;
  onClose: () => void;
}) {
  const [note, setNote] = useState('');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setNote('');
    setAmount('');
    setError(null);
    setBusy(false);
  }, [spec]);

  if (!spec) return null;

  async function confirm() {
    if (!spec) return;
    setBusy(true);
    setError(null);
    try {
      let amountPaise: number | undefined;
      if (spec.withAmount && amount.trim()) {
        const rupees = Number(amount);
        if (!Number.isFinite(rupees) || rupees <= 0) throw new Error('Enter a valid amount');
        amountPaise = Math.round(rupees * 100);
        if (amountPaise > spec.withAmount.max) throw new Error('Amount exceeds the payment');
      }
      await spec.onConfirm({ note, amountPaise });
      onClose();
    } catch (err) {
      setError(
        err instanceof ApiRequestError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Something went wrong',
      );
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={busy ? undefined : onClose}>
      <div className="modal" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h2>{spec.title}</h2>
        {spec.body && <div className="modal-body">{spec.body}</div>}
        {spec.withAmount && (
          <label className="field">
            <span>Amount (₹) — leave empty for full refund</span>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={String(spec.withAmount.max / 100)}
            />
          </label>
        )}
        {spec.withNote && (
          <label className="field">
            <span>Note (optional)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </label>
        )}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className={spec.danger ? 'danger' : ''}
            disabled={busy}
            onClick={confirm}
          >
            {busy ? 'Working…' : (spec.confirmLabel ?? 'Confirm')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Misc ──
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="page-header">
      <h1>{title}</h1>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  return error ? (
    <p className="error" role="alert">
      {error}
    </p>
  ) : null;
}

export function Def({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="def">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function Section({
  title,
  children,
  actions,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <section className="section">
      <div className="section-head">
        <h2>{title}</h2>
        {actions}
      </div>
      {children}
    </section>
  );
}
