import React, { useEffect, useState } from 'react';
import { ShieldCheck, ExternalLink } from 'lucide-react';
import { apiGet, errMsg } from '../../api/client';
import { Technical, DqCheck } from '../../api/types';
import {
  SectionHeader,
  Spinner,
  Callout,
  Badge,
  KV,
  MetricBand,
  fmtNum,
  fmtMs,
} from '../../components/ui';

export default function AdminTechnical() {
  const [t, setT] = useState<Technical | null>(null);
  const [dq, setDq] = useState<DqCheck[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [tech, d] = await Promise.all([
          apiGet<Technical>('/admin/technical'),
          apiGet<DqCheck[]>('/admin/data-quality'),
        ]);
        setT(tech);
        setDq(d);
      } catch (e) {
        setErr(errMsg(e));
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <Spinner label="Checking system health…" />;
  if (!t) return <Callout tone="danger">{err}</Callout>;

  const online = ['online', 'up', 'healthy', 'active'].includes(
    String(t.ai?.status ?? '').toLowerCase()
  );
  const dqTone = (status: string) => {
    if (status === 'READY') return 'green';
    if (status === 'ATTENTION') return 'amber';
    return 'red';
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-[var(--na-text-h1)] font-semibold tracking-tight text-[var(--na-ink-primary)]">
          System health
        </h1>
        <p className="mt-1.5 text-[var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
          Infrastructure status, solver telemetry, technology stack, and dataset health checks.
        </p>
      </header>

      {err && <Callout tone="warn">{err}</Callout>}

      <MetricBand
        items={[
          {
            label: 'AI service',
            value: online ? 'Online' : 'Offline',
            sub: t.ai.serviceVersion ? `Version ${t.ai.serviceVersion}` : undefined,
          },
          {
            label: 'Last solver outcome',
            value: t.solver?.solverStatus ?? '—',
            sub: t.solver?.lastRun ?? 'No completed run',
            accent: true,
          },
          {
            label: 'Eligible pairs',
            value: fmtNum(t.solver?.eligiblePairs),
            sub: t.solver ? `Runtime ${fmtMs(t.solver.solverRuntimeMs)}` : undefined,
          },
          {
            label: 'Active dataset seats',
            value: fmtNum(t.dataset?.seats),
            sub: t.dataset ? `${fmtNum(t.dataset.candidates)} candidates` : undefined,
          },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section
          aria-label="AI and optimization services"
          className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6"
        >
          <SectionHeader
            title="AI and optimization services"
            right={<Badge tone={online ? 'green' : 'red'}>{online ? 'online' : 'offline'}</Badge>}
          />
          <div>
            <KV
              k="AI mode"
              v={
                (t.ai.aiMode ?? '—') === 'deterministic-taxonomy'
                  ? 'Deterministic taxonomy matching'
                  : (t.ai.aiMode ?? '—')
              }
            />
            <KV
              k="Engine"
              v={
                t.ai.engineDescription ??
                'Deterministic skill matching (no embedding model is used).'
              }
            />
            <KV
              k="Embedding model"
              v={t.ai.embeddingModel ?? 'None (rule-based over validated taxonomy)'}
            />
            <KV k="AI scope" v="Parses resumes, normalizes skills, flags gaps" />
            <KV
              k="Boundary"
              v="Never allocates, overrides eligibility, or invents candidate facts"
            />
            <KV k="Optimizer" v={t.ai.optimizer ?? '—'} />
            <KV k="Optimizer version" v={t.ai.optimizerVersion ?? '—'} />
            <KV k="Service version" v={t.ai.serviceVersion ?? '—'} />
          </div>

          <div className="mt-4 flex items-start gap-2.5 rounded-[var(--na-radius-md)] bg-[var(--na-stone)] p-3.5 text-[13px] leading-relaxed text-[var(--na-ink-primary)]">
            <ShieldCheck
              className="mt-0.5 h-4 w-4 shrink-0 text-[var(--na-status-success-text)]"
              aria-hidden="true"
            />
            <span>
              The global solver runs deterministic mathematical optimization (Google OR-Tools CP-SAT) hosted on the Python microservice. Placements are governed by exact integer constraints rather than generative AI drift, and generative LLMs are never used to decide candidate allocations.
            </span>
          </div>
        </section>

        <section
          aria-label="Latest solver telemetry"
          className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6"
        >
          <SectionHeader title="Last solver run" />
          {t.solver ? (
            <div>
              <KV k="Run" v={t.solver.lastRun ?? '—'} />
              <KV k="Outcome" v={t.solver.solverStatus ?? '—'} />
              <KV k="Eligible candidate–opportunity pairs" v={fmtNum(t.solver.eligiblePairs)} />
              <KV
                k="Variables / constraints"
                v={`${fmtNum(t.solver.variables)} / ${fmtNum(t.solver.constraints)}`}
              />
              <KV k="Objective value" v={fmtNum(t.solver.objective)} />
              <KV k="Solver time" v={fmtMs(t.solver.solverRuntimeMs)} />
              <KV k="Total run time" v={fmtMs(t.solver.totalRuntimeMs)} />
            </div>
          ) : (
            <p className="py-6 text-center text-[13.5px] text-[var(--na-ink-secondary)]">
              No completed run yet.
            </p>
          )}

          {t.dataset && (
            <div className="mt-4 rounded-[var(--na-radius-md)] bg-[var(--na-stone)] p-3.5 text-[13px] text-[var(--na-ink-primary)]">
              <div className="font-semibold">
                Dataset: {t.dataset.scenario ?? '—'} (v{t.dataset.version ?? '—'})
              </div>
              <div className="tabular-nums mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[var(--na-ink-secondary)]">
                <span>{fmtNum(t.dataset.candidates)} candidates</span>
                <span>{fmtNum(t.dataset.opportunities)} opportunities</span>
                <span>{fmtNum(t.dataset.seats)} seats</span>
              </div>
            </div>
          )}
        </section>
      </div>

      <section
        aria-label="Technology stack"
        className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6"
      >
        <SectionHeader
          title="Technology stack"
          sub="Implementation details live here rather than on operational workflow screens."
        />
        <div className="grid gap-x-10 md:grid-cols-2">
          <div>
            <KV k="Frontend" v={t.stack?.frontend ?? '—'} />
            <KV k="Backend" v={t.stack?.backend ?? '—'} />
            <KV k="AI service" v={t.stack?.aiService ?? '—'} />
          </div>
          <div>
            <KV k="Optimizer" v={t.stack?.optimizer ?? '—'} />
            <KV k="Database" v={t.stack?.database ?? '—'} />
            <KV
              k="API documentation"
              v={
                <a
                  className="inline-flex items-center gap-1 font-medium text-[var(--na-accent-ink)] underline hover:text-[var(--na-accent-hover)]"
                  href={t.links?.swagger || '/swagger-ui.html'}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span>Open interactive API docs</span>
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                </a>
              }
            />
          </div>
        </div>
      </section>

      <section
        aria-label="Dataset health checks"
        className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6"
      >
        <SectionHeader
          title="Dataset health"
          sub="Each check records what it inspects, why it matters, and the remediation."
        />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[740px]">
            <thead>
              <tr>
                <th className="th pl-0">Area</th>
                <th className="th">Status</th>
                <th className="th">What it checks</th>
                <th className="th">Why it matters</th>
                <th className="th">Fix</th>
                <th className="th pr-0 text-right">Affected</th>
              </tr>
            </thead>
            <tbody>
              {dq.map((c) => (
                <tr key={c.area} className="tr-hover align-top">
                  <td className="td pl-0 font-semibold text-[var(--na-ink-primary)]">{c.area}</td>
                  <td className="td whitespace-nowrap">
                    <Badge tone={dqTone(c.status)}>{c.status}</Badge>
                  </td>
                  <td className="td max-w-[220px] text-[var(--na-ink-primary)]">{c.what}</td>
                  <td className="td max-w-[220px] text-[var(--na-ink-secondary)]">{c.why}</td>
                  <td className="td max-w-[220px] text-[var(--na-ink-secondary)]">{c.fix}</td>
                  <td className="td tabular-nums pr-0 text-right font-medium text-[var(--na-ink-primary)]">
                    {fmtNum(c.affected)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
