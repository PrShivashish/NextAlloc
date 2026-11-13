import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RefreshCcw, Plus, Trash2, ArrowRight } from 'lucide-react';
import { apiGet, apiPost, errMsg } from '../../api/client';
import {
  SectionHeader,
  Callout,
  Badge,
  KV,
  MetricBand,
  fmtNum,
  fmtTime,
  EmptyState,
} from '../../components/ui';

interface Change {
  type: string;
  opportunityId?: number;
  candidateId?: number;
  newCapacity?: number;
}

export default function AdminReallocation() {
  const nav = useNavigate();
  const [runs, setRuns] = useState<any[]>([]);
  const [opps, setOpps] = useState<any[]>([]);
  const [baseRunId, setBaseRunId] = useState<number | null>(null);
  const [placed, setPlaced] = useState<Record<number, number>>({});
  const [changes, setChanges] = useState<Change[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    (async () => {
      try {
        const [r, o] = await Promise.all([
          apiGet<any>('/admin/runs', { page: 0, size: 8 }),
          apiGet<any>('/opportunities', { page: 0, size: 100 }),
        ]);
        const completed = (r.content ?? []).filter((x: any) => String(x.status ?? '').toLowerCase() === 'completed');
        setRuns(completed);
        if (completed.length > 0) setBaseRunId(completed[0].id);
        setOpps(o.content ?? []);
      } catch (e) {
        setErr(errMsg(e));
      }
    })();
  }, []);

  // How many people actually hold a seat in each opportunity for the chosen base run —
  // shown in the picker so a capacity change is always aimed at a live opportunity.
  useEffect(() => {
    if (baseRunId == null) {
      setPlaced({});
      return;
    }
    (async () => {
      try {
        const c = await apiGet<any[]>(`/admin/runs/${baseRunId}/conflicts`);
        const m: Record<number, number> = {};
        (c ?? []).forEach((x) => {
          m[x.opportunityId] = x.allocated ?? 0;
        });
        setPlaced(m);
      } catch {
        setPlaced({});
      }
    })();
  }, [baseRunId]);

  const mostPlacedOpp = () => {
    let best: any = null;
    for (const o of opps) {
      if ((placed[o.id] ?? 0) > (best ? (placed[best.id] ?? 0) : 0)) best = o;
    }
    return best ?? opps[0];
  };

  const addChange = (c: Change) => setChanges((cs) => [...cs, c]);
  const removeChange = (i: number) => setChanges((cs) => cs.filter((_, x) => x !== i));

  const run = async () => {
    if (baseRunId == null) {
      setErr('Select the completed run to reallocate from.');
      return;
    }
    if (changes.length === 0) {
      setErr('Add at least one operational change.');
      return;
    }
    setBusy(true);
    setErr('');
    setResult(null);
    try {
      const r = await apiPost<any>('/admin/reallocations', { baseRunId, changes });
      const id = r.id;
      for (let i = 0; i < 20; i++) {
        await new Promise((res) => setTimeout(res, 1500));
        const d = await apiGet<any>(`/admin/runs/${id}`);
        if (d.run.status !== 'Queued' && !d.run.status.toLowerCase().includes('progress')) {
          const diff = await apiGet<any>(`/admin/reallocations/${id}/diff`).catch(() => null);
          setResult({ run: d.run, diff });
          break;
        }
      }
      const d = await apiGet<any>(`/admin/runs/${id}`);
      const diff = await apiGet<any>(`/admin/reallocations/${id}/diff`).catch(() => null);
      setResult({ run: d.run, diff });
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  };

  const diffTone = (status: string) => {
    if (status === 'MOVED') return 'saffron';
    if (status === 'ADDED') return 'green';
    if (status === 'REMOVED') return 'red';
    return 'gray';
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[var(--na-text-h1)] font-semibold tracking-tight text-[var(--na-ink-primary)]">
          Reallocation
        </h1>
        <p className="mt-1.5 text-[var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
          Apply operational changes (seat capacity adjustments or opportunity withdrawals), re-optimize, and review candidate movement against the historical baseline.
        </p>
      </header>

      {err && <Callout tone="warn">{err}</Callout>}

      <div className="grid gap-6 xl:grid-cols-12">
        <section
          aria-label="Configure operational changes"
          className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6 xl:col-span-5"
        >
          <SectionHeader
            title="1. Historical baseline"
            sub="Select a completed run as the reference point."
          />

          <div>
            <label htmlFor="realloc-base-run" className="label">
              Completed allocation run
            </label>
            <select
              id="realloc-base-run"
              className="input"
              value={baseRunId ?? ''}
              onChange={(e) => setBaseRunId(Number(e.target.value))}
            >
              {runs.map((r) => (
                <option key={r.id} value={r.id}>
                  Run #{r.number}: {r.scenario}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-6 border-t border-[var(--na-border)] pt-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-[15px] font-semibold text-[var(--na-ink-primary)]">
                2. Operational changes
              </h3>
              <span className="tabular-nums text-[12.5px] text-[var(--na-ink-secondary)]">
                {changes.length} queued
              </span>
            </div>

            <div className="space-y-2.5">
              {changes.map((c, i) => (
                <div
                  key={i}
                  className="rounded-[var(--na-radius-md)] bg-[var(--na-stone)] p-3"
                >
                  {c.type === 'CAPACITY' ? (
                    <div className="flex flex-wrap items-center gap-2.5">
                      <select
                        aria-label="Opportunity for capacity change"
                        className="input min-w-0 flex-1"
                        value={c.opportunityId ?? ''}
                        onChange={(e) =>
                          setChanges((cs) =>
                            cs.map((x, j) =>
                              j === i ? { ...x, opportunityId: Number(e.target.value) } : x
                            )
                          )
                        }
                      >
                        <option value="">Select opportunity…</option>
                        {opps.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.title}: {o.capacity} seats ({placed[o.id] ?? 0} filled)
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        aria-label="New seat capacity"
                        min={0}
                        max={200}
                        className="input tabular-nums w-24"
                        value={c.newCapacity ?? 0}
                        onChange={(e) =>
                          setChanges((cs) =>
                            cs.map((x, j) =>
                              j === i ? { ...x, newCapacity: Number(e.target.value) } : x
                            )
                          )
                        }
                        placeholder="Seats"
                      />
                      <button
                        type="button"
                        aria-label="Remove change"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeChange(i)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2.5">
                      <select
                        aria-label="Opportunity to withdraw"
                        className="input min-w-0 flex-1"
                        value={c.opportunityId ?? ''}
                        onChange={(e) =>
                          setChanges((cs) =>
                            cs.map((x, j) =>
                              j === i ? { ...x, opportunityId: Number(e.target.value) } : x
                            )
                          )
                        }
                      >
                        <option value="">Select opportunity to withdraw…</option>
                        {opps.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.title}
                          </option>
                        ))}
                      </select>
                      <Badge tone="red">Withdrawn</Badge>
                      <button
                        type="button"
                        aria-label="Remove change"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removeChange(i)}
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const o = mostPlacedOpp();
                    if (o) addChange({ type: 'CAPACITY', opportunityId: o.id, newCapacity: 1 });
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Change capacity</span>
                </button>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const o = mostPlacedOpp();
                    if (o) addChange({ type: 'WITHDRAW_OPPORTUNITY', opportunityId: o.id });
                  }}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  <span>Withdraw opportunity</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-[var(--na-border)] pt-5">
            <button
              type="button"
              className="btn btn-primary w-full disabled:cursor-not-allowed disabled:opacity-50"
              onClick={run}
              disabled={busy || changes.length === 0}
            >
              <RefreshCcw className="h-4 w-4" aria-hidden="true" />
              <span>{busy ? 'Re-optimizing…' : 'Apply changes and re-optimize'}</span>
            </button>
            {changes.length === 0 && (
              <p className="mt-2 text-center text-[12px] text-[var(--na-ink-tertiary)]">
                Queue at least one operational adjustment above to run reallocation.
              </p>
            )}
          </div>
        </section>

        <section aria-label="Reallocation comparison results" className="space-y-6 xl:col-span-7">
          {!result ? (
            <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6">
              <EmptyState
                title="Operational reallocation comparison will appear here"
                hint="Select a baseline run and queue operational adjustments on the left, then apply & re-optimize to inspect candidate movements."
                icon={<ArrowRight className="h-7 w-7" />}
              />
              <div className="mt-5 rounded-[var(--na-radius-md)] border border-[var(--na-border)] bg-[var(--na-well)] p-4 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                <div className="font-semibold text-[var(--na-ink-primary)]">
                  Operational adjustment requirement:
                </div>
                <p className="mt-1 leading-relaxed">
                  Add an operational change to compare its effect on the current allocation. To evaluate seat capacity changes, provider adjustments, or reallocating unaccepted seats, queue an operational adjustment above before re-optimizing.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6">
                <SectionHeader
                  title={`New operational run #${result.run.number}`}
                  sub={`Derived from historical baseline run #${result.run.parentRunNumber ?? '—'}`}
                  right={
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => nav(`/admin/runs/${result.run.id}`)}
                    >
                      <span>Open run details</span>
                      <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  }
                />

                <div className="grid gap-x-8 sm:grid-cols-3">
                  <KV
                    k="Operational status"
                    v={
                      <Badge tone={result.run.status === 'Completed' ? 'green' : 'amber'}>
                        {result.run.status}
                      </Badge>
                    }
                  />
                  <KV k="Solver status" v={result.run.solverStatus ?? '—'} />
                  <KV k="Completed at" v={fmtTime(result.run.completedAt)} />
                </div>
              </div>

              {result.diff && (
                <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6">
                  <SectionHeader
                    title="Candidate movement breakdown"
                    sub={`Previous placement (run #${result.diff.parentRunNumber}) compared against current operational placement (run #${result.run.number})`}
                  />

                  <MetricBand
                    className="mb-5"
                    items={[
                      { label: 'Moved', value: fmtNum(result.diff.moved), accent: true },
                      { label: 'Added', value: fmtNum(result.diff.added) },
                      { label: 'Removed', value: fmtNum(result.diff.removed) },
                      { label: 'Unchanged', value: fmtNum(result.diff.unchanged) },
                    ]}
                  />

                  {result.diff.moved + result.diff.added + result.diff.removed === 0 && (
                    <div className="mb-5">
                      <Callout tone="info" title="No placement changes required">
                        This operational change did not alter the optimal allocation; every candidate remains in their baseline placement.
                      </Callout>
                    </div>
                  )}

                  <div className="max-h-[340px] overflow-x-auto overflow-y-auto">
                    <table className="w-full min-w-[540px]">
                      <thead className="sticky top-0 bg-[var(--na-surface)]">
                        <tr className="border-b border-[var(--na-border-strong)]">
                          <th className="th pl-0">Candidate</th>
                          <th className="th">Previous placement</th>
                          <th className="th">Current placement</th>
                          <th className="th pr-0 text-right">Movement</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(result.diff.entries ?? []).map((e: any) => (
                          <tr key={e.candidateId} className="tr-hover">
                            <td className="td pl-0 font-medium text-[var(--na-ink-primary)]">
                              {e.candidateName}
                            </td>
                            <td className="td text-[var(--na-ink-secondary)]">
                              {e.before ?? 'Unallocated'}
                            </td>
                            <td className="td font-medium text-[var(--na-ink-primary)]">
                              {e.after ?? 'Unallocated'}
                            </td>
                            <td className="td pr-0 text-right">
                              <Badge tone={diffTone(e.status)}>{e.status}</Badge>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}
