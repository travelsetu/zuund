import { useEffect, useState } from 'react';
import { INTENT_LEVEL_LABELS, PURCHASE_TIMELINE_LABELS, type AdminStatsDto } from '@zuund/shared';
import { ErrorText, PageHeader, Section, StatTile, Table, type Column } from '@/components/ui';
import { api, ApiRequestError } from '@/lib/api';
import { fmtPaise } from '@/lib/format';

/** Basic admin visibility (spec §90): counts only, no scores, no charts. */
export function OverviewPage() {
  const [stats, setStats] = useState<AdminStatsDto | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.admin
      .stats()
      .then(setStats)
      .catch((e: unknown) =>
        setError(e instanceof ApiRequestError ? e.message : 'Could not load stats'),
      );
  }, []);

  if (error)
    return (
      <>
        <PageHeader title="Overview" />
        <ErrorText error={error} />
      </>
    );
  if (!stats)
    return (
      <>
        <PageHeader title="Overview" />
        <p className="muted">Loading…</p>
      </>
    );

  const successRate =
    stats.payments.success + stats.payments.failed > 0
      ? Math.round(
          (100 * stats.payments.success) / (stats.payments.success + stats.payments.failed),
        )
      : null;

  type Row = { label: string; count: number };
  const countColumns = (first: string): Column<Row>[] => [
    { key: 'label', header: first, render: (r) => r.label },
    { key: 'count', header: 'Posts', render: (r) => r.count, width: '8rem' },
  ];
  const byLevel: Row[] = (
    Object.keys(stats.intents.byLevel) as Array<keyof typeof stats.intents.byLevel>
  ).map((k) => ({ label: INTENT_LEVEL_LABELS[k], count: stats.intents.byLevel[k] }));
  const byTimeline: Row[] = (
    Object.keys(stats.intents.byTimeline) as Array<keyof typeof stats.intents.byTimeline>
  ).map((k) => ({ label: PURCHASE_TIMELINE_LABELS[k], count: stats.intents.byTimeline[k] }));
  const byCar: Row[] = stats.intents.byCar.map((r) => ({
    label: r.car.displayName,
    count: r.count,
  }));
  const byCity: Row[] = stats.intents.byCity.map((r) => ({
    label: `${r.city.name}, ${r.city.state}`,
    count: r.count,
  }));

  return (
    <>
      <PageHeader title="Overview" />
      <div className="stats">
        <StatTile
          label="Users"
          value={stats.users.total}
          hint={`${stats.users.verified} verified · ${stats.users.suspended} suspended`}
        />
        <StatTile
          label="Active in last 30 days"
          value={stats.users.activeLast30Days}
          hint={`${stats.users.postedAtLeastOnce} have posted`}
        />
        <StatTile
          label="Active buying posts"
          value={stats.intents.active}
          hint={`${stats.intents.total} all time`}
        />
        <StatTile
          label="Active collectives"
          value={stats.collectives.active}
          hint={`${stats.collectives.activeMemberships} active memberships`}
        />
        <StatTile
          label="Buying passes"
          value={stats.passes.active}
          hint={`${stats.passes.expired} expired · ${stats.passes.refunded} refunded`}
        />
        <StatTile
          label="Revenue"
          value={fmtPaise(stats.payments.revenuePaise)}
          hint={`${stats.payments.success} successful · ${stats.payments.failed} failed${successRate !== null ? ` · ${successRate}% success` : ''}`}
        />
        <StatTile
          label="Refunded"
          value={fmtPaise(stats.payments.refundedPaise)}
          hint={`${stats.payments.refunded} refunds`}
        />
        <StatTile
          label="Connections"
          value={stats.connections.accepted}
          hint={`${stats.connections.pending} pending`}
        />
        <StatTile
          label="Messages"
          value={stats.messages.total}
          hint={`${stats.messages.conversations} conversations`}
        />
        <StatTile label="Polls" value={stats.polls.total} hint={`${stats.polls.votes} votes`} />
        <StatTile label="Open reports" value={stats.reports.open} />
      </div>

      <div className="grid-2">
        <Section title="Active posts by intent level">
          <Table columns={countColumns('Level')} rows={byLevel} rowKey={(r) => r.label} />
        </Section>
        <Section title="Active posts by buying timeline">
          <Table columns={countColumns('Timeline')} rows={byTimeline} rowKey={(r) => r.label} />
        </Section>
        <Section title="Car demand (active posts)">
          <Table
            columns={countColumns('Car')}
            rows={byCar}
            rowKey={(r) => r.label}
            empty="No active posts yet"
          />
        </Section>
        <Section title="City demand (active posts)">
          <Table
            columns={countColumns('City')}
            rows={byCity}
            rowKey={(r) => r.label}
            empty="No active posts yet"
          />
        </Section>
      </div>
    </>
  );
}
