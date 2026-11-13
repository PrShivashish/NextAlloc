import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpDown, History, Search } from 'lucide-react';
import { apiGet, errMsg } from '../../api/client';
import { RunSummary } from '../../api/types';
import {
  Spinner,
  Callout,
  Badge,
  statusTone,
  fmtMs,
  fmtTime,
  fmtNum,
  EmptyState,
} from '../../components/ui';

type SortField = 'number' | 'status' | 'runtime' | 'createdAt';

export default function AdminRuns() {
  const nav = useNavigate();
  const [rows, setRows] = useState<RunSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('number');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const load = async () => {
    setLoading(true);
    try {
      const d = await apiGet<any>('/admin/runs', { page: 0, size: 30 });
      setRows(d.content ?? []);
    } catch (e) {
      setErr(errMsg(e));
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const statuses = useMemo(() => {
    const uniq = Array.from(new Set(rows.map((r) => r.status).filter(Boolean)));
    return ['ALL', ...uniq];
  }, [rows]);

  const toggleSort = (field: SortField) => {
    if (sortBy === field) {
      setSortDir((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir(field === 'number' || field === 'createdAt' ? 'desc' : 'asc');
    }
  };

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (!q) return true;
      return (
        String(r.number).includes(q) ||
        r.scenario.toLowerCase().includes(q) ||
        r.policyName.toLowerCase().includes(q) ||
        (r.solverStatus ?? '').toLowerCase().includes(q)
      );
    });
    const dir = sortDir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sortBy === 'number') return (a.number - b.number) * dir;
      if (sortBy === 'status') return a.status.localeCompare(b.status) * dir;
      if (sortBy === 'runtime') {
        return ((a.totalRuntimeMs ?? -1) - (b.totalRuntimeMs ?? -1)) * dir;
      }
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    });
  }, [rows, statusFilter, query, sortBy, sortDir]);

  return (
    <div className="space-y-6">
      <div className="border-b border-[var(--na-border)] pb-5">
        <h1 className="font-display text-[28px] font-semibold tracking-tight text-[var(--na-ink-primary)]">
          Allocation runs
        </h1>
        <p className="mt-1.5 text-[15px] text-[var(--na-ink-secondary)]">
          Complete, replayable history of allocation engine executions.
        </p>
      </div>

      {err && <Callout tone="warn">{err}</Callout>}

      {!loading && rows.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {statuses.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`min-h-[36px] rounded-[var(--na-radius-md)] border px-3 py-1.5 text-[13px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] active:opacity-80 disabled:opacity-50 ${
                  statusFilter === st
                    ? 'border-[var(--na-ink-primary)] bg-[var(--na-ink-primary)] text-[var(--na-ink-inverse)]'
                    : 'border-[var(--na-border-strong)] bg-[var(--na-surface)] text-[var(--na-ink-primary)] hover:bg-[var(--na-well)]'
                }`}
              >
                {st === 'ALL' ? 'All runs' : st}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--na-ink-tertiary)]"
                aria-hidden="true"
              />
              <input
                type="search"
                aria-label="Filter runs by number, scenario, or policy"
                placeholder="Filter runs…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="input pl-9 sm:w-56"
              />
            </div>
            <span className="tabular-nums text-[13px] text-[var(--na-ink-secondary)]">
              {fmtNum(filteredRows.length)} of {fmtNum(rows.length)}
            </span>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)]">
        {loading ? (
          <Spinner label="Loading run history…" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No allocation runs yet"
            hint="Start a run from the overview page to build the decision history."
            icon={<History className="h-8 w-8" />}
          />
        ) : filteredRows.length === 0 ? (
          <div className="py-10 text-center text-[14px] text-[var(--na-ink-secondary)]">
            No runs match the current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px]">
              <thead>
                <tr>
                  <th className="th">
                    <button
                      type="button"
                      onClick={() => toggleSort('number')}
                      className="inline-flex items-center gap-1 rounded-[var(--na-radius-sm)] font-semibold text-[var(--na-ink-secondary)] hover:text-[var(--na-ink-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] active:opacity-80 disabled:opacity-50"
                    >
                      Run
                      <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="th">Scenario</th>
                  <th className="th">Policy</th>
                  <th className="th">
                    <button
                      type="button"
                      onClick={() => toggleSort('status')}
                      className="inline-flex items-center gap-1 rounded-[var(--na-radius-sm)] font-semibold text-[var(--na-ink-secondary)] hover:text-[var(--na-ink-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] active:opacity-80 disabled:opacity-50"
                    >
                      Status
                      <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="th">Solver outcome</th>
                  <th className="th text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('runtime')}
                      className="inline-flex items-center gap-1 rounded-[var(--na-radius-sm)] font-semibold text-[var(--na-ink-secondary)] hover:text-[var(--na-ink-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] active:opacity-80 disabled:opacity-50"
                    >
                      Duration
                      <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </th>
                  <th className="th text-right">
                    <button
                      type="button"
                      onClick={() => toggleSort('createdAt')}
                      className="inline-flex items-center gap-1 rounded-[var(--na-radius-sm)] font-semibold text-[var(--na-ink-secondary)] hover:text-[var(--na-ink-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] active:opacity-80 disabled:opacity-50"
                    >
                      Started
                      <ArrowUpDown className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((r) => (
                  <tr
                    key={r.id}
                    className="tr-hover cursor-pointer"
                    onClick={() => nav(`/admin/runs/${r.id}`)}
                  >
                    <td className="td">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            nav(`/admin/runs/${r.id}`);
                          }}
                          className="font-display tabular-nums font-semibold text-[var(--na-ink-primary)] hover:text-[var(--na-accent-ink)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] active:opacity-80 disabled:opacity-50"
                        >
                          #{r.number}
                        </button>
                        {r.reallocation && <Badge tone="saffron">reallocation</Badge>}
                        {r.parentRunNumber && (
                          <span className="tabular-nums text-[12px] text-[var(--na-ink-secondary)]">
                            from #{r.parentRunNumber}
                          </span>
                        )}
                        {r.stale && <Badge tone="gray">superseded</Badge>}
                      </div>
                    </td>
                    <td className="td font-medium">{r.scenario}</td>
                    <td className="td text-[var(--na-ink-secondary)]">{r.policyName}</td>
                    <td className="td">
                      <Badge tone={statusTone(r.status)}>{r.status}</Badge>
                    </td>
                    <td className="td text-[var(--na-ink-secondary)]">{r.solverStatus ?? '—'}</td>
                    <td className="td tabular-nums text-right text-[var(--na-ink-secondary)]">
                      {fmtMs(r.totalRuntimeMs)}
                    </td>
                    <td className="td tabular-nums text-right text-[var(--na-ink-secondary)]">
                      {fmtTime(r.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
