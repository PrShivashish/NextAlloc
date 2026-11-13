import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { apiGet, apiPost, errMsg } from '../../api/client';
import {
  CandidateAllocation,
  Readiness,
  Recommendation,
  CandidateAcademicDto,
  NocEvidenceDto,
  CandidateOffer,
} from '../../api/types';
import { Spinner, Callout, fmtNum, fmtTime } from '../../components/ui';

function offerPillStyle(status: CandidateOffer['status']): React.CSSProperties {
  if (status === 'JOINED' || status === 'ACCEPTED') {
    return {
      backgroundColor: 'var(--na-status-success-bg)',
      color: 'var(--na-status-success-text)',
      borderColor: 'var(--na-status-success-border)',
    };
  }
  if (status === 'OFFERED') {
    return {
      backgroundColor: 'var(--na-accent-subtle)',
      color: 'var(--na-accent-ink)',
      borderColor: 'var(--na-border-strong)',
    };
  }
  if (status === 'DECLINED' || status === 'EXPIRED') {
    return {
      backgroundColor: 'var(--na-status-error-bg)',
      color: 'var(--na-status-error-text)',
      borderColor: 'var(--na-status-error-border)',
    };
  }
  return {
    backgroundColor: 'var(--na-status-neutral-bg)',
    color: 'var(--na-status-neutral-text)',
    borderColor: 'var(--na-status-neutral-border)',
  };
}

export default function CandidateHome() {
  const { me } = useAuth();
  const nav = useNavigate();
  const [alloc, setAlloc] = useState<CandidateAllocation | null>(null);
  const [ready, setReady] = useState<Readiness | null>(null);
  const [actions, setActions] = useState<string[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [recs, setRecs] = useState<Recommendation[]>([]);
  const [academic, setAcademic] = useState<CandidateAcademicDto | null>(null);
  const [noc, setNoc] = useState<NocEvidenceDto | null>(null);
  const [offers, setOffers] = useState<CandidateOffer[]>([]);
  const [actionMsg, setActionMsg] = useState('');
  const [actionBusy, setActionBusy] = useState<number | null>(null);
  const [reviewOfferOpen, setReviewOfferOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [err, setErr] = useState('');

  const loadOffers = async () => {
    try {
      const o = await apiGet<CandidateOffer[]>('/candidates/me/offers');
      setOffers(o ?? []);
    } catch {
      setOffers([]);
    }
  };

  useEffect(() => {
    (async () => {
      try {
        const [a, d, h, r, acad, myNoc, myOffers] = await Promise.all([
          apiGet<CandidateAllocation>('/candidates/me/allocation'),
          apiGet<any>('/candidates/me/dashboard'),
          apiGet<any>('/candidates/me/allocation/history'),
          apiGet<any>('/candidates/me/recommendations').catch(() => null),
          apiGet<CandidateAcademicDto>('/candidates/me/academic').catch(() => null),
          apiGet<NocEvidenceDto>('/candidates/me/evidence/noc').catch(() => null),
          apiGet<CandidateOffer[]>('/candidates/me/offers').catch(() => []),
        ]);
        setAlloc(a);
        setReady(d.readiness ?? null);
        setActions(d.nextActions ?? d.actions ?? []);
        setHistory(h ?? []);
        setRecs(r?.items ?? []);
        setAcademic(acad ?? null);
        setNoc(myNoc ?? null);
        setOffers(myOffers ?? []);
      } catch (e) {
        setErr(errMsg(e));
      }
    })();
  }, []);

  const handleAcceptOffer = async (id: number) => {
    setActionBusy(id);
    setActionMsg('');
    try {
      const updated = await apiPost<CandidateOffer>(`/candidates/me/offers/${id}/accept`, {});
      setOffers(prev => prev.map(o => (o.id === id ? updated : o)));
      setActionMsg('Offer accepted. Your seat is confirmed.');
      await loadOffers();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setActionBusy(null);
    }
  };

  const handleDeclineOffer = async (id: number) => {
    if (!window.confirm('Decline this offer? The seat will be released for reallocation.')) return;
    setActionBusy(id);
    setActionMsg('');
    try {
      const updated = await apiPost<CandidateOffer>(`/candidates/me/offers/${id}/decline`, {
        reason: 'Candidate declined via portal',
      });
      setOffers(prev => prev.map(o => (o.id === id ? updated : o)));
      setActionMsg('Offer declined. The seat has been released.');
      await loadOffers();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setActionBusy(null);
    }
  };

  if (!alloc && !err) return <Spinner label="Loading your internship overview…" />;

  const todayLabel = new Date().toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const activeOffer =
    offers.find(o => o.status === 'OFFERED' || o.status === 'ACCEPTED' || o.status === 'JOINED') ??
    offers[0] ??
    null;
  const allocated = alloc?.state === 'ALLOCATED';
  const topRec = recs[0] ?? null;

  const actionRoute = (a: string) =>
    a.toLowerCase().includes('resume') || a.toLowerCase().includes('preference')
      ? '/candidate/profile'
      : a.toLowerCase().includes('skill')
        ? '/candidate/analytics'
        : '/candidate/explore';

  const nocStatus = ((noc as any)?.status ?? noc?.verificationStatus ?? 'NOT_SUBMITTED') as string;

  let nextActionTitle = actions[0] ?? 'Explore open opportunities';
  let nextActionCopy = 'Keep your skills and preferences up to date for upcoming allocation cycles.';
  let nextActionCta = 'Continue';
  let nextActionTo = actionRoute(nextActionTitle);

  if (!academic?.institutionName || academic.finalYearStatus === 'UNKNOWN') {
    nextActionTitle = 'Complete your academic declaration';
    nextActionCopy = 'Record your institution, degree program, and academic year to establish eligibility.';
    nextActionCta = 'Review documents';
    nextActionTo = '/candidate/profile';
  } else if (
    !noc ||
    nocStatus === 'NOT_SUBMITTED' ||
    nocStatus === 'REJECTED' ||
    nocStatus === 'PENDING_ADDITIONAL_INFO'
  ) {
    nextActionTitle = nocStatus === 'REJECTED' ? 'Re-upload NOC evidence' : 'Upload NOC evidence';
    nextActionCopy =
      nocStatus === 'REJECTED'
        ? 'Your previous certificate was rejected and needs a valid replacement.'
        : 'Submit a signed No Objection Certificate from your institution for review.';
    nextActionCta = 'Review documents';
    nextActionTo = '/candidate/profile';
  }

  const academicDone = academic?.finalYearStatus === 'VERIFIED_FINAL_YEAR';
  const academicLabel =
    academic?.finalYearStatus === 'VERIFIED_FINAL_YEAR'
      ? 'Verified final-year'
      : academic?.finalYearStatus === 'CLAIMED_FINAL_YEAR'
        ? 'Claimed final-year'
        : academic?.finalYearStatus === 'VERIFIED_NOT_FINAL_YEAR'
          ? 'Not eligible'
          : 'Pending declaration';

  const skillsItem = ready?.items?.find(
    it => it.key.toLowerCase().includes('skill') || it.label.toLowerCase().includes('skill'),
  );
  const skillsDone = skillsItem
    ? skillsItem.status?.toUpperCase().startsWith('COMPLET') || skillsItem.earned >= skillsItem.maxScore
    : (ready?.overall ?? 0) >= 80;
  const skillsLabel = skillsItem
    ? skillsDone
      ? 'Complete'
      : 'Pending'
    : ready
      ? `${ready.overall}% ready`
      : 'Pending';

  const nocDone = nocStatus === 'VERIFIED';
  const nocLabel =
    nocStatus === 'VERIFIED'
      ? 'Verified'
      : nocStatus === 'SUBMITTED'
        ? 'Awaiting admin review'
        : nocStatus === 'REJECTED'
          ? 'Rejected'
          : nocStatus === 'PENDING_ADDITIONAL_INFO'
            ? 'Clarification needed'
            : 'Not submitted';

  const topMatchScore = topRec
    ? `${topRec.overallScore.toFixed(0)}%`
    : alloc?.suitability != null
      ? `${alloc.suitability.toFixed(0)}%`
      : '—';
  const matchedCount =
    recs.length > 0 ? fmtNum(recs.filter(r => r.eligible).length || recs.length) : '—';
  const readinessPct = ready ? `${ready.overall}%` : '—';

  return (
    <div className="space-y-8">
      {/* 1. Page header */}
      <header className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[var(--na-border)] pb-5">
        <div>
          <h1 className="text-[length:var(--na-text-h1)] font-semibold leading-[var(--na-leading-tight)] text-[var(--na-ink-primary)]">
            Your internship
          </h1>
          <p className="mt-1.5 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)] tabular-nums">
            {todayLabel}
            {me?.name ? `, ${me.name}` : ''}
          </p>
        </div>
      </header>

      {err && <Callout tone="warn">{err}</Callout>}
      {actionMsg && <Callout tone="success">{actionMsg}</Callout>}

      {/* 2. Decisive offer module (eliminates duplicate action cards) */}
      {activeOffer ? (
        <section
          aria-label="Offer status and decision"
          className="rounded-[var(--na-radius-lg)] bg-[var(--na-anchor)] p-6 text-[var(--na-anchor-ink)] shadow-[var(--na-shadow-sm)]"
        >
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center rounded-full bg-[var(--na-anchor-2)] px-2.5 py-0.5 text-[length:var(--na-text-caption)] font-medium text-[var(--na-anchor-ink)]">
                  {activeOffer.status === 'OFFERED' ? 'Action required' : 'Allocation confirmed'}
                </span>
                <span
                  className="inline-flex items-center rounded-[var(--na-radius-sm)] border px-2 py-0.5 text-[length:var(--na-text-caption)] font-medium"
                  style={offerPillStyle(activeOffer.status)}
                >
                  {activeOffer.status}
                </span>
              </div>

              <h2 className="font-display text-[length:var(--na-text-h2)] font-semibold text-[var(--na-anchor-ink)]">
                {activeOffer.opportunityTitle}
              </h2>

              <p className="text-[length:var(--na-text-body-md)] text-[var(--na-anchor-muted)]">
                {activeOffer.providerName}
                {activeOffer.city ? ` · ${activeOffer.city}, ` : ' · '}
                {activeOffer.state}
                {activeOffer.durationMonths ? ` (${activeOffer.durationMonths} months)` : ''}
              </p>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[length:var(--na-text-caption)] text-[var(--na-anchor-muted)] tabular-nums pt-1">
                <span>Sector: {activeOffer.sector || 'Industry Placement'}</span>
                {activeOffer.runId && (
                  <span>Allocated under Run #{activeOffer.runId}</span>
                )}
                <span>Offered {fmtTime(activeOffer.offeredAt)}</span>
                {activeOffer.respondedAt && (
                  <span>Responded {fmtTime(activeOffer.respondedAt)}</span>
                )}
              </div>
            </div>

            {/* Decisive offer action buttons right in the module */}
            <div className="flex shrink-0 flex-wrap items-center gap-3 pt-2 lg:pt-0">
              {activeOffer.status === 'OFFERED' && (
                <>
                  <button
                    type="button"
                    disabled={actionBusy === activeOffer.id}
                    onClick={() => handleAcceptOffer(activeOffer.id)}
                    className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-[var(--na-radius-md)] bg-[var(--na-accent)] px-5 py-2.5 text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)] transition-colors duration-150 hover:bg-[var(--na-accent-hover)] active:opacity-90 disabled:opacity-55 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>{actionBusy === activeOffer.id ? 'Processing…' : 'Accept seat'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={actionBusy === activeOffer.id}
                    onClick={() => handleDeclineOffer(activeOffer.id)}
                    className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--na-radius-md)] border border-white/25 px-4 py-2.5 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-anchor-ink)] transition-colors duration-150 hover:bg-white/10 active:opacity-90 disabled:opacity-55"
                  >
                    Decline seat
                  </button>
                </>
              )}
              {activeOffer.status === 'ACCEPTED' && (
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center gap-1.5 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-signal)]">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>Seat confirmed</span>
                  </span>
                  <button
                    type="button"
                    disabled={actionBusy === activeOffer.id}
                    onClick={() => handleDeclineOffer(activeOffer.id)}
                    className="inline-flex min-h-[38px] items-center rounded-[var(--na-radius-md)] border border-white/20 px-3 py-1.5 text-[length:var(--na-text-caption)] font-medium text-[var(--na-anchor-muted)] hover:text-[var(--na-anchor-ink)] hover:bg-white/10"
                  >
                    Release seat
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      ) : allocated && alloc ? (
        <section
          aria-label="Allocation status"
          className="rounded-[var(--na-radius-lg)] bg-[var(--na-anchor)] px-6 py-5 text-[var(--na-anchor-ink)]"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-anchor-ink)]">
                Offer received for {alloc.opportunityTitle ?? 'your matched internship'}
              </h2>
              <p className="mt-1 text-[length:var(--na-text-body-sm)] text-[var(--na-anchor-muted)]">
                {[alloc.sector, alloc.opportunityState].filter(Boolean).join(', ') ||
                  'Allocated in the latest cycle'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => nav('/candidate/explore')}
              className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-[var(--na-radius-md)] bg-[var(--na-accent)] px-4 py-2 text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)] transition-colors duration-150 hover:bg-[var(--na-accent-hover)] active:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
            >
              <span>Explore matching details</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </section>
      ) : (
        /* Only shown when NO active offer exists — avoids duplicate action cards */
        <section
          aria-label="Next action"
          className="flex flex-col gap-4 rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-6 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="min-w-0">
            <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
              {nextActionTitle}
            </h2>
            <p className="mt-1 text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
              {nextActionCopy}
            </p>
          </div>
          <button
            type="button"
            onClick={() => nav(nextActionTo)}
            className="inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-[var(--na-radius-md)] border border-[var(--na-border-strong)] bg-[var(--na-surface)] px-4 py-2 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)] transition-colors duration-150 hover:bg-[var(--na-stone)]"
          >
            <span>{nextActionCta}</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </section>
      )}

      {/* 3. 3-column readiness strip (open layout with dividers, no nested cards) */}
      <section aria-label="Readiness summary">
        <h2 className="mb-3 text-[length:var(--na-text-h4)] font-medium text-[var(--na-ink-primary)]">
          Readiness
        </h2>
        <div className="grid grid-cols-1 divide-y divide-[var(--na-border)] border-y border-[var(--na-border)] md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="py-4 md:pr-6">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)]">
                Academic
              </span>
              <span
                className="inline-flex items-center gap-1.5 text-[length:var(--na-text-caption)] font-medium"
                style={{
                  color: academicDone ? 'var(--na-success-text)' : 'var(--na-ink-secondary)',
                }}
              >
                {academicDone ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Clock className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{academicLabel}</span>
              </span>
            </div>
            <p className="mt-1.5 truncate text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
              {academic?.institutionName || 'Declaration not yet submitted'}
            </p>
          </div>

          <div className="py-4 md:px-6">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)]">
                Skills
              </span>
              <span
                className="inline-flex items-center gap-1.5 text-[length:var(--na-text-caption)] font-medium tabular-nums"
                style={{
                  color: skillsDone ? 'var(--na-success-text)' : 'var(--na-ink-secondary)',
                }}
              >
                {skillsDone ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Clock className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{skillsLabel}</span>
              </span>
            </div>
            <p className="mt-1.5 truncate text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)] tabular-nums">
              {skillsItem
                ? skillsItem.detail || `${skillsItem.earned} of ${skillsItem.maxScore} points`
                : ready
                  ? `${ready.overall}% overall profile readiness`
                  : 'Profile skills pending'}
            </p>
          </div>

          <div className="py-4 md:pl-6">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)]">
                NOC
              </span>
              <span
                className="inline-flex items-center gap-1.5 text-[length:var(--na-text-caption)] font-medium"
                style={{
                  color: nocDone
                    ? 'var(--na-success-text)'
                    : nocStatus === 'REJECTED'
                      ? 'var(--na-error-text)'
                      : 'var(--na-ink-secondary)',
                }}
              >
                {nocDone ? (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                ) : nocStatus === 'REJECTED' ? (
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Clock className="h-4 w-4" aria-hidden="true" />
                )}
                <span>{nocLabel}</span>
              </span>
            </div>
            <p className="mt-1.5 truncate text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
              {noc?.issuingInstitution
                ? `${noc.issuingInstitution}${activeOffer?.runId ? ' · Current submission' : ''}`
                : 'No certificate uploaded'}
            </p>
          </div>
        </div>
      </section>

      {/* 5. Recent opportunities table */}
      <section aria-label="Matched opportunities">
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="text-[length:var(--na-text-h3)] font-semibold text-[var(--na-ink-primary)]">
            Matched opportunities
          </h2>
          <button
            type="button"
            onClick={() => nav('/candidate/explore')}
            className="inline-flex items-center gap-1 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)] transition-colors duration-150 hover:text-[var(--na-accent-ink)]"
          >
            <span>Explore all</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {recs.length === 0 ? (
          <div className="rounded-[var(--na-radius-lg)] bg-[var(--na-well)] px-6 py-8 text-center">
            <p className="text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)]">
              No matched opportunities yet
            </p>
            <p className="mt-1 text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
              Add your skills and preferences to see scored internship matches.
            </p>
          </div>
        ) : (
          <div className="min-w-0 overflow-x-auto rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)]">
            <table className="w-full min-w-[540px] border-collapse text-left">
              <thead>
                <tr className="border-b border-[var(--na-border)]">
                  <th className="px-4 py-3 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                    Opportunity
                  </th>
                  <th className="px-4 py-3 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                    Location
                  </th>
                  <th className="px-4 py-3 text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                    Gap
                  </th>
                  <th className="px-4 py-3 text-right text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                    Match
                  </th>
                  <th className="px-4 py-3 text-right text-[length:var(--na-text-caption)] font-medium text-[var(--na-ink-secondary)]">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--na-border-subtle)]">
                {recs.slice(0, 5).map(r => (
                  <tr
                    key={r.opportunity.id}
                    className="transition-colors duration-150 hover:bg-[var(--na-surface-raised)]"
                  >
                    <td className="px-4 py-3.5">
                      <div className="text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)]">
                        {r.opportunity.title}
                      </div>
                      <div className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
                        {r.opportunity.sector}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
                      {r.opportunity.city ? `${r.opportunity.city}, ` : ''}
                      {r.opportunity.state}
                    </td>
                    <td className="px-4 py-3.5 text-[length:var(--na-text-body-sm)] text-[var(--na-ink-secondary)]">
                      {r.topGap ?? 'None'}
                    </td>
                    <td className="px-4 py-3.5 text-right text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)] tabular-nums">
                      {r.overallScore.toFixed(0)}%
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <button
                        type="button"
                        onClick={() => nav('/candidate/analytics')}
                        className="inline-flex items-center gap-1 text-[length:var(--na-text-caption)] font-medium text-[var(--na-accent-ink)] hover:underline"
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
        )}
      </section>

      {/* 6. Analytics preview: inline key numbers, not a grid of KPI boxes */}
      <section
        aria-label="Analytics preview"
        className="flex flex-col gap-6 rounded-[var(--na-radius-lg)] bg-[var(--na-stone)] px-6 py-5 md:flex-row md:items-center md:justify-between"
      >
        <div className="flex flex-wrap items-baseline gap-x-10 gap-y-4">
          <div>
            <div className="text-[length:var(--na-text-h2)] font-semibold text-[var(--na-ink-primary)] tabular-nums">
              {topMatchScore}
            </div>
            <div className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
              Top match score
            </div>
          </div>
          <div>
            <div className="text-[length:var(--na-text-h2)] font-semibold text-[var(--na-ink-primary)] tabular-nums">
              {matchedCount}
            </div>
            <div className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
              Opportunities matched
            </div>
          </div>
          <div>
            <div className="text-[length:var(--na-text-h2)] font-semibold text-[var(--na-ink-primary)] tabular-nums">
              {readinessPct}
            </div>
            <div className="text-[length:var(--na-text-caption)] text-[var(--na-ink-secondary)]">
              Profile readiness
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => nav('/candidate/analytics')}
          className="inline-flex items-center gap-1.5 self-start text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-primary)] transition-colors duration-150 hover:text-[var(--na-accent-ink)] md:self-center"
        >
          <span>Open fit analytics</span>
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </section>

      {/* 7. Expandable technical / secondary details */}
      <section aria-label="Additional details" className="border-t border-[var(--na-border)] pt-4">
        <button
          type="button"
          aria-expanded={detailsOpen}
          onClick={() => setDetailsOpen(v => !v)}
          className="inline-flex min-h-[44px] items-center gap-2 text-[length:var(--na-text-body-sm)] font-medium text-[var(--na-ink-secondary)] transition-colors duration-150 hover:text-[var(--na-ink-primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
        >
          <span>View details</span>
          <ChevronDown
            className={`h-4 w-4 motion-safe:transition-transform duration-150 motion-reduce:transition-none ${detailsOpen ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        {detailsOpen && (
          <div className="mt-4 space-y-5 rounded-[var(--na-radius-lg)] bg-[var(--na-well)] p-5 text-[length:var(--na-text-body-sm)]">
            {academic?.institutionName && (
              <div>
                <h3 className="text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)]">
                  Academic record
                </h3>
                <p className="mt-1 text-[var(--na-ink-secondary)] tabular-nums">
                  {academic.institutionName}, {academic.degreeProgram} (Year{' '}
                  {academic.currentAcademicYear ?? '—'} of {academic.programDurationYears ?? '—'},
                  AISHE: {academic.institutionAisheCode || '—'})
                </p>
              </div>
            )}

            {noc && (
              <div>
                <h3 className="text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)]">
                  Institutional NOC
                </h3>
                <p className="mt-1 text-[var(--na-ink-secondary)] tabular-nums">
                  {noc.issuingInstitution}, signed by {noc.signatoryName} ({noc.signatoryRole}).
                  Valid {noc.validFrom || '—'} to {noc.validUntil || '—'}.
                </p>
              </div>
            )}

            {ready?.items && ready.items.length > 0 && (
              <div>
                <h3 className="text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)]">
                  Readiness checklist
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {ready.items.map(it => (
                    <li
                      key={it.key}
                      className="flex items-center justify-between gap-4 text-[var(--na-ink-secondary)]"
                    >
                      <span>{it.label}</span>
                      <span className="tabular-nums font-medium text-[var(--na-ink-primary)]">
                        {it.earned}/{it.maxScore}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {history.length > 0 && (
              <div>
                <h3 className="text-[length:var(--na-text-body-sm)] font-semibold text-[var(--na-ink-primary)]">
                  Allocation history
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {history.map(h => (
                    <li
                      key={h.runId}
                      className="flex flex-wrap items-center justify-between gap-2 text-[var(--na-ink-secondary)] tabular-nums"
                    >
                      <span>
                        Run #{h.runNumber}: {h.opportunityTitle ?? '—'}
                      </span>
                      <span>{fmtTime(h.completedAt)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
