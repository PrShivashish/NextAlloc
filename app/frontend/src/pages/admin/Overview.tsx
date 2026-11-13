import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowDown, ArrowRight, ArrowUp, ArrowUpDown, Play } from 'lucide-react';
import { apiGet, apiPost, errMsg } from '../../api/client';
import { Overview as Ov, RunSummary } from '../../api/types';
import { Spinner, Callout, fmtNum, fmtPct, fmtMs, fmtTime } from '../../components/ui';

type SortKey = 'number' | 'scenario' | 'status' | 'solverStatus' | 'totalRuntimeMs';
type SortDir = 'asc' | 'desc';

function statusPillStyle(status: string): React.CSSProperties {
  const s = status.toLowerCase();
  if (
    s.includes('optimal') ||
    s.includes('completed') ||
    s.includes('ready') ||
    s.includes('allocated') ||
    s.includes('active')
  ) {
    return {
      backgroundColor: 'var(--na-status-success-bg)',
      color: 'var(--na-status-success-text)',
      borderColor: 'var(--na-status-success-border)',
    };
  }
  if (s.includes('feasible') && !s.includes('infeasible')) {
    return {
      backgroundColor: 'var(--na-status-info-bg)',
      color: 'var(--na-status-info-text)',
      borderColor: 'var(--na-status-info-border)',
    };
  }
  if (s.includes('infeasible') || s.includes('fail') || s.includes('blocked')) {
    return {
      backgroundColor: 'var(--na-status-error-bg)',
      color: 'var(--na-status-error-text)',
      borderColor: 'var(--na-status-error-border)',
    };
  }
  if (
    s.includes('progress') ||
    s.includes('running') ||
    s.includes('queued') ||
    s.includes('partial') ||
    s.includes('attention')
  ) {
    return {
      backgroundColor: 'var(--na-status-warning-bg)',
      color: 'var(--na-status-warning-text)',
      borderColor: 'var(--na-status-warning-border)',
    };
  }
  return {
    backgroundColor: 'var(--na-status-neutral-bg)',
    color: 'var(--na-status-neutral-text)',
    borderColor: 'var(--na-status-neutral-border)',
  };
}

export default function AdminOverview() {
  const nav = useNavigate();
  const [ov, setOv] = useState<Ov | null>(null);
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [pendingNocCount, setPendingNocCount] = useState<number | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('number');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [starting, setStarting] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    try {
      const [o, r, nocPage] = await Promise.all([
        apiGet<Ov>('/admin/overview'),
        apiGet<any>('/admin/runs', { page: 0, size: 6 }),
        apiGet<any>('/admin/evidence/noc/pending', { page: 0, size: 1 }).catch(() => null),
      ]);
      setOv(o);
      setRuns(r.content ?? []);
      setPendingNocCount(
        Array.isArray(nocPage)
          ? nocPage.length
          : (nocPage?.totalElements ?? nocPage?.content?.length ?? null),
      );
      setLastUpdated(new Date().toISOString());
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startRun = async () => {
    setStarting(true);
    setErr('');
    try {
      const r = await apiPost<any>('/admin/runs', { policyKey: 'balanced' });
      nav(`/admin/runs/${r.id}`);
    } catch (e) {
      setErr(errMsg(e));
      setStarting(false);
    }
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'number' || key === 'totalRuntimeMs' ? 'desc' : 'asc');
    }
  };

  const sortedRuns = useMemo(() => {
    const copy = [...runs];
    copy.sort((a, b) => {
      const mul = sortDir === 'asc' ? 1 : -1;
      if (sortKey === 'number') return (a.number - b.number) * mul;
      if (sortKey === 'totalRuntimeMs') {
        return ((a.totalRuntimeMs ?? -1) - (b.totalRuntimeMs ?? -1)) * mul;
      }
      const va = String(a[sortKey] ?? '');
      const vb = String(b[sortKey] ?? '');
      return va.localeCompare(vb) * mul;
    });
    return copy;
  }, [runs, sortKey, sortDir]);

  if (!ov && !err) return <Spinner label="Loading allocation overview…" />;
  if (err && !ov) return <Callout tone="danger" title="Could not load">{err}</Callout>;

  const a = ov?.allocation;
  const readinessTotal =
    (ov?.readiness?.ready ?? 0) +
    (ov?.readiness?.partial ?? 0) +
    (ov?.readiness?.incomplete ?? 0);
  const stages = ov?.latestRun?.stages ?? [];
  const maxStageMs = Math.max(...stages.map(s => s.ms), 1);

  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) {
      return <ArrowUpDown className="h-3.5 w-3.5 text-[var(--na-ink-tertiary)]" aria-hidden="true" />;
    }
    return sortDir === 'asc' ? (
      <ArrowUp className="h-3.5 w-3.5 text-[var(--na-ink-primary)]" aria-hidden="true" />
    ) : (
      <ArrowDown className="h-3.5 w-3.5 text-[var(--na-ink-primary)]" aria-hidden="true" />
    );
  };

  return (
    <div className="space-y-8">
      {/* 1. Page header */}
      <header className="flex flex-col gap-4 border-b border-[var(--na-border)] pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-[length:var(--na-text-h1)] font-semibold leading-[var(--na-leading-tight)] text-[var(--na-ink-primary)]">
            Allocation overview
          </h1>
          <p className="mt-1.5 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)] tabular-nums">
            Last updated {fmtTime(lastUpdated ?? ov?.latestRun?.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => nav('/admin/scenarios')}
            className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--na-radius-md)] border border-[var(--na-border-strong)] bg-[var(--na-surface)] px-4 py-2 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)] transition-colors duration-150 hover:bg-[var(--na-stone)] active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
          >
            Change scenario
          </button>
          <button
            type="button"
            onClick={startRun}
            disabled={starting}
            className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--na-radius-md)] bg-[var(--na-accent)] px-4 py-2 text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)] transition-[background-color,opacity] duration-150 hover:bg-[var(--na-accent-hover)] active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] disabled:cursor-not-allowed disabled:opacity-55"
          >
            <Play className="h-4 w-4" aria-hidden="true" />
            <span>{starting ? 'Starting…' : 'Run global allocation'}</span>
          </button>
        </div>
      </header>

      {err && <Callout tone="warn">{err}</Callout>}

      {/* 2. Metrics band: 4 numbers in a horizontal row separated by thin vertical dividers */}
      <section aria-label="Key allocation metrics">
        <div className="grid grid-cols-1 divide-y divide-[var(--na-border)] border-b border-[var(--na-border)] pb-6 sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
          <div className="py-3 sm:pr-6 lg:py-1">
            <div className="text-[length:var(--na-text-display)] font-bold leading-none text-[var(--na-ink-primary)] tabular-nums">
              {fmtNum(ov?.scenario?.candidateCount)}
            </div>
            <div className="mt-2 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-secondary)]">
              Candidates
            </div>
            <div className="mt-1 truncate text-[length:var(--na-text-caption)] text-[var(--na-ink-tertiary)] tabular-nums">
              {ov?.scenario ? `${ov.scenario.name} v${ov.scenario.version}` : '—'}
            </div>
          </div>

          <div className="py-3 sm:pl-6 lg:px-6 lg:py-1">
            <div className="text-[length:var(--na-text-display)] font-bold leading-none text-[var(--na-ink-primary)] tabular-nums">
              {fmtNum(ov?.scenario?.seatCount)}
            </div>
            <div className="mt-2 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-secondary)]">
              Total capacity
            </div>
            <div className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-tertiary)] tabular-nums">
              {ov?.scenario ? `${fmtNum(ov.scenario.opportunityCount)} opportunities` : '—'}
            </div>
          </div>

          <div className="py-3 sm:pr-6 lg:px-6 lg:py-1">
            <div className="text-[length:var(--na-text-display)] font-bold leading-none text-[var(--na-ink-primary)] tabular-nums">
              {fmtPct(ov?.readiness?.average)}
            </div>
            <div className="mt-2 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-secondary)]">
              Average readiness
            </div>
            <div className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-tertiary)] tabular-nums">
              {ov?.readiness ? `${fmtNum(ov.readiness.ready)} ready` : '—'}
            </div>
          </div>

          <div className="py-3 sm:pl-6 lg:py-1">
            <div className="text-[length:var(--na-text-display)] font-bold leading-none text-[var(--na-ink-primary)] tabular-nums">
              {a ? fmtNum(a.allocated) : '—'}
            </div>
            <div className="mt-2 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-secondary)]">
              Allocated seats
            </div>
            <div className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-tertiary)] tabular-nums">
              {a
                ? `${fmtPct(a.seatUtilization)} utilization (${fmtNum(Math.max((ov?.scenario?.seatCount ?? 0) - (a.allocated ?? 0), 0))} unallocated remaining)`
                : 'No completed run yet'}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Crosscheck-style analytical band: readiness mix + latest run stages */}
      <section
        aria-label="Readiness and pipeline breakdown"
        className="grid grid-cols-1 gap-8 border-b border-[var(--na-border)] pb-8 lg:grid-cols-2 lg:gap-12"
      >
        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
              Candidate readiness mix
            </h2>
            <span className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)] tabular-nums">
              {readinessTotal > 0 ? `${fmtNum(readinessTotal)} total` : '—'}
            </span>
          </div>

          {readinessTotal > 0 && ov?.readiness ? (
            <div className="mt-4 space-y-4">
              <div
                className="flex h-2.5 w-full overflow-hidden rounded-full bg-[var(--na-well)]"
                role="img"
                aria-label={`Readiness breakdown: ${ov.readiness.ready} ready, ${ov.readiness.partial} partial, ${ov.readiness.incomplete} incomplete`}
              >
                {ov.readiness.ready > 0 && (
                  <div
                    className="h-full bg-[var(--na-status-success-text)]"
                    style={{ width: `${(ov.readiness.ready / readinessTotal) * 100}%` }}
                  />
                )}
                {ov.readiness.partial > 0 && (
                  <div
                    className="h-full bg-[var(--na-accent)]"
                    style={{ width: `${(ov.readiness.partial / readinessTotal) * 100}%` }}
                  />
                )}
                {ov.readiness.incomplete > 0 && (
                  <div
                    className="h-full bg-[var(--na-ink-tertiary)]"
                    style={{ width: `${(ov.readiness.incomplete / readinessTotal) * 100}%` }}
                  />
                )}
              </div>

              <div className="grid grid-cols-3 gap-4 pt-1">
                <div>
                  <div className="flex items-center gap-2 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--na-status-success-text)]" aria-hidden="true" />
                    <span>Ready</span>
                  </div>
                  <div className="mt-1 text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)] tabular-nums">
                    {fmtNum(ov.readiness.ready)}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--na-accent)]" aria-hidden="true" />
                    <span>Partial</span>
                  </div>
                  <div className="mt-1 text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)] tabular-nums">
                    {fmtNum(ov.readiness.partial)}
                  </div>
                </div>
                <div>
                  <div className="flex items-center gap-2 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                    <span className="h-2 w-2 rounded-full bg-[var(--na-ink-tertiary)]" aria-hidden="true" />
                    <span>Incomplete</span>
                  </div>
                  <div className="mt-1 text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)] tabular-nums">
                    {fmtNum(ov.readiness.incomplete)}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
              No candidate readiness metrics available.
            </p>
          )}
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
              Latest run stages
            </h2>
            {ov?.latestRun && (
              <Link
                to={`/admin/runs/${ov.latestRun.id}`}
                className="inline-flex items-center gap-1 text-[length:var(--na-text-caption)] font-medium text-[var(--na-accent-ink)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] tabular-nums"
              >
                <span>Run #{ov.latestRun.number}</span>
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            )}
          </div>

          {stages.length > 0 ? (
            <div className="mt-4 space-y-3">
              {stages.map(s => {
                const isPeak = s.ms === maxStageMs && stages.length > 1;
                return (
                  <div key={s.stage} className="space-y-1">
                    <div className="flex items-baseline justify-between gap-3 text-[length:var(--na-text-caption)]">
                      <span className="font-medium text-[var(--na-ink-primary)]">{s.stage}</span>
                      <span className="text-[var(--na-ink-secondary)] tabular-nums">
                        {fmtMs(s.ms)}
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--na-well)]">
                      <div
                        className={`h-full rounded-full ${
                          isPeak ? 'bg-[var(--na-accent)]' : 'bg-[var(--na-anchor)]'
                        }`}
                        style={{ width: `${Math.max(4, (s.ms / maxStageMs) * 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="mt-4 text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
              No completed allocation run stages yet.
            </p>
          )}
        </div>
      </section>

      {/* 4. Recent runs table */}
      <section aria-label="Recent allocation runs">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
            Allocation runs
          </h2>
          <Link
            to="/admin/runs"
            className="inline-flex items-center gap-1 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)] transition-colors duration-150 hover:text-[var(--na-accent-ink)]"
          >
            <span>View all runs</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>

        {sortedRuns.length === 0 ? (
          <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] px-6 py-10 text-center text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
            No allocation runs yet. Start a run to record decision history.
          </div>
        ) : (
          <div className="min-w-0 overflow-x-auto rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)]">
            <table className="w-full min-w-[600px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--na-border)]">
                  <th
                    className="px-4 py-3 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]"
                    aria-sort={sortKey === 'number' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort('number')}
                      className="inline-flex items-center gap-1.5 hover:text-[var(--na-ink-primary)]"
                    >
                      <span>Run</span>
                      {sortIcon('number')}
                    </button>
                  </th>
                  <th
                    className="px-4 py-3 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]"
                    aria-sort={sortKey === 'scenario' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort('scenario')}
                      className="inline-flex items-center gap-1.5 hover:text-[var(--na-ink-primary)]"
                    >
                      <span>Scenario</span>
                      {sortIcon('scenario')}
                    </button>
                  </th>
                  <th
                    className="px-4 py-3 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]"
                    aria-sort={sortKey === 'status' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort('status')}
                      className="inline-flex items-center gap-1.5 hover:text-[var(--na-ink-primary)]"
                    >
                      <span>Status</span>
                      {sortIcon('status')}
                    </button>
                  </th>
                  <th
                    className="px-4 py-3 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]"
                    aria-sort={sortKey === 'solverStatus' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort('solverStatus')}
                      className="inline-flex items-center gap-1.5 hover:text-[var(--na-ink-primary)]"
                    >
                      <span>Solver outcome</span>
                      {sortIcon('solverStatus')}
                    </button>
                  </th>
                  <th
                    className="px-4 py-3 text-right text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]"
                    aria-sort={sortKey === 'totalRuntimeMs' ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort('totalRuntimeMs')}
                      className="inline-flex items-center justify-end gap-1.5 hover:text-[var(--na-ink-primary)]"
                    >
                      <span>Duration</span>
                      {sortIcon('totalRuntimeMs')}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--na-border-subtle)]">
                {sortedRuns.map(r => (
                  <tr
                    key={r.id}
                    onClick={() => nav(`/admin/runs/${r.id}`)}
                    className="cursor-pointer transition-colors duration-150 hover:bg-[var(--na-surface-raised)]"
                  >
                    <td className="px-4 py-3.5 text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)] tabular-nums">
                      <Link
                        to={`/admin/runs/${r.id}`}
                        onClick={e => e.stopPropagation()}
                        className="hover:text-[var(--na-accent-ink)] hover:underline"
                      >
                        #{r.number}
                        {r.reallocation ? ' (reallocation)' : ''}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 text-[length:var(--na-text-body-sm)] text-[var(--na-ink-primary)]">
                      {r.scenario}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className="inline-flex items-center rounded-[var(--na-radius-sm)] border px-2 py-0.5 text-[length:var(--na-text-caption)] font-medium"
                        style={statusPillStyle(r.status)}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
                      {r.solverStatus ?? '—'}
                    </td>
                    <td className="px-4 py-3.5 text-right text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)] tabular-nums">
                      {fmtMs(r.totalRuntimeMs)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 4. Attention required */}
      <section
        aria-label="Attention required"
        className="rounded-[var(--na-radius-lg)] bg-[var(--na-stone)] p-6"
      >
        <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
          Attention required
        </h2>

        <ul className="mt-4 divide-y divide-[var(--na-border)]">
          <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)]">
                Verification queue
              </div>
              <div className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)] tabular-nums">
                {pendingNocCount != null
                  ? `${fmtNum(pendingNocCount)} institutional NOC submissions awaiting review`
                  : 'Review pending institutional NOC submissions and academic declarations'}
              </div>
            </div>
            <Link
              to="/admin/verification"
              className="inline-flex shrink-0 items-center gap-1.5 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)] transition-colors duration-150 hover:text-[var(--na-accent-ink)]"
            >
              <span>Review documents</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </li>

          <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)]">
                Candidate profile readiness
              </div>
              <div className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)] tabular-nums">
                {ov?.readiness
                  ? `${fmtNum(ov.readiness.incomplete)} incomplete and ${fmtNum(ov.readiness.partial)} partial profiles`
                  : '—'}
              </div>
            </div>
            <Link
              to="/admin/scenarios"
              className="inline-flex shrink-0 items-center gap-1.5 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)] transition-colors duration-150 hover:text-[var(--na-accent-ink)]"
            >
              <span>Inspect dataset</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </li>

          {a && a.unallocated > 0 && ov?.latestRun && (
            <li className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)]">
                  Unallocated candidates in Run #{a.runNumber}
                </div>
                <div className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)] tabular-nums">
                  {fmtNum(a.unallocated)} of {fmtNum(a.totalCandidates)} candidates remain unallocated
                </div>
              </div>
              <Link
                to={`/admin/runs/${ov.latestRun.id}`}
                className="inline-flex shrink-0 items-center gap-1.5 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)] transition-colors duration-150 hover:text-[var(--na-accent-ink)]"
              >
                <span>Open run</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </li>
          )}
        </ul>
      </section>

      {/* 5. Navigation shortcuts (plain text links with right arrow, NOT buttons) */}
      <nav
        aria-label="Administration shortcuts"
        className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-[var(--na-border)] pt-5"
      >
        <Link
          to="/admin/verification"
          className="inline-flex items-center gap-1.5 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)] transition-colors duration-150 hover:text-[var(--na-accent-ink)]"
        >
          <span>Verification</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          to="/admin/runs"
          className="inline-flex items-center gap-1.5 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)] transition-colors duration-150 hover:text-[var(--na-accent-ink)]"
        >
          <span>Allocation Runs</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
        <Link
          to="/admin/whatif"
          className="inline-flex items-center gap-1.5 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)] transition-colors duration-150 hover:text-[var(--na-accent-ink)]"
        >
          <span>Policy Lab</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </nav>
    </div>
  );
}
