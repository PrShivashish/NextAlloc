import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FlaskConical, Play, RotateCcw, SlidersHorizontal, ArrowRight } from 'lucide-react';
import { apiGet, apiPost, errMsg } from '../../api/client';
import { PolicyPreset, SimulationRow } from '../../api/types';
import {
  SectionHeader,
  Spinner,
  Callout,
  Badge,
  statusTone,
  fmtNum,
  fmtPct,
  fmtMs,
  fmtTime,
  EmptyState,
} from '../../components/ui';

const WEIGHT_KEYS: [string, string][] = [
  ['skills', 'Skills'],
  ['qualification', 'Qualification'],
  ['interest', 'Interest'],
  ['location', 'Location'],
  ['preference', 'Preference'],
  ['learning', 'Learning potential'],
  ['experience', 'Experience'],
];

export default function AdminWhatIf() {
  const nav = useNavigate();
  const [presets, setPresets] = useState<PolicyPreset[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [baseRunId, setBaseRunId] = useState<number | null>(null);
  const [weights, setWeights] = useState<Record<string, number>>({
    skills: 35,
    qualification: 15,
    interest: 15,
    location: 10,
    preference: 10,
    learning: 10,
    experience: 5,
  });
  const [fullCoverage, setFullCoverage] = useState(false);
  const [floor, setFloor] = useState<number>(0);
  const [policyVersion, setPolicyVersion] = useState<string>('v2');
  const [activePresetKey, setActivePresetKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sims, setSims] = useState<SimulationRow[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [p, r, s] = await Promise.all([
          apiGet<PolicyPreset[]>('/admin/policies'),
          apiGet<any>('/admin/runs', { page: 0, size: 8 }),
          apiGet<any>('/admin/simulations', { page: 0, size: 8 }),
        ]);
        setPresets(p);
        const defaultPreset =
          p.find((x) => x.key === 'balanced_v2') ?? p.find((x) => x.isDefault) ?? p[0];
        if (defaultPreset) {
          setActivePresetKey(defaultPreset.key);
          setPolicyVersion(defaultPreset.version || 'v2');
          try {
            setWeights(JSON.parse(defaultPreset.weightsJson));
          } catch {
            // keep defaults
          }
          setFullCoverage(!!defaultPreset.fullCoverage);
          setFloor(defaultPreset.fairnessFloorPct ?? 0);
        }
        const completed = (r.content ?? []).filter(
          (x: any) => String(x.status ?? '').toLowerCase() === 'completed' && !x.reallocation
        );
        setRuns(completed);
        if (completed.length > 0) setBaseRunId(completed[0].id);
        setSims(s.content ?? []);
      } catch (e) {
        setErr(errMsg(e));
      }
    })();
  }, []);

  const total = useMemo(() => Object.values(weights).reduce((a, b) => a + b, 0), [weights]);

  const loadPreset = (key: string) => {
    const p = presets.find((x) => x.key === key);
    if (!p) return;
    setActivePresetKey(p.key);
    try {
      setWeights(JSON.parse(p.weightsJson));
    } catch {
      // ignore malformed preset json
    }
    setFullCoverage(!!p.fullCoverage);
    setFloor(p.fairnessFloorPct ?? 0);
    setPolicyVersion(p.version || 'v2');
  };

  const refreshSims = async () => {
    const s = await apiGet<any>('/admin/simulations', { page: 0, size: 8 });
    setSims(s.content ?? []);
    return (s.content ?? []) as SimulationRow[];
  };

  const runSim = async () => {
    if (baseRunId == null) {
      setErr('Please select the allocation run to compare against.');
      return;
    }
    setBusy(true);
    setErr('');
    try {
      await apiPost('/admin/simulations', {
        baseRunId,
        weights,
        fullCoverage,
        fairnessFloorPct: floor || null,
        policyVersion,
      });
      for (let i = 0; i < 50; i++) {
        await new Promise((res) => setTimeout(res, 1200));
        const list = await refreshSims();
        const top = list[0];
        if (top && !['Running', 'Queued', 'In progress'].includes(top.status)) break;
      }
      await refreshSims();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  };

  const lastSim = sims[0];
  const lastSimRunning =
    !!lastSim && ['Running', 'Queued', 'In progress'].includes(lastSim.status);
  let lastMetrics: any = null;
  try {
    if (lastSim?.metricsJson) lastMetrics = JSON.parse(lastSim.metricsJson);
  } catch {
    // ignore invalid json
  }

  const simulationStatus = (lastSim?.status ?? '').toLowerCase();

  const hasComparisonMetrics =
    lastMetrics !== null &&
    typeof lastMetrics === 'object' &&
    ['current', 'scenario'].every(
      (section) =>
        lastMetrics[section] !== null &&
        typeof lastMetrics[section] === 'object' &&
        ['allocated', 'suitability', 'preferenceSatisfaction', 'seatUtilization'].every(
          (field) =>
            typeof lastMetrics[section][field] === 'number' &&
            Number.isFinite(lastMetrics[section][field])
        )
    ) &&
    typeof lastMetrics.affected === 'number' &&
    Number.isFinite(lastMetrics.affected) &&
    typeof lastMetrics.stability === 'number' &&
    Number.isFinite(lastMetrics.stability);

  const renderLatestSimulation = () => {
    if (lastSimRunning) {
      return (
        <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
          <Spinner label="Running policy simulation…" />
        </div>
      );
    }
    if (simulationStatus === 'infeasible' || simulationStatus.includes('infeasible')) {
      return (
        <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
          <SectionHeader title="Simulation infeasible" />
          <p className="text-[14px] text-[var(--na-ink-primary)]">
            {typeof lastMetrics?.note === 'string'
              ? lastMetrics.note
              : 'The selected policy constraints cannot all be satisfied.'}
          </p>
          <p className="mt-2 text-[13.5px] text-[var(--na-ink-secondary)]">
            No new allocation was published. The baseline published allocation remains unchanged.
          </p>
        </div>
      );
    }
    if (simulationStatus === 'failed' || simulationStatus.includes('failed')) {
      return (
        <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
          <Callout tone="warn" title="Simulation could not be completed">
            {typeof lastMetrics?.note === 'string'
              ? lastMetrics.note
              : 'Simulation failed. Review the service logs before retrying.'}
          </Callout>
        </div>
      );
    }
    if (
      (simulationStatus === 'completed' || simulationStatus.includes('completed')) &&
      hasComparisonMetrics
    ) {
      return (
        <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
          <SectionHeader
            title="Simulated outcome vs baseline"
            sub={`${lastSim?.policyName} (${lastMetrics?.policyVersion ?? 'v1'}) in ${fmtMs(lastSim.runtimeMs)}`}
            right={<Badge tone={statusTone(lastSim?.status ?? '')}>{lastSim?.status}</Badge>}
          />

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--na-border-strong)]">
                  <th className="py-2 pr-3 text-left text-[13px] font-medium text-[var(--na-ink-secondary)]">
                    Metric
                  </th>
                  <th className="px-3 py-2 text-right text-[13px] font-medium text-[var(--na-ink-secondary)]">
                    Published baseline
                  </th>
                  <th className="py-2 pl-3 text-right text-[13px] font-medium text-[var(--na-ink-secondary)]">
                    Simulated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--na-border-subtle)]">
                <SimRow
                  k="Candidates allocated"
                  a={lastMetrics.current.allocated}
                  b={lastMetrics.scenario.allocated}
                />
                <SimRow
                  k="Average suitability"
                  a={lastMetrics.current.suitability}
                  b={lastMetrics.scenario.suitability}
                  pct
                />
                <SimRow
                  k="Preference match"
                  a={lastMetrics.current.preferenceSatisfaction}
                  b={lastMetrics.scenario.preferenceSatisfaction}
                  pct
                />
                <SimRow
                  k="Seat utilization"
                  a={lastMetrics.current.seatUtilization}
                  b={lastMetrics.scenario.seatUtilization}
                  pct
                />
              </tbody>
            </table>
          </div>

          <div className="mt-4 rounded-[var(--na-radius-md)] bg-[var(--na-stone)] p-3.5 text-[13px] leading-relaxed text-[var(--na-ink-primary)]">
            <span className="tabular-nums font-semibold">{lastMetrics.affected}</span> candidate
            {lastMetrics.affected === 1 ? '' : 's'} would change seats, while{' '}
            <span className="tabular-nums font-semibold">{fmtPct(lastMetrics.stability)}</span> of
            assignments stay unchanged. This is a simulated comparison only; the published allocation is untouched.
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
        <EmptyState
          title="No simulation comparison yet"
          hint="Adjust policy weights on the left and run a simulation to compare against the published baseline."
          icon={<FlaskConical className="h-7 w-7" />}
        />
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[var(--na-text-h1)] font-semibold tracking-tight text-[var(--na-ink-primary)]">
          Policy lab
        </h1>
        <p className="mt-1.5 text-[var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
          Test alternative scoring weights and fairness constraints against a completed run without altering published allocations.
        </p>
      </header>

      <Callout tone="info" title="Simulated policy sandbox">
        Outcomes generated here are <strong>simulated comparisons only</strong>. Published candidate
        offers and official allocation runs remain unchanged unless you run a new allocation from the overview.
      </Callout>

      {err && <Callout tone="warn">{err}</Callout>}

      {runs.length === 0 && (
        <Callout tone="info" title="Baseline run required">
          A completed allocation run is needed as the baseline.{' '}
          <button
            type="button"
            className="whitespace-nowrap font-semibold text-[var(--na-accent-ink)] underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
            onClick={() => nav('/admin')}
          >
            Open overview
          </button>{' '}
          to execute a run.
        </Callout>
      )}

      <div className="grid gap-6 xl:grid-cols-12">
        <section
          aria-label="Policy configuration"
          className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6 xl:col-span-7"
        >
          <SectionHeader title="Configure simulated policy" />
          <div className="space-y-6">
            <div>
              <label htmlFor="whatif-base-run" className="label">
                Baseline allocation run
              </label>
              <select
                id="whatif-base-run"
                className="input"
                value={baseRunId ?? ''}
                onChange={(e) => setBaseRunId(Number(e.target.value))}
              >
                {runs.map((r) => (
                  <option key={r.id} value={r.id}>
                    Run #{r.number}: {r.scenario} ({r.policyName})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="label">Demonstration policy presets</div>
              <div className="flex flex-wrap gap-2">
                {presets.map((p) => {
                  const isCurrent = activePresetKey === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      className={`btn btn-sm ${
                        isCurrent
                          ? 'bg-[var(--na-anchor)] text-[var(--na-anchor-ink)]'
                          : 'border border-[var(--na-border-strong)] bg-[var(--na-surface)] text-[var(--na-ink-primary)] hover:bg-[var(--na-stone)]'
                      }`}
                      onClick={() => loadPreset(p.key)}
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-[12.5px] text-[var(--na-ink-secondary)]">
                Default configurable demonstration weights; not official government policy weights.
              </p>
            </div>

            <div className="border-t border-[var(--na-border)] pt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-[var(--na-ink-primary)]">
                  <SlidersHorizontal className="h-4 w-4 text-[var(--na-ink-secondary)]" aria-hidden="true" />
                  <span>Scoring weights (must total 100%)</span>
                </div>
                <Badge tone={total === 100 ? 'green' : 'red'}>
                  <span className="tabular-nums">{total}%</span>
                </Badge>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {WEIGHT_KEYS.map(([k, label]) => {
                  const sliderId = `weight-slider-${k}`;
                  return (
                    <div key={k}>
                      <div className="mb-1.5 flex items-center justify-between text-[13px]">
                        <label htmlFor={sliderId} className="font-medium text-[var(--na-ink-primary)]">
                          {label}
                        </label>
                        <span className="tabular-nums font-semibold text-[var(--na-ink-secondary)]">
                          {weights[k]}%
                        </span>
                      </div>
                      <input
                        id={sliderId}
                        type="range"
                        min={0}
                        max={60}
                        value={weights[k] ?? 0}
                        onChange={(e) => {
                          setWeights((w) => ({ ...w, [k]: Number(e.target.value) }));
                          setActivePresetKey(null);
                        }}
                        className="w-full cursor-pointer accent-[var(--na-accent)]"
                      />
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 border-t border-[var(--na-border)] pt-5 md:grid-cols-2">
              <label className="flex cursor-pointer items-start justify-between gap-3 rounded-[var(--na-radius-md)] bg-[var(--na-stone)] p-4">
                <div>
                  <div className="text-[13.5px] font-semibold text-[var(--na-ink-primary)]">
                    Allocate every candidate
                  </div>
                  <div className="mt-0.5 text-[12.5px] text-[var(--na-ink-secondary)]">
                    Hard constraint requiring zero unallocated eligible candidates.
                  </div>
                </div>
                <input
                  type="checkbox"
                  className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer accent-[var(--na-accent)]"
                  checked={fullCoverage}
                  onChange={(e) => {
                    setFullCoverage(e.target.checked);
                    setActivePresetKey(null);
                  }}
                />
              </label>

              <div>
                <div className="mb-1.5 flex items-center justify-between gap-2 text-[13px]">
                  <label htmlFor="whatif-floor-slider" className="font-medium text-[var(--na-ink-primary)]">
                    {policyVersion === 'v1'
                      ? 'Minimum placement rate per location group (v1)'
                      : 'Minimum placement rate for eligible rural candidates (v2)'}
                  </label>
                  <span className="tabular-nums shrink-0 font-semibold text-[var(--na-ink-secondary)]">
                    {floor}%
                  </span>
                </div>
                <input
                  id="whatif-floor-slider"
                  type="range"
                  min={0}
                  max={95}
                  value={floor}
                  onChange={(e) => {
                    setFloor(Number(e.target.value));
                    setActivePresetKey(null);
                  }}
                  className="w-full cursor-pointer accent-[var(--na-accent)]"
                />
                <p className="mt-1.5 text-[12px] leading-relaxed text-[var(--na-ink-secondary)]">
                  {policyVersion === 'v1'
                    ? `Legacy policy (v1): places at least ${floor}% of eligible applicants separately within each location group (Rural, Urban, Semi-urban).`
                    : `Demonstration policy (v2): places at least ${floor}% of eligible rural applicants with at least one matching opportunity.`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                className="btn btn-primary"
                onClick={runSim}
                disabled={busy || baseRunId == null || total !== 100}
              >
                <Play className="h-4 w-4" aria-hidden="true" />
                <span>{busy ? 'Simulating…' : 'Run what-if simulation'}</span>
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  const effectiveDefaultKey =
                    presets.find((p) => p.key === 'balanced_v2')?.key ??
                    presets.find((p) => p.isDefault)?.key ??
                    'balanced_v2';
                  loadPreset(effectiveDefaultKey);
                }}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>Reset to defaults</span>
              </button>
            </div>

            {total !== 100 && (
              <div role="alert" className="text-[13px] font-medium text-[var(--na-error-text)]">
                Weights must total exactly 100% (currently {total}%).
              </div>
            )}
          </div>
        </section>

        <section aria-label="Simulation comparison and history" className="space-y-6 xl:col-span-5">
          {renderLatestSimulation()}

          <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
            <SectionHeader title="Simulation history" />
            {sims.length === 0 ? (
              <p className="py-4 text-center text-[13.5px] text-[var(--na-ink-secondary)]">
                Simulations you run will appear here.
              </p>
            ) : (
              <div className="divide-y divide-[var(--na-border-subtle)]">
                {sims.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-semibold text-[var(--na-ink-primary)]">
                        {s.policyName}
                      </div>
                      <div className="tabular-nums mt-0.5 flex flex-wrap gap-x-2 text-[12.5px] text-[var(--na-ink-secondary)]">
                        <span>Base run #{s.baseRunId}</span>
                        <span className="text-[var(--na-ink-tertiary)]">{fmtTime(s.createdAt)}</span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {s.affected != null && (
                        <Badge tone="saffron">
                          <span className="tabular-nums">{s.affected} affected</span>
                        </Badge>
                      )}
                      <Badge tone={statusTone(s.status)}>{s.status}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function SimRow({ k, a, b, pct }: { k: string; a: number; b: number; pct?: boolean }) {
  const better = b > a;
  const worse = b < a;
  return (
    <tr>
      <td className="py-2.5 pr-3 text-[13.5px] text-[var(--na-ink-secondary)]">{k}</td>
      <td className="tabular-nums px-3 py-2.5 text-right text-[13.5px] font-medium text-[var(--na-ink-secondary)]">
        {pct ? fmtPct(a) : fmtNum(a)}
      </td>
      <td className="tabular-nums py-2.5 pl-3 text-right text-[13.5px] font-semibold">
        <span className="inline-flex items-center justify-end gap-1.5">
          <ArrowRight className="h-3.5 w-3.5 text-[var(--na-ink-tertiary)]" aria-hidden="true" />
          <span
            className={
              better
                ? 'text-[var(--na-status-success-text)]'
                : worse
                  ? 'text-[var(--na-status-error-text)]'
                  : 'text-[var(--na-ink-primary)]'
            }
          >
            {pct ? fmtPct(b) : fmtNum(b)}
          </span>
        </span>
      </td>
    </tr>
  );
}
