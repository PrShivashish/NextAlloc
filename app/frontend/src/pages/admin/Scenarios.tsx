import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Database,
  CheckCircle2,
  Flame,
  Globe2,
  Scale,
  ShieldAlert,
  Gauge,
  GitCompareArrows,
  Info,
  ArrowRight,
  type LucideIcon,
} from 'lucide-react';
import { apiGet, apiPost, errMsg } from '../../api/client';
import { ScenarioSummary, DatasetSummary } from '../../api/types';
import { SectionHeader, Spinner, Callout, Badge, fmtNum } from '../../components/ui';

const META: Record<string, { icon: LucideIcon; blurb: string }> = {
  STANDARD_SHOWCASE: {
    icon: Database,
    blurb: 'A realistic mixed field: diverse candidates, many sectors, genuine competition.',
  },
  MICRO_CONFLICT: {
    icon: GitCompareArrows,
    blurb:
      'Four candidates, two seats. A small engineered proof that global allocation beats candidate-by-candidate.',
  },
  HIGH_CONFLICT: {
    icon: Flame,
    blurb: 'More candidates than seats across high-demand opportunities, where competition is real.',
  },
  GEOGRAPHIC: {
    icon: Globe2,
    blurb: 'Opportunities concentrated in a few states while demand spreads across regions.',
  },
  FAIRNESS: {
    icon: Scale,
    blurb: 'A mixed rural/urban population built to test allocation fairness by group.',
  },
  INFEASIBLE: {
    icon: ShieldAlert,
    blurb: 'Demand exceeds capacity by design. The system must say so and explain why.',
  },
  BENCHMARK: {
    icon: Gauge,
    blurb: 'A large field to verify the engine stays fast under scale.',
  },
};

export default function AdminScenarios() {
  const nav = useNavigate();
  const [list, setList] = useState<ScenarioSummary[]>([]);
  const [current, setCurrent] = useState<DatasetSummary | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [s, o] = await Promise.all([
          apiGet<ScenarioSummary[]>('/admin/scenarios'),
          apiGet<any>('/admin/overview'),
        ]);
        setList(s);
        setCurrent(o.scenario);
      } catch (e) {
        setErr(errMsg(e));
      }
    })();
  }, []);

  const load = async (key: string) => {
    setBusyKey(key);
    setErr('');
    try {
      const d = await apiPost<DatasetSummary>(`/admin/scenarios/${key}/load`);
      setCurrent(d);
      const s = await apiGet<ScenarioSummary[]>('/admin/scenarios');
      setList(s);
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusyKey(null);
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[var(--na-text-h1)] font-semibold tracking-tight text-[var(--na-ink-primary)]">
          Scenarios and dataset
        </h1>
        <p className="mt-1.5 text-[var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
          Each scenario is a self-contained, system-generated demonstration field. Loading one replaces the current dataset.
        </p>
      </header>

      {current && (
        <section
          aria-label="Current active dataset"
          className="rounded-[var(--na-radius-lg)] bg-[var(--na-anchor)] p-6 text-[var(--na-anchor-ink)]"
        >
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--na-radius-md)] bg-[var(--na-anchor-2)] text-[var(--na-signal)]"
                aria-hidden="true"
              >
                <Database className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="font-display text-[var(--na-text-h3)] font-semibold text-[var(--na-anchor-ink)]">
                    Current dataset: {current.name}
                  </h2>
                  <span className="inline-flex items-center rounded-[var(--na-radius-sm)] bg-[var(--na-signal)] px-2 py-0.5 text-[12px] font-semibold text-[var(--na-anchor)]">
                    Synthetic
                  </span>
                </div>
                <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-[13px]">
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-[var(--na-anchor-muted)]">Candidates</dt>
                    <dd className="tabular-nums font-semibold text-[var(--na-anchor-ink)]">
                      {fmtNum(current.candidateCount)}
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-[var(--na-anchor-muted)]">Opportunities</dt>
                    <dd className="tabular-nums font-semibold text-[var(--na-anchor-ink)]">
                      {fmtNum(current.opportunityCount)}
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-[var(--na-anchor-muted)]">Seats</dt>
                    <dd className="tabular-nums font-semibold text-[var(--na-anchor-ink)]">
                      {fmtNum(current.seatCount)}
                    </dd>
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <dt className="text-[var(--na-anchor-muted)]">Version</dt>
                    <dd className="tabular-nums font-semibold text-[var(--na-anchor-ink)]">
                      {current.version}
                    </dd>
                  </div>
                </dl>
              </div>
            </div>

            <button
              type="button"
              onClick={() => nav('/admin')}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-[var(--na-radius-md)] bg-[var(--na-anchor-2)] px-4 py-2 text-[13px] font-medium text-[var(--na-anchor-ink)] transition-colors duration-150 hover:bg-[var(--na-accent)] hover:text-[var(--na-ink-primary)] active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span>Open allocation overview</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      )}

      {err && <Callout tone="warn">{err}</Callout>}

      <section aria-label="Available scenarios">
        <SectionHeader
          title="Available demonstration scenarios"
          sub="Select a field to load into the active workspace."
        />

        <div className="divide-y divide-[var(--na-border)] overflow-hidden rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)]">
          {list.map((s) => {
            const m = META[s.key] ?? { icon: Database, blurb: s.description || '' };
            const Icon = m.icon;
            const active = current?.key === s.key;
            const isLoadingThis = busyKey === s.key;

            return (
              <div
                key={s.key}
                className={`flex flex-col gap-4 px-5 py-4 transition-colors duration-150 sm:flex-row sm:items-center sm:justify-between ${
                  active
                    ? 'border-l-[3px] border-l-[var(--na-accent)] bg-[var(--na-accent-subtle)]/45'
                    : 'hover:bg-[var(--na-surface-raised)]'
                }`}
              >
                <div className="flex min-w-0 items-start gap-3.5">
                  <div
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--na-radius-md)] ${
                      active
                        ? 'bg-[var(--na-accent-subtle)] text-[var(--na-accent-ink)]'
                        : 'bg-[var(--na-stone)] text-[var(--na-ink-primary)]'
                    }`}
                    aria-hidden="true"
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="text-[15px] font-semibold text-[var(--na-ink-primary)]">
                        {s.name}
                      </h3>
                      {active && <Badge tone="green">Active</Badge>}
                    </div>
                    <p className="mt-1 max-w-[65ch] text-[13.5px] leading-relaxed text-[var(--na-ink-secondary)]">
                      {m.blurb || s.description}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                  <span className="text-[13px] font-medium text-[var(--na-ink-secondary)]">
                    {s.active ? 'Loaded' : 'Not loaded'}
                  </span>
                  <button
                    type="button"
                    className={active ? 'btn btn-ghost btn-sm' : 'btn btn-dark btn-sm'}
                    disabled={busyKey !== null}
                    onClick={() => load(s.key)}
                  >
                    {isLoadingThis ? (
                      <Spinner label="" />
                    ) : active ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Reload</span>
                      </>
                    ) : (
                      <span>Load scenario</span>
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="space-y-3">
        <Callout tone="info" title="About this data">
          Every person, organisation, and opportunity here is{' '}
          <strong>synthetic and system-generated</strong> for demonstration. Names, skills, and results
          are created by the NextAlloc seeder; no real candidate data is used.
        </Callout>
        <div className="flex items-start gap-2 text-[13px] text-[var(--na-ink-secondary)]">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--na-ink-tertiary)]" aria-hidden="true" />
          <span>
            Loading a new scenario preserves your run history, while runs executed on an older dataset version are marked as superseded.
          </span>
        </div>
      </div>
    </div>
  );
}
