import {
  INTENT_LEVEL_LABELS,
  PURCHASE_TIMELINE_LABELS,
  type IntentLevel,
  type PurchaseTimeline,
} from '@zuund/shared';

export function IntentPill({ level }: { level: IntentLevel }) {
  const cls = level === 'READY' ? 'success' : level === 'COMMITTED' ? 'accent' : '';
  return <span className={`pill ${cls}`}>{INTENT_LEVEL_LABELS[level]}</span>;
}

export function TimelineText({ timeline }: { timeline: PurchaseTimeline }) {
  return <>{PURCHASE_TIMELINE_LABELS[timeline]}</>;
}

export function StatusPill({ status }: { status: string }) {
  const cls = ['ACTIVE', 'ACCEPTED', 'SUCCESS', 'VERIFIED', 'SCHEDULED'].includes(status)
    ? 'success'
    : ['PENDING', 'PENDING_PAYMENT', 'PAUSED', 'INITIATED'].includes(status)
      ? 'warn'
      : [
            'EXPIRED',
            'CLOSED',
            'CANCELLED',
            'FAILED',
            'REFUNDED',
            'REJECTED',
            'BLOCKED',
            'LEFT',
            'REMOVED',
          ].includes(status)
        ? 'danger'
        : '';
  return <span className={`pill ${cls}`}>{status.replace(/_/g, ' ').toLowerCase()}</span>;
}

export function Verified({ status }: { status: 'VERIFIED' | 'UNVERIFIED' }) {
  return status === 'VERIFIED' ? <span className="verified">✓ Verified</span> : null;
}
