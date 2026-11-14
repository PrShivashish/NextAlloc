import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Briefcase, Search, Star, ArrowRight, X } from 'lucide-react';
import { apiGet, errMsg } from '../../api/client';
import { Opp, OppDetail } from '../../api/types';
import { Spinner, Callout, Badge, Modal, fmtNum, EmptyState } from '../../components/ui';

const SECTORS: [string, string][] = [
  ['SOFTWARE_IT', 'Software & IT'],
  ['DATA_ANALYTICS', 'Data & Analytics'],
  ['FINANCE_BANKING', 'Finance & Banking'],
  ['DESIGN_MEDIA', 'Design & Media'],
  ['MARKETING_COMMUNICATION', 'Marketing & Communication'],
  ['PUBLIC_ADMIN_POLICY', 'Public Administration & Policy'],
  ['HEALTHCARE_BIOTECH', 'Healthcare & Biotech'],
  ['MANUFACTURING_OPERATIONS', 'Manufacturing & Operations'],
  ['RESEARCH_DEVELOPMENT', 'Research & Development'],
  ['ENVIRONMENTAL_ENERGY', 'Environmental & Energy'],
];

const STATES = [
  'Andhra Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Delhi', 'Gujarat', 'Haryana',
  'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Odisha',
  'Punjab', 'Rajasthan', 'Tamil Nadu', 'Telangana', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
];

interface Filters {
  q: string;
  sector: string;
  state: string;
}

export default function CandidateExplore() {
  const [rows, setRows] = useState<Opp[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState<Filters>({ q: '', sector: '', state: '' });
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [sel, setSel] = useState<OppDetail | null>(null);
  const reqSeq = useRef(0);

  const load = (p: number, f: Filters) => {
    const seq = ++reqSeq.current;
    setLoading(true);
    setErr('');
    apiGet<any>('/opportunities', {
      page: p,
      size: 9,
      q: f.q || undefined,
      state: f.state || undefined,
      sector: f.sector || undefined,
      availableOnly: true,
    })
      .then(d => {
        if (seq !== reqSeq.current) return;
        setRows(d.content ?? []);
        setTotal(d.totalElements ?? 0);
        setPage(p);
      })
      .catch(e => {
        if (seq === reqSeq.current) setErr(errMsg(e));
      })
      .finally(() => {
        if (seq === reqSeq.current) setLoading(false);
      });
  };

  const applyFilter = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    setFilters(next);
    load(0, next);
  };

  const hasFilters = filters.q !== '' || filters.sector !== '' || filters.state !== '';
  useEffect(() => {
    load(0, { q: '', sector: '', state: '' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = async (id: number) => {
    try {
      setSel(await apiGet<OppDetail>(`/opportunities/${id}`));
    } catch (e) {
      setErr(errMsg(e));
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-b border-[var(--na-border)] pb-5">
        <h1 className="text-[length:var(--na-text-h1)] font-semibold leading-[var(--na-leading-tight)] text-[var(--na-ink-primary)]">
          Explore opportunities
        </h1>
        <p className="mt-1.5 text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
          Every open internship with your personal eligibility and fit score.
        </p>
      </header>

      {err && <Callout tone="warn">{err}</Callout>}

      {/* Search & Filter Bar */}
      <section
        aria-label="Filter opportunities"
        className="flex flex-wrap items-center gap-3 rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-4"
      >
        <div className="relative min-w-[220px] flex-1">
          <Search
            className="pointer-events-none absolute left-3.5 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--na-ink-tertiary)]"
            aria-hidden="true"
          />
          <input
            aria-label="Search opportunities"
            className="min-h-[44px] w-full rounded-[var(--na-radius-md)] border border-[var(--na-border-strong)] bg-[var(--na-surface)] py-2 pl-10 pr-3.5 text-[16px] text-[var(--na-ink-primary)] placeholder:text-[var(--na-ink-tertiary)] sm:text-[length:var(--na-text-body-sm)]"
            placeholder="Search by title or description…"
            value={filters.q}
            onChange={e => setFilters(f => ({ ...f, q: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && load(0, filters)}
          />
        </div>

        <select
          aria-label="Filter by sector"
          className="min-h-[44px] w-full rounded-[var(--na-radius-md)] border border-[var(--na-border-strong)] bg-[var(--na-surface)] px-3 py-2 text-[16px] text-[var(--na-ink-primary)] sm:w-auto sm:text-[length:var(--na-text-body-sm)]"
          value={filters.sector}
          onChange={e => applyFilter({ sector: e.target.value })}
        >
          <option value="">All sectors</option>
          {SECTORS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by state"
          className="min-h-[44px] w-full rounded-[var(--na-radius-md)] border border-[var(--na-border-strong)] bg-[var(--na-surface)] px-3 py-2 text-[16px] text-[var(--na-ink-primary)] sm:w-auto sm:text-[length:var(--na-text-body-sm)]"
          value={filters.state}
          onChange={e => applyFilter({ state: e.target.value })}
        >
          <option value="">All states</option>
          {STATES.map(s => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => load(0, filters)}
          disabled={loading}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--na-radius-md)] bg-[var(--na-accent)] px-4 py-2 text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)] transition-[background-color,opacity] duration-150 hover:bg-[var(--na-accent-hover)] active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] disabled:cursor-not-allowed disabled:opacity-55"
        >
          <Search className="h-4 w-4" aria-hidden="true" />
          <span>Search</span>
        </button>

        {hasFilters && (
          <button
            type="button"
            onClick={() => applyFilter({ q: '', sector: '', state: '' })}
            className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--na-radius-md)] border border-[var(--na-border-strong)] bg-[var(--na-surface)] px-3.5 py-2 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)] transition-colors duration-150 hover:bg-[var(--na-stone)] active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span>Clear</span>
          </button>
        )}
      </section>

      {loading ? (
        <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)]">
          <Spinner label="Loading opportunities…" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] px-6 py-8">
          <EmptyState
            title="No opportunities match your filters"
            hint={
              hasFilters
                ? 'Try widening the sector or state, or clear the filters to see every open internship.'
                : 'No open internships right now. Check back after the next allocation cycle.'
            }
            icon={<Briefcase className="h-7 w-7" />}
          />
          {hasFilters && (
            <div className="flex justify-center pb-4">
              <button
                type="button"
                onClick={() => applyFilter({ q: '', sector: '', state: '' })}
                className="inline-flex min-h-[44px] items-center rounded-[var(--na-radius-md)] border border-[var(--na-border-strong)] bg-[var(--na-surface)] px-4 py-2 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)] transition-colors duration-150 hover:bg-[var(--na-stone)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
              >
                Clear all filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="min-w-0 overflow-x-auto rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)]">
            <table className="w-full min-w-[740px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--na-border)]">
                  <th className="px-4 py-3 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                    Opportunity
                  </th>
                  <th className="px-4 py-3 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                    Location
                  </th>
                  <th className="px-4 py-3 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                    Seats & duration
                  </th>
                  <th className="px-4 py-3 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                    Eligibility
                  </th>
                  <th className="px-4 py-3 text-right text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                    Fit
                  </th>
                  <th className="px-4 py-3 text-right text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--na-border-subtle)]">
                {rows.map(o => (
                  <tr
                    key={o.id}
                    onClick={() => open(o.id)}
                    className="cursor-pointer transition-colors duration-150 hover:bg-[var(--na-surface-raised)]"
                  >
                    <td className="px-4 py-4 align-top">
                      <div className="text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)]">
                        {o.title}
                      </div>
                      <div className="mt-0.5 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                        {o.sector}
                      </div>
                      {o.mandatorySkills.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {o.mandatorySkills.slice(0, 3).map(s => (
                            <span
                              key={s}
                              className="rounded-[var(--na-radius-sm)] bg-[var(--na-well)] px-2 py-0.5 text-[length:var(--na-text-caption)] text-[var(--na-ink-primary)]"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 align-top text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
                      {o.city ? `${o.city}, ` : ''}
                      {o.state}
                    </td>
                    <td className="px-4 py-4 align-top text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)] tabular-nums">
                      <div>{fmtNum(o.capacity)} seats</div>
                      <div className="text-[length:var(--na-text-caption)] text-[var(--na-ink-tertiary)]">
                        {o.durationMonths} months
                      </div>
                    </td>
                    <td className="px-4 py-4 align-top">
                      <Badge tone={o.eligible ? 'green' : 'red'}>
                        {o.eligible ? 'Eligible' : 'Not eligible'}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-right align-top tabular-nums">
                      {o.eligible ? (
                        <span className="text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)]">
                          {o.fitScore != null ? `${o.fitScore.toFixed(0)}%` : '—'}
                        </span>
                      ) : (
                        <div className="flex flex-col items-end">
                          <span className="text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-tertiary)]">
                            Not evaluated
                          </span>
                          <span className="text-[11px] text-[var(--na-ink-tertiary)] font-normal">
                            Excluded by gate
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right align-top">
                      <button
                        type="button"
                        onClick={e => {
                          e.stopPropagation();
                          void open(o.id);
                        }}
                        className="inline-flex min-h-[36px] items-center gap-1 text-[length:var(--na-text-caption)] font-medium text-[var(--na-accent-ink)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                      >
                        <span>View</span>
                        <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)] tabular-nums">
            <span>{fmtNum(total)} opportunities found</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page === 0 || loading}
                onClick={() => load(page - 1, filters)}
                className="inline-flex min-h-[40px] items-center rounded-[var(--na-radius-md)] border border-[var(--na-border-strong)] bg-[var(--na-surface)] px-3.5 py-1.5 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)] transition-colors duration-150 hover:bg-[var(--na-stone)] active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={(page + 1) * 9 >= total || loading}
                onClick={() => load(page + 1, filters)}
                className="inline-flex min-h-[40px] items-center rounded-[var(--na-radius-md)] border border-[var(--na-border-strong)] bg-[var(--na-surface)] px-3.5 py-1.5 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)] transition-colors duration-150 hover:bg-[var(--na-stone)] active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </>
      )}

      <Modal open={!!sel} onClose={() => setSel(null)} title={sel?.card.title ?? ''} wide>
        {sel && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={sel.card.eligible ? 'green' : 'red'}>
                {sel.card.eligible ? 'Eligible for you' : 'Not eligible for you'}
              </Badge>
              <Badge tone="navy">{sel.card.sector}</Badge>
              {sel.card.myPreferenceRank && (
                <Badge tone="saffron">
                  <Star className="h-3 w-3" aria-hidden="true" />
                  <span>Preference #{sel.card.myPreferenceRank}</span>
                </Badge>
              )}
              <div className="ml-auto text-right tabular-nums">
                <span className="text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)]">
                  {sel.card.eligible
                    ? `Suitability: ${sel.card.fitScore != null ? `${sel.card.fitScore.toFixed(0)}%` : '—'}`
                    : 'Suitability: Not evaluated'}
                </span>
                {!sel.card.eligible && (
                  <span className="block text-[11px] font-medium text-[var(--na-error-text)]">
                    Ineligible (excluded from allocation)
                  </span>
                )}
              </div>
            </div>

            {!sel.card.eligible && (
              <Callout tone="warn" title="Hard Eligibility Gate: Excluded from Allocation">
                <p className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                  This opportunity does not meet your current eligibility requirements. NextAlloc enforces deterministic eligibility prior to suitability scoring and CP-SAT optimization. Because hard eligibility criteria are not satisfied, allocatable suitability is not evaluated:
                </p>
                {(sel.card.eligibilityReasons?.length ?? 0) > 0 && (
                  <ul className="mt-2 list-disc space-y-0.5 pl-4 text-[length:var(--na-text-caption)]">
                    {(sel.card.eligibilityReasons ?? []).map((r: string) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-3 pt-2 border-t border-[var(--na-border)] flex items-center justify-end">
                  <Link
                    to="/candidate/analytics"
                    className="inline-flex items-center gap-1 text-[length:var(--na-text-caption)] font-medium text-[var(--na-accent-ink)] hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                  >
                    <span>View recommended eligible opportunities</span>
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </div>
              </Callout>
            )}

            <div className="grid grid-cols-2 divide-y divide-[var(--na-border)] border-y border-[var(--na-border)] md:grid-cols-4 md:divide-x md:divide-y-0">
              {[
                ['Location', `${sel.card.city ? sel.card.city + ', ' : ''}${sel.card.state}`],
                ['Seats', fmtNum(sel.card.capacity)],
                ['Duration', `${sel.card.durationMonths} months`],
                ['Min qualification', sel.card.minQualification.replace('_', ' ')],
              ].map(([k, v]) => (
                <div key={k} className="px-3 py-3 first:pl-0 last:pr-0">
                  <div className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                    {k}
                  </div>
                  <div className="mt-1 text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)] tabular-nums">
                    {v}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <h4 className="mb-2 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                Skills required
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {sel.card.mandatorySkills.map(s => (
                  <span
                    key={s}
                    className="rounded-[var(--na-radius-sm)] bg-[var(--na-well)] px-2.5 py-1 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-primary)]"
                  >
                    {s} (required)
                  </span>
                ))}
                {sel.card.niceSkills?.map(s => (
                  <span
                    key={s}
                    className="rounded-[var(--na-radius-sm)] bg-[var(--na-accent-subtle)] px-2.5 py-1 text-[length:var(--na-text-caption)] font-medium text-[var(--na-accent-ink)]"
                  >
                    {s} (preferred)
                  </span>
                ))}
              </div>
            </div>

            {sel.description && (
              <div>
                <h4 className="mb-1.5 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                  About this internship
                </h4>
                <p className="whitespace-pre-line text-[length:var(--na-text-body-sm)] leading-[var(--na-leading-relaxed)] text-[var(--na-ink-primary)]">
                  {sel.description}
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
