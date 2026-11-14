import React, { useEffect, useMemo, useState } from 'react';
import { ScrollText, Search } from 'lucide-react';
import { apiGet, errMsg } from '../../api/client';
import { AuditRow } from '../../api/types';
import {
  Spinner,
  Callout,
  Badge,
  Disclosure,
  fmtTime,
  fmtNum,
  EmptyState,
  formatEnumLabel,
} from '../../components/ui';

export default function AdminAudit() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [query, setQuery] = useState('');
  const [actionFilter, setActionFilter] = useState('ALL');

  useEffect(() => {
    (async () => {
      try {
        const d = await apiGet<any>('/admin/audit', { page: 0, size: 60 });
        setRows(d.content ?? []);
      } catch (e) {
        setErr(errMsg(e));
      }
      setLoading(false);
    })();
  }, []);

  const actions = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.action) set.add(r.action);
    });
    return Array.from(set).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (actionFilter !== 'ALL' && r.action !== actionFilter) return false;
      if (!q) return true;
      return (
        r.action.toLowerCase().includes(q) ||
        r.actor.toLowerCase().includes(q) ||
        r.summary.toLowerCase().includes(q)
      );
    });
  }, [rows, query, actionFilter]);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[var(--na-text-h1)] font-semibold tracking-tight text-[var(--na-ink-primary)]">
          Audit trail
        </h1>
        <p className="mt-1.5 text-[var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
          Chronological record of sign-ins, scenario loads, allocation runs, policy simulations, and operational changes.
        </p>
      </header>

      {err && <Callout tone="warn">{err}</Callout>}

      {!loading && rows.length > 0 && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-1 flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 sm:max-w-xs">
              <label htmlFor="audit-search" className="label">
                Filter entries
              </label>
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--na-ink-tertiary)]"
                  aria-hidden="true"
                />
                <input
                  id="audit-search"
                  type="search"
                  className="input pl-9"
                  placeholder="Search actor, action, or summary…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <div className="sm:w-56">
              <label htmlFor="audit-action-filter" className="label">
                Action type
              </label>
              <select
                id="audit-action-filter"
                className="input"
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
              >
                <option value="ALL">All actions</option>
                {actions.map((a) => (
                  <option key={a} value={a}>
                    {formatEnumLabel(a)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="tabular-nums text-[13px] font-medium text-[var(--na-ink-secondary)]">
            Showing {fmtNum(filtered.length)} of {fmtNum(rows.length)} entries
          </div>
        </div>
      )}

      <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)]">
        {loading ? (
          <Spinner label="Loading audit trail…" />
        ) : rows.length === 0 ? (
          <EmptyState title="No audit entries yet" icon={<ScrollText className="h-7 w-7" />} />
        ) : filtered.length === 0 ? (
          <EmptyState
            title="No matching audit entries"
            hint="Clear the search filter or choose another action type."
            icon={<ScrollText className="h-7 w-7" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px]">
              <thead>
                <tr>
                  <th className="th">When</th>
                  <th className="th">Action</th>
                  <th className="th">Actor</th>
                  <th className="th">Summary</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const hasDetails = r.details && Object.keys(r.details).length > 0;
                  return (
                    <tr key={r.id} className="tr-hover align-top">
                      <td className="td tabular-nums whitespace-nowrap text-[var(--na-ink-secondary)]">
                        {fmtTime(r.at)}
                      </td>
                      <td className="td whitespace-nowrap">
                        <Badge tone="navy">{formatEnumLabel(r.action)}</Badge>
                      </td>
                      <td className="td whitespace-nowrap font-medium text-[var(--na-ink-primary)]">
                        {r.actor}
                      </td>
                      <td className="td text-[var(--na-ink-secondary)]">
                        <div className="text-[var(--na-ink-primary)]">{r.summary}</div>
                        {hasDetails && (
                          <div className="mt-2">
                            <Disclosure label="Inspect payload">
                              <pre className="na-mono max-h-48 overflow-auto whitespace-pre-wrap break-words text-[12px] text-[var(--na-ink-primary)]">
                                {JSON.stringify(r.details, null, 2)}
                              </pre>
                            </Disclosure>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
