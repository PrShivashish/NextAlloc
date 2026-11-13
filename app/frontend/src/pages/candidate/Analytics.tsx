import React, { useEffect, useMemo, useState } from 'react';
import {
  Target,
  Sparkles,
  GraduationCap,
  MapPin,
  CheckCircle2,
  ArrowUp,
  Sparkle,
  Wand2,
  Info,
  ListChecks,
} from 'lucide-react';
import { apiGet, apiPost, errMsg } from '../../api/client';
import { FitAnalysis, Recommendation, SkillGap, GuidanceRes, Opp } from '../../api/types';
import { Spinner, Callout, Badge, EmptyState } from '../../components/ui';

const FACTOR_ICONS: Record<string, React.ReactNode> = {
  skills: <Wand2 className="h-4 w-4" aria-hidden="true" />,
  qualification: <GraduationCap className="h-4 w-4" aria-hidden="true" />,
  interest: <Sparkles className="h-4 w-4" aria-hidden="true" />,
  location: <MapPin className="h-4 w-4" aria-hidden="true" />,
  preference: <ListChecks className="h-4 w-4" aria-hidden="true" />,
  learning: <ArrowUp className="h-4 w-4" aria-hidden="true" />,
  experience: <Target className="h-4 w-4" aria-hidden="true" />,
};

const QUESTIONS: { id: string; label: string }[] = [
  { id: 'weak_area', label: 'What part of my profile is weak for this internship?' },
  { id: 'learn_first', label: 'What should I learn first?' },
  { id: 'why_skill', label: 'Why does a listed skill matter here?' },
  { id: 'improve_impact', label: 'How would improving a skill affect my fit?' },
];

function fitColorVar(v: number): string {
  if (v >= 80) return 'var(--na-status-success-text)';
  if (v >= 50) return 'var(--na-accent-ink)';
  return 'var(--na-status-error-text)';
}

export default function CandidateAnalytics() {
  const [opps, setOpps] = useState<Opp[]>([]);
  const [selId, setSelId] = useState<number | null>(null);
  const [fit, setFit] = useState<FitAnalysis | null>(null);
  const [gap, setGap] = useState<SkillGap | null>(null);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [recNote, setRecNote] = useState('');
  const [loadingFit, setLoadingFit] = useState(false);
  const [err, setErr] = useState('');

  const [activeQ, setActiveQ] = useState<string | null>(null);
  const [skillForQ, setSkillForQ] = useState('');
  const [answer, setAnswer] = useState<GuidanceRes | null>(null);
  const [asking, setAsking] = useState(false);

  const needsSkill = (qid: string) => qid === 'why_skill' || qid === 'improve_impact';

  useEffect(() => {
    (async () => {
      try {
        const d = await apiGet<any>('/opportunities', {
          page: 0,
          size: 100,
          availableOnly: true,
        });
        const rows: Opp[] = d.content ?? [];
        setOpps(rows);
        if (rows.length > 0) {
          const firstEligible = rows.find(o => o.eligible) ?? rows[0];
          setSelId(firstEligible.id);
        }
        const r = await apiGet<any>('/candidates/me/recommendations');
        setRecs(r.items ?? []);
        setRecNote(r.note ?? '');
      } catch (e) {
        setErr(errMsg(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (selId == null) {
      setFit(null);
      setGap(null);
      return;
    }
    setLoadingFit(true);
    setErr('');
    setAnswer(null);
    setActiveQ(null);
    setSkillForQ('');
    (async () => {
      try {
        const [f, g] = await Promise.all([
          apiGet<FitAnalysis>(`/candidates/me/analytics/opportunity/${selId}`),
          apiGet<SkillGap>(`/candidates/me/skill-gap/${selId}`),
        ]);
        setFit(f);
        setGap(g);
      } catch (e) {
        setErr(errMsg(e));
        setFit(null);
        setGap(null);
      }
      setLoadingFit(false);
    })();
  }, [selId]);

  const pickQuestion = (qid: string) => {
    if (needsSkill(qid)) {
      setActiveQ(qid);
      if (skillForQ) void ask(qid, skillForQ);
    } else {
      setActiveQ(qid);
      void ask(qid);
    }
  };

  const onSkillChange = (skill: string) => {
    setSkillForQ(skill);
    setAnswer(null);
    if (skill && activeQ && needsSkill(activeQ)) void ask(activeQ, skill);
  };

  const ask = async (question: string, skill?: string) => {
    if (selId == null) return;
    setAsking(true);
    setErr('');
    try {
      const a = await apiPost<GuidanceRes>(`/candidates/me/skill-gap/${selId}/guidance`, {
        question,
        skill,
      });
      setAnswer(a);
    } catch (e) {
      setErr(errMsg(e));
    }
    setAsking(false);
  };

  const holdingBack = useMemo(
    () =>
      fit
        ? [...fit.factors]
            .sort((a, b) => b.lostPoints - a.lostPoints)
            .filter(f => f.lostPoints >= 0.5)
            .slice(0, 3)
        : [],
    [fit],
  );

  const eligibleOpps = useMemo(() => opps.filter(o => o.eligible), [opps]);
  const notEligibleOpps = useMemo(() => opps.filter(o => !o.eligible), [opps]);

  return (
    <div className="space-y-8">
      <header className="border-b border-[var(--na-border)] pb-5">
        <h1 className="text-[length:var(--na-text-h1)] font-semibold leading-[var(--na-leading-tight)] text-[var(--na-ink-primary)]">
          Fit analytics
        </h1>
        <p className="mt-1.5 text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
          Factor-by-factor profile suitability for each internship.
        </p>
      </header>

      {err && <Callout tone="warn">{err}</Callout>}

      {/* Opportunity picker */}
      <section
        aria-label="Select internship"
        className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5"
      >
        <label
          htmlFor="analytics-opp-select"
          className="mb-2 block text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-primary)]"
        >
          Choose an internship to analyse
        </label>
        <select
          id="analytics-opp-select"
          className="min-h-[44px] w-full rounded-[var(--na-radius-md)] border border-[var(--na-border-strong)] bg-[var(--na-surface)] px-3.5 py-2 text-[16px] text-[var(--na-ink-primary)] sm:text-[length:var(--na-text-body-sm)]"
          value={selId ?? ''}
          onChange={e => setSelId(Number(e.target.value))}
        >
          {eligibleOpps.length > 0 && (
            <optgroup label="Eligible for you">
              {eligibleOpps.map(o => (
                <option key={o.id} value={o.id}>
                  {o.title} ({o.sector}, {o.state})
                </option>
              ))}
            </optgroup>
          )}
          {notEligibleOpps.length > 0 && (
            <optgroup label="Not eligible yet">
              {notEligibleOpps.map(o => (
                <option key={o.id} value={o.id}>
                  {o.title} ({o.sector}, {o.state})
                </option>
              ))}
            </optgroup>
          )}
        </select>
        <p className="mt-2 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
          Suitability measures profile-to-role fit only and is not an offer probability. Weights:{' '}
          {fit?.weightsSource ?? 'NextAlloc default configurable weights'}.
        </p>
      </section>

      {loadingFit && (
        <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)]">
          <Spinner label="Computing your fit…" />
        </div>
      )}

      {!loadingFit && fit && (
        <>
          {fit.eligible ? (
            <>
              {/* Summary strip + Holding back */}
              <section
                aria-label="Suitability summary"
                className="grid grid-cols-1 gap-8 border-b border-[var(--na-border)] pb-8 lg:grid-cols-3"
              >
                <div className="lg:border-r lg:border-[var(--na-border)] lg:pr-8">
                  <div className="text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                    Suitability score
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <span
                      className="text-[length:var(--na-text-display)] font-bold leading-none tabular-nums"
                      style={{ color: fitColorVar(fit.overallScore) }}
                    >
                      {fit.overallScore.toFixed(1)}
                    </span>
                    <span className="text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)] tabular-nums">
                      / {fit.possibleScore}
                    </span>
                  </div>
                  <div className="mt-3">
                    <Badge
                      tone={fit.overallScore >= 70 ? 'green' : fit.overallScore >= 50 ? 'amber' : 'red'}
                    >
                      {fit.recommendationLabel}
                    </Badge>
                  </div>
                  <p className="mt-3 text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)] tabular-nums">
                    {fit.lostPoints.toFixed(1)} points available across remaining levers.
                    {fit.preferenceRank ? ` Listed as preference #${fit.preferenceRank}.` : ''}
                  </p>
                  <p className="mt-2 text-[length:var(--na-text-caption)] text-[var(--na-ink-tertiary)]">
                    This score measures profile-to-role fit, not offer probability. Final placement depends on pool-wide capacity and preferences.
                  </p>
                </div>

                <div className="lg:col-span-2">
                  <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
                    What is holding your score back
                  </h2>
                  <p className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                    Top factors ranked by points you could still earn.
                  </p>

                  {holdingBack.length === 0 ? (
                    <div className="mt-4 flex items-center gap-2.5 rounded-[var(--na-radius-md)] border border-[var(--na-status-success-border)] bg-[var(--na-status-success-bg)] px-4 py-3 text-[length:var(--na-text-body-sm)] text-[var(--na-status-success-text)]">
                      <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                      <span>No meaningful gaps. Your profile is well balanced for this internship.</span>
                    </div>
                  ) : (
                    <ul className="mt-4 divide-y divide-[var(--na-border)] border-y border-[var(--na-border)]">
                      {holdingBack.map(f => (
                        <li key={f.key} className="py-3.5">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)]">
                              {f.label}
                            </span>
                            <span className="text-[length:var(--na-text-caption)] font-semibold text-[var(--na-accent-ink)] tabular-nums">
                              {f.lostPoints.toFixed(1)} pts available
                            </span>
                          </div>
                          <p className="mt-1 text-[length:var(--na-text-caption)] leading-[var(--na-leading-relaxed)] text-[var(--na-ink-secondary)]">
                            {f.explanation}
                          </p>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>

              {/* Horizontal factor bars + table */}
              <section
                aria-label="Factor breakdown"
                className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6"
              >
                <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
                  Score breakdown by factor
                </h2>
                <p className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                  Each factor contributes fit multiplied by policy weight.
                </p>

                <div className="mt-5 space-y-4">
                  {fit.factors.map(f => (
                    <div key={f.key} className="space-y-1.5">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <div className="flex items-center gap-2 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)]">
                          <span className="text-[var(--na-ink-secondary)]">
                            {FACTOR_ICONS[f.key] ?? <Sparkle className="h-4 w-4" aria-hidden="true" />}
                          </span>
                          <span>{f.label}</span>
                        </div>
                        <div className="flex items-baseline gap-4 text-[length:var(--na-text-caption)] tabular-nums">
                          <span className="text-[var(--na-ink-secondary)]">
                            Fit {f.fit.toFixed(0)}%
                          </span>
                          <span className="text-[var(--na-ink-secondary)]">
                            Weight {f.weight.toFixed(0)}%
                          </span>
                          <span className="font-semibold text-[var(--na-ink-primary)]">
                            +{f.contribution.toFixed(1)} pts
                          </span>
                        </div>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--na-well)]">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${Math.min(100, Math.max(2, f.fit))}%`,
                            backgroundColor:
                              f.fit >= 80
                                ? 'var(--na-status-success-text)'
                                : f.fit >= 50
                                  ? 'var(--na-accent)'
                                  : 'var(--na-ink-secondary)',
                          }}
                        />
                      </div>
                      <p className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                        {f.explanation}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Strongest matches & Skill readiness */}
              <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6">
                  <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
                    Matching signals
                  </h2>
                  <p className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                    Skills and attributes aligned with this role.
                  </p>
                  {fit.strongestMatches.length > 0 ? (
                    <div className="mt-4 flex flex-wrap gap-1.5">
                      {fit.strongestMatches.map(s => (
                        <span
                          key={s}
                          className="inline-flex items-center gap-1 rounded-[var(--na-radius-sm)] border border-[var(--na-status-success-border)] bg-[var(--na-status-success-bg)] px-2.5 py-1 text-[length:var(--na-text-caption)] font-medium text-[var(--na-status-success-text)]"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>{s}</span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-4 text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
                      No listed skills matched yet. Check the skill readiness section.
                    </p>
                  )}
                </div>

                {gap && (
                  <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6">
                    <div className="flex items-baseline justify-between gap-3">
                      <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
                        Skill readiness
                      </h2>
                      <span
                        className="text-[length:var(--na-text-h3)] font-semibold tabular-nums"
                        style={{ color: fitColorVar(gap.readinessPercent) }}
                      >
                        {gap.readinessPercent.toFixed(0)}%
                      </span>
                    </div>

                    <div className="mt-4 space-y-2.5">
                      {gap.coveredSkills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {gap.coveredSkills.map(s => (
                            <span
                              key={s}
                              className="rounded-[var(--na-radius-sm)] border border-[var(--na-status-success-border)] bg-[var(--na-status-success-bg)] px-2.5 py-1 text-[length:var(--na-text-caption)] font-medium text-[var(--na-status-success-text)]"
                            >
                              {s} (covered)
                            </span>
                          ))}
                        </div>
                      )}
                      {gap.mandatoryGaps.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {gap.mandatoryGaps.map(s => (
                            <span
                              key={s}
                              className="rounded-[var(--na-radius-sm)] border border-[var(--na-status-error-border)] bg-[var(--na-status-error-bg)] px-2.5 py-1 text-[length:var(--na-text-caption)] font-medium text-[var(--na-status-error-text)]"
                            >
                              {s} (required, missing)
                            </span>
                          ))}
                        </div>
                      )}
                      {gap.preferredGaps.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {gap.preferredGaps.map(s => (
                            <span
                              key={s}
                              className="rounded-[var(--na-radius-sm)] border border-[var(--na-status-warning-border)] bg-[var(--na-status-warning-bg)] px-2.5 py-1 text-[length:var(--na-text-caption)] font-medium text-[var(--na-status-warning-text)]"
                            >
                              {s} (preferred)
                            </span>
                          ))}
                        </div>
                      )}
                    </div>

                    <p className="mt-4 rounded-[var(--na-radius-md)] bg-[var(--na-well)] p-3.5 text-[length:var(--na-text-caption)] leading-[var(--na-leading-relaxed)] text-[var(--na-ink-primary)]">
                      {gap.assistantSummary}
                    </p>
                  </div>
                )}
              </section>

              {/* Skill-gap assistant */}
              <section
                aria-label="Skill-gap guidance"
                className="rounded-[var(--na-radius-lg)] bg-[var(--na-stone)] p-6"
              >
                <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
                  Skill-gap assistant
                </h2>
                <p className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                  Grounded guidance built from the opportunity requirements and your recorded profile.
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {QUESTIONS.map(qs => (
                    <button
                      key={qs.id}
                      type="button"
                      disabled={asking}
                      onClick={() => pickQuestion(qs.id)}
                      className={`inline-flex min-h-[40px] items-center gap-1.5 rounded-[var(--na-radius-md)] border px-3.5 py-2 text-[length:var(--na-text-caption)] font-medium transition-colors duration-150 active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] disabled:cursor-not-allowed disabled:opacity-50 ${
                        activeQ === qs.id
                          ? 'border-[var(--na-accent)] bg-[var(--na-accent-subtle)] text-[var(--na-accent-ink)]'
                          : 'border-[var(--na-border-strong)] bg-[var(--na-surface)] text-[var(--na-ink-primary)] hover:bg-[var(--na-surface-raised)]'
                      }`}
                    >
                      <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{qs.label}</span>
                    </button>
                  ))}
                </div>

                {activeQ && needsSkill(activeQ) && (
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <label
                      htmlFor="guidance-skill-select"
                      className="text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-primary)]"
                    >
                      About which skill?
                    </label>
                    <select
                      id="guidance-skill-select"
                      className="min-h-[40px] rounded-[var(--na-radius-md)] border border-[var(--na-border-strong)] bg-[var(--na-surface)] px-3 py-1.5 text-[length:var(--na-text-body-sm)] text-[var(--na-ink-primary)]"
                      value={skillForQ}
                      onChange={e => onSkillChange(e.target.value)}
                    >
                      <option value="">Choose a skill…</option>
                      {[...(gap?.mandatoryGaps ?? []), ...(gap?.preferredGaps ?? [])].map(s => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {asking && <Spinner label="Composing grounded guidance…" />}

                {answer && !asking && (
                  <div className="mt-4 rounded-[var(--na-radius-md)] border border-[var(--na-border)] bg-[var(--na-surface)] p-4">
                    <div className="text-[length:var(--na-text-caption)] font-semibold text-[var(--na-ink-secondary)]">
                      {QUESTIONS.find(x => x.id === activeQ)?.label}
                      {skillForQ ? ` (${skillForQ})` : ''}
                    </div>
                    <p className="mt-2 text-[length:var(--na-text-body-sm)] leading-[var(--na-leading-relaxed)] text-[var(--na-ink-primary)]">
                      {answer.answer}
                    </p>
                    <p className="mt-2 text-[length:var(--na-text-caption)] text-[var(--na-ink-tertiary)]">
                      Grounding: {answer.grounding}. Source:{' '}
                      {answer.engine === 'deterministic-guidance'
                        ? 'deterministic guidance rules'
                        : 'deterministic fallback'}
                      .
                    </p>
                  </div>
                )}
              </section>
            </>
          ) : (
            <section className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6">
              <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
                Not eligible for this internship yet
              </h2>
              <p className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                {fit.opportunity.title}
              </p>
              <div className="mt-4">
                <Callout tone="warn" title="Eligibility requirements">
                  <ul className="mt-1 list-disc space-y-1 pl-4">
                    {fit.eligibilityReasons.map(r => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                </Callout>
              </div>
              <p className="mt-4 flex items-start gap-2 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Suitability scores are only computed once eligibility criteria are satisfied.
                </span>
              </p>
            </section>
          )}
        </>
      )}

      {/* Ranked Recommendations */}
      <section aria-label="Recommended internships">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <div>
            <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
              Recommended for you
            </h2>
            <p className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
              {recNote ||
                'Suitability measures profile-to-role fit, not offer probability. Final placement considers all candidates and seat capacities.'}
            </p>
          </div>
          <Badge tone="saffron">Profile fit only, not an offer</Badge>
        </div>

        {recs.length === 0 ? (
          <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] px-6 py-8">
            <EmptyState
              title="No recommendations yet"
              hint="Add skills, interests, and preferences on your profile to see scored matches."
              icon={<Target className="h-7 w-7" />}
            />
          </div>
        ) : (
          <div className="min-w-0 overflow-x-auto rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)]">
            <table className="w-full min-w-[680px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--na-border)]">
                  <th className="px-4 py-3 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                    Rank
                  </th>
                  <th className="px-4 py-3 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                    Opportunity
                  </th>
                  <th className="px-4 py-3 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                    Location
                  </th>
                  <th className="px-4 py-3 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                    Main gap
                  </th>
                  <th className="px-4 py-3 text-right text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                    Fit score
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--na-border-subtle)]">
                {recs.map(r => (
                  <tr
                    key={r.opportunity.id}
                    onClick={() => setSelId(r.opportunity.id)}
                    className="cursor-pointer transition-colors duration-150 hover:bg-[var(--na-surface-raised)]"
                  >
                    <td className="px-4 py-4 align-top text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)] tabular-nums">
                      #{r.rank}
                    </td>
                    <td className="px-4 py-4 align-top">
                      <div className="text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)]">
                        {r.opportunity.title}
                      </div>
                      <div className="mt-0.5 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                        {r.opportunity.sector}
                        {r.preferenceRank ? `, Preference #${r.preferenceRank}` : ''}
                      </div>
                      <p className="mt-1.5 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                        {r.reason}
                      </p>
                    </td>
                    <td className="px-4 py-4 align-top text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
                      {r.opportunity.city ? `${r.opportunity.city}, ` : ''}
                      {r.opportunity.state}
                    </td>
                    <td className="px-4 py-4 align-top text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
                      {r.topGap ?? 'None'}
                    </td>
                    <td
                      className="px-4 py-4 text-right align-top text-[length:var(--na-text-body-sm)] font-semibold tabular-nums"
                      style={{ color: fitColorVar(r.overallScore) }}
                    >
                      {r.overallScore.toFixed(0)} / 100
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
