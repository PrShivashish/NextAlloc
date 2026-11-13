import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  Cpu,
  Layers,
  FileCheck,
  TrendingUp,
  FileText,
  AlertCircle,
} from 'lucide-react';
import { apiGet, errMsg } from '../../api/client';
import { Spinner, Callout, KV } from '../../components/ui';

interface Step {
  n: number;
  title: string;
  what: string;
  why: string;
  data: Record<string, any> | null;
  path: string | null;
}

const PILLARS = [
  { id: 1, label: '01 · Dataset & Scenario', icon: Layers, range: [1, 2, 3] },
  { id: 2, label: '02 · Hard Eligibility Gating', icon: FileCheck, range: [4, 10] },
  { id: 3, label: '03 · Suitability Scoring', icon: Cpu, range: [5] },
  { id: 4, label: '04 · CP-SAT Global Solver', icon: Cpu, range: [6] },
  { id: 5, label: '05 · Counterfactual Baseline', icon: TrendingUp, range: [7] },
  { id: 6, label: '06 · Audit & Provenance', icon: FileText, range: [11, 12] },
  { id: 7, label: '07 · System Limitations', icon: AlertCircle, range: [13, 14] },
];

export default function AdminJudge() {
  const nav = useNavigate();
  const [steps, setSteps] = useState<Step[]>([]);
  const [open, setOpen] = useState<number>(1);
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setSteps(await apiGet<Step[]>('/admin/judge/steps'));
      } catch (e) {
        setErr(errMsg(e));
      }
      setLoading(false);
    })();
  }, []);

  const filteredSteps = steps.filter((s) => {
    if (activeFilter === 'SOLVER') return [5, 6, 7, 8].includes(s.n);
    if (activeFilter === 'GATES') return [1, 2, 3, 4, 10].includes(s.n);
    if (activeFilter === 'AUDIT') return [9, 11, 12, 13, 14].includes(s.n);
    return true;
  });

  return (
    <div className="space-y-8">
      {/* 1. Header with architectural context */}
      <header className="border-b border-[var(--na-border)] pb-5">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="font-display text-[length:var(--na-text-h1)] font-semibold leading-[var(--na-leading-tight)] text-[var(--na-ink-primary)]">
              Judge evaluation walkthrough
            </h1>
            <p className="mt-1.5 max-w-3xl text-[length:var(--na-text-body-sm)] leading-[var(--na-leading-relaxed)] text-[var(--na-ink-secondary)]">
              An evidence-backed walkthrough of NextAlloc’s data ingestion, deterministic hard gates, CP-SAT global optimization, and counterfactual baseline comparison for SIH25033.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--na-anchor)] px-3 py-1 text-[length:var(--na-text-caption)] font-medium text-[var(--na-anchor-ink)]">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--na-signal)]" aria-hidden="true" />
            Formal Evaluation Protocol
          </span>
        </div>

        {/* 2. Signature pipeline architecture banner */}
        <div className="mt-6 rounded-[var(--na-radius-lg)] bg-[var(--na-anchor)] p-5 text-[var(--na-anchor-ink)]">
          <div className="text-[length:var(--na-text-caption)] font-medium text-[var(--na-anchor-muted)]">
            The NextAlloc decision pipeline
          </div>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
            {PILLARS.map((p) => {
              const Icon = p.icon;
              const isMatch = p.range.includes(open);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    const firstStep = p.range[0];
                    if (steps.some((s) => s.n === firstStep)) {
                      setOpen(firstStep);
                    }
                  }}
                  className={`flex flex-col rounded-[var(--na-radius-md)] p-2.5 text-left transition-colors duration-150 ${
                    isMatch
                      ? 'bg-white/15 text-[var(--na-anchor-ink)] ring-1 ring-white/30'
                      : 'bg-white/5 text-[var(--na-anchor-muted)] hover:bg-white/10 hover:text-[var(--na-anchor-ink)]'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0 text-[var(--na-signal)]" aria-hidden="true" />
                  <span className="mt-1.5 text-[11.5px] font-medium leading-tight">
                    {p.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Category filter pills */}
        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Step categories">
            {[
              ['ALL', 'All 14 evaluation steps'],
              ['SOLVER', 'CP-SAT solver & baseline lift'],
              ['GATES', 'Eligibility & NOC gates'],
              ['AUDIT', 'Audit trail & system boundaries'],
            ].map(([val, label]) => {
              const active = activeFilter === val;
              return (
                <button
                  key={val}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setActiveFilter(val)}
                  className={`min-h-[36px] rounded-[var(--na-radius-sm)] px-3 py-1.5 text-[length:var(--na-text-caption)] font-medium transition-colors ${
                    active
                      ? 'bg-[var(--na-stone)] text-[var(--na-ink-primary)] font-semibold'
                      : 'text-[var(--na-ink-secondary)] hover:text-[var(--na-ink-primary)]'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(open === 0 ? 1 : 0)}
              className="text-[length:var(--na-text-caption)] font-medium text-[var(--na-accent-ink)] hover:underline"
            >
              {open === 0 ? 'Expand step 1' : 'Collapse all'}
            </button>
          </div>
        </div>
      </header>

      {err && <Callout tone="warn">{err}</Callout>}

      {loading ? (
        <Spinner label="Loading walkthrough narrative…" />
      ) : (
        <ol className="divide-y divide-[var(--na-border)] overflow-hidden rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)]">
          {filteredSteps.map((s) => {
            const isOpen = open === s.n;
            const panelId = `judge-step-panel-${s.n}`;

            return (
              <li
                key={s.n}
                className={
                  isOpen
                    ? 'border-l-[3px] border-l-[var(--na-accent)] bg-[var(--na-surface)]'
                    : 'transition-colors hover:bg-[var(--na-well)]'
                }
              >
                <button
                  type="button"
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  onClick={() => setOpen(isOpen ? 0 : s.n)}
                  className="flex w-full items-center gap-4 px-5 py-4 text-left transition-colors duration-150"
                >
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--na-radius-md)] font-display text-[13px] font-bold tabular-nums ${
                      isOpen
                        ? 'bg-[var(--na-anchor)] text-[var(--na-anchor-ink)]'
                        : 'bg-[var(--na-stone)] text-[var(--na-ink-primary)]'
                    }`}
                  >
                    {s.n}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-display text-[15px] font-semibold text-[var(--na-ink-primary)]">
                        {s.title}
                      </span>
                      {s.path && (
                        <span className="text-[11px] font-medium text-[var(--na-ink-tertiary)]">
                          · Live route connected
                        </span>
                      )}
                    </div>
                    {!isOpen && (
                      <div className="mt-0.5 line-clamp-1 text-[13px] text-[var(--na-ink-secondary)]">
                        {s.what}
                      </div>
                    )}
                  </div>
                  <span className="shrink-0 text-[var(--na-ink-secondary)]" aria-hidden="true">
                    {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </span>
                </button>

                {isOpen && (
                  <div
                    id={panelId}
                    className="border-t border-[var(--na-border)] bg-[var(--na-well)] px-5 py-5 sm:pl-[68px]"
                  >
                    <div className="space-y-5">
                      <div className="grid gap-6 md:grid-cols-2">
                        <div className="rounded-[var(--na-radius-md)] bg-[var(--na-surface)] p-4 border border-[var(--na-border)]">
                          <div className="mb-1 text-[12px] font-medium text-[var(--na-ink-secondary)]">
                            What the engine does
                          </div>
                          <p className="text-[14px] leading-relaxed text-[var(--na-ink-primary)]">
                            {s.what}
                          </p>
                        </div>
                        <div className="rounded-[var(--na-radius-md)] bg-[var(--na-surface)] p-4 border border-[var(--na-border)]">
                          <div className="mb-1 text-[12px] font-medium text-[var(--na-accent-ink)]">
                            Why it matters for fairness and governance
                          </div>
                          <p className="text-[14px] leading-relaxed text-[var(--na-ink-primary)]">
                            {s.why}
                          </p>
                        </div>
                      </div>

                      {s.data && Object.keys(s.data).length > 0 ? (
                        <div className="rounded-[var(--na-radius-md)] border border-[var(--na-border)] bg-[var(--na-surface)] p-4">
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-[12px] font-medium text-[var(--na-ink-secondary)]">
                              Active evaluation telemetry
                            </span>
                            <span className="inline-flex items-center rounded-full bg-[var(--na-accent-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--na-accent-ink)]">
                              Live run data
                            </span>
                          </div>
                          <div className="grid grid-cols-1 divide-y divide-[var(--na-border)] sm:grid-cols-2 sm:divide-y-0 sm:divide-x sm:gap-x-4">
                            {Object.entries(s.data).map(([k, v]) => {
                              const valStr = String(v);
                              const isOptimal = valStr === 'OPTIMAL';
                              const isFeasible = valStr === 'FEASIBLE';
                              const isInfeasible = valStr === 'INFEASIBLE';
                              return (
                                <div key={k} className="py-1">
                                  <KV
                                    k={k
                                      .replace(/([A-Z])/g, ' $1')
                                      .replace(/^./, (c) => c.toUpperCase())}
                                    v={
                                      isOptimal || isFeasible || isInfeasible ? (
                                        <span
                                          className={`inline-flex items-center rounded px-2 py-0.5 text-[11px] font-mono font-medium ${
                                            isOptimal
                                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                                              : isFeasible
                                                ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                                                : 'bg-red-500/10 text-red-700 dark:text-red-400'
                                          }`}
                                        >
                                          {valStr}
                                        </span>
                                      ) : (
                                        valStr
                                      )
                                    }
                                  />
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-[var(--na-radius-md)] border border-[var(--na-border)] bg-[var(--na-well)] p-3 text-[12px] text-[var(--na-ink-tertiary)] italic">
                          Conceptual evaluation stage: operational parameters defined prior to solver execution.
                        </div>
                      )}

                      {s.path && (
                        <div className="pt-1">
                          <button
                            type="button"
                            className="inline-flex min-h-[40px] items-center gap-2 whitespace-nowrap rounded-[var(--na-radius-md)] bg-[var(--na-anchor)] px-4 py-2 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-anchor-ink)] transition-colors hover:bg-[var(--na-anchor-2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                            onClick={() => nav(s.path!)}
                          >
                            <Compass className="h-4 w-4" aria-hidden="true" />
                            <span>Inspect live section</span>
                            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
