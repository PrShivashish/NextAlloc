import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GraduationCap, MapPin, Briefcase, CheckCircle2, Sparkles, ArrowRight,
  Clock, PartyPopper, Hourglass, ListChecks, Target, FlaskConical, Lightbulb,
  ShieldCheck, FileText, Building2, Award,
} from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { apiGet, apiPost, errMsg } from '../../api/client';
import { CandidateAllocation, Readiness, Recommendation, CandidateAcademicDto, NocEvidenceDto, CandidateOffer } from '../../api/types';
import { SectionHeader, Spinner, Callout, Badge, fmtNum, fmtTime } from '../../components/ui';
import { ScoreRing } from '../../components/ScoreRing';

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
      } catch (e) { setErr(errMsg(e)); }
    })();
  }, []);

  const handleAcceptOffer = async (id: number) => {
    setActionBusy(id);
    setActionMsg('');
    try {
      const updated = await apiPost<CandidateOffer>(`/candidates/me/offers/${id}/accept`, {});
      setOffers(prev => prev.map(o => o.id === id ? updated : o));
      setActionMsg('Offer successfully accepted! Your seat is locked.');
      await loadOffers();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setActionBusy(null);
    }
  };

  const handleDeclineOffer = async (id: number) => {
    if (!window.confirm('Are you sure you want to decline this offer? The seat will be released for reallocation.')) return;
    setActionBusy(id);
    setActionMsg('');
    try {
      const updated = await apiPost<CandidateOffer>(`/candidates/me/offers/${id}/decline`, { reason: 'Candidate declined via portal' });
      setOffers(prev => prev.map(o => o.id === id ? updated : o));
      setActionMsg('Offer declined. The seat has been released.');
      await loadOffers();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setActionBusy(null);
    }
  };

  if (!alloc && !err) return <Spinner label="Preparing your dashboard…" />;

  const allocated = alloc?.state === 'ALLOCATED';
  const firstName = me?.name?.split(' ')[0] ?? 'there';
  const topRec = recs[0] ?? null;
  const primaryAction = actions[0] ?? 'You are ready — watch for the next allocation run';
  const actionRoute = (a: string) =>
    a.toLowerCase().includes('resume') ? '/candidate/profile'
      : a.toLowerCase().includes('preference') ? '/candidate/profile'
      : a.toLowerCase().includes('skill') ? '/candidate/analytics'
      : '/candidate/explore';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold text-ink">Namaste, {firstName}</h1>
          <p className="mt-1 text-[13.5px] text-navy-500">Your internship readiness, best fits and allocation status — in one place.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-saffron-50 px-3 py-1 text-[11px] font-semibold text-saffron-700 ring-1 ring-saffron-200">
          <FlaskConical className="h-3.5 w-3.5" /> Synthetic Demonstration Data
        </span>
      </div>

      {err && <Callout tone="warn">{err}</Callout>}

      {/* Allocation hero */}
      <div className={`card relative overflow-hidden p-6 ${allocated ? 'border-emerald-200 bg-gradient-to-br from-emerald-50/80 via-white to-white ring-1 ring-emerald-200' : 'bg-gradient-to-br from-navy-900 to-ink text-white'}`}>
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-saffron-400/10 blur-2xl" />
        {allocated && alloc ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-emerald-500 p-3.5 text-white shadow-lg"><PartyPopper className="h-7 w-7" /></div>
              <div>
                <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-emerald-600">Your allocation</div>
                <div className="font-display mt-1 text-[22px] font-bold leading-snug text-ink">
                  You have been allocated <span className="whitespace-nowrap">{alloc.opportunityTitle}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-[13px] text-navy-500">
                  <span className="chip bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"><CheckCircle2 className="h-3.5 w-3.5" /> Allocated in the latest global allocation</span>
                  {alloc.sector && <span className="chip bg-navy-50 text-navy-700 ring-1 ring-navy-100">{alloc.sector}</span>}
                  {alloc.opportunityState && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{alloc.opportunityState}</span>}
                </div>
                <div className="mt-2 text-[12.5px] text-navy-400">
                  {alloc.suitability != null && <>Overall fit: <span className="font-bold text-navy-700">{alloc.suitability.toFixed(1)} / 100</span> · </>}
                  Decided in Allocation Run #{alloc.runNumber} · {fmtTime(alloc.runAt)}
                  {alloc.preferenceRank ? ` · your rank #${alloc.preferenceRank} choice` : ''}
                </div>
                {recs[0] && recs[0].opportunity.title !== alloc.opportunityTitle && (
                  <div className="mt-1.5 text-[11.5px] text-navy-400">
                    Your top individual fit is actually{' '}
                    <button className="font-semibold text-saffron-600 underline-offset-2 hover:underline" onClick={() => nav('/candidate/analytics')}>
                      {recs[0].opportunity.title} ({recs[0].overallScore.toFixed(0)}/100)
                    </button>{' '}
                    — you were still routed here because the global allocation balances every candidate and every seat at once, not just your personal best fit.
                  </div>
                )}
              </div>
            </div>
            <button className="btn-dark" onClick={() => nav('/candidate/explore')}>
              <Briefcase className="h-4 w-4" /> View opportunity
            </button>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-2xl bg-white/10 p-3.5 ring-1 ring-white/15"><Hourglass className="h-7 w-7 text-saffron-400" /></div>
              <div>
                <div className="text-[12px] font-bold uppercase tracking-[0.1em] text-saffron-400">Your internship readiness</div>
                <div className="font-display mt-1 text-[20px] font-bold">{alloc?.message ?? 'Awaiting the next allocation run.'}</div>
                <div className="mt-1 text-[13px] text-navy-200/80">Your profile is being considered in every global allocation run.</div>
              </div>
            </div>
            <button className="btn-primary" onClick={() => nav('/candidate/analytics')}>
              <Target className="h-4 w-4" /> See my fit analytics
            </button>
          </div>
        )}
      </div>

      {/* Actionable Offers Card */}
      {offers.length > 0 && (
        <div className="card p-5 border-l-4 border-l-saffron-500 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 pb-3">
            <div className="flex items-center gap-2.5">
              <Award className="h-5 w-5 text-saffron-600" />
              <div>
                <div className="font-display text-[15px] font-bold text-ink">Actionable Internship Offers</div>
                <div className="text-[12px] text-navy-500">
                  Direct seats generated from global allocation runs. Accept to lock your placement.
                </div>
              </div>
            </div>
            <span className="chip bg-navy-50 text-navy-600 ring-1 ring-navy-200">
              {offers.filter(o => o.status === 'OFFERED').length} pending action
            </span>
          </div>

          {actionMsg && <div className="mt-3"><Callout tone="success">{actionMsg}</Callout></div>}

          <div className="mt-3.5 space-y-3">
            {offers.map(o => (
              <div key={o.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl border border-navy-100 bg-white p-4 transition hover:border-saffron-200">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-ink text-[14px]">{o.opportunityTitle}</span>
                    <Badge
                      tone={
                        o.status === 'JOINED' ? 'green' :
                        o.status === 'ACCEPTED' ? 'leaf' :
                        o.status === 'OFFERED' ? 'amber' :
                        o.status === 'DECLINED' ? 'red' : 'gray'
                      }
                      dot
                    >
                      {o.status}
                    </Badge>
                  </div>
                  <div className="text-[12px] text-navy-500 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="flex items-center gap-1"><Building2 className="h-3.5 w-3.5 text-navy-400" />{o.providerName}</span>
                    <span>·</span>
                    <span>{o.sector}</span>
                    <span>·</span>
                    <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5 text-navy-400" />{o.city ? `${o.city}, ` : ''}{o.state}</span>
                    <span>·</span>
                    <span>{o.durationMonths} months</span>
                  </div>
                  <div className="text-[11px] text-navy-400">
                    Offered {fmtTime(o.offeredAt)}
                    {o.respondedAt && ` · Responded ${fmtTime(o.respondedAt)}`}
                    {o.joinedAt && ` · Joined ${fmtTime(o.joinedAt)}`}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {o.status === 'OFFERED' && (
                    <>
                      <button
                        className="btn-primary btn-sm"
                        disabled={actionBusy === o.id}
                        onClick={() => handleAcceptOffer(o.id)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Accept Seat
                      </button>
                      <button
                        className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                        disabled={actionBusy === o.id}
                        onClick={() => handleDeclineOffer(o.id)}
                      >
                        Decline
                      </button>
                    </>
                  )}
                  {o.status === 'ACCEPTED' && (
                    <div className="flex items-center gap-2">
                      <span className="chip bg-leaf-50 text-leaf-700 ring-1 ring-leaf-200 text-xs">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Seat Locked
                      </span>
                      <button
                        className="btn-ghost btn-sm text-navy-400 text-xs hover:text-red-600"
                        disabled={actionBusy === o.id}
                        onClick={() => handleDeclineOffer(o.id)}
                      >
                        Cancel / Decline
                      </button>
                    </div>
                  )}
                  {o.status === 'JOINED' && (
                    <span className="chip bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 text-xs">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Onboarded & Verified
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Institutional Clearance & Verification Governance Card */}
      <div className="card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 pb-3">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-saffron-600" />
            <div>
              <div className="font-display text-[15px] font-bold text-ink">Institutional Clearance & Eligibility Standing</div>
              <div className="text-[12px] text-navy-500">
                NextAlloc enforces deterministic rule gates: only policy-valid candidates enter CP-SAT multi-objective optimization.
              </div>
            </div>
          </div>
          <button
            onClick={() => nav('/candidate/profile')}
            className="btn-ghost btn-sm"
          >
            Update Academic & NOC Details <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="mt-3.5 grid gap-4 sm:grid-cols-2">
          {/* Academic Standing */}
          <div className="rounded-xl bg-navy-50/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-navy-500">Academic Declaration:</span>
              <Badge
                tone={
                  academic?.finalYearStatus === 'VERIFIED_FINAL_YEAR'
                    ? 'green'
                    : academic?.finalYearStatus === 'CLAIMED_FINAL_YEAR'
                      ? 'amber'
                      : academic?.finalYearStatus === 'VERIFIED_NOT_FINAL_YEAR'
                        ? 'red'
                        : 'gray'
                }
                dot
              >
                {academic?.finalYearStatus === 'VERIFIED_FINAL_YEAR'
                  ? 'VERIFIED FINAL YEAR'
                  : academic?.finalYearStatus === 'CLAIMED_FINAL_YEAR'
                    ? 'CLAIMED FINAL YEAR'
                    : academic?.finalYearStatus === 'VERIFIED_NOT_FINAL_YEAR'
                      ? 'VERIFIED NON-FINAL YEAR'
                      : 'UNVERIFIED / INCOMPLETE'}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-navy-700">
              {academic?.institutionName ? (
                <>
                  <div className="font-medium text-ink">{academic.institutionName}</div>
                  <div className="text-[11px] text-navy-400">{academic.degreeProgram} · Year {academic.currentAcademicYear || '?'} of {academic.programDurationYears || '?'} (AISHE: {academic.institutionAisheCode || 'N/A'})</div>
                </>
              ) : (
                <span className="text-navy-400 italic">No academic declaration recorded. Please declare your college & program.</span>
              )}
            </div>
          </div>

          {/* Institutional NOC */}
          <div className="rounded-xl bg-navy-50/60 p-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-navy-500">Institutional NOC:</span>
              <Badge
                tone={
                  noc?.verificationStatus === 'VERIFIED'
                    ? 'green'
                    : noc?.verificationStatus === 'SUBMITTED'
                      ? 'amber'
                      : noc?.verificationStatus === 'REJECTED'
                        ? 'red'
                        : 'gray'
                }
                dot
              >
                {noc?.verificationStatus === 'VERIFIED'
                  ? 'VERIFIED & APPROVED'
                  : noc?.verificationStatus === 'SUBMITTED'
                    ? 'SUBMITTED (Pending Review)'
                    : noc?.verificationStatus === 'REJECTED'
                      ? 'REJECTED (Action Required)'
                      : noc?.verificationStatus === 'PENDING_ADDITIONAL_INFO'
                        ? 'CLARIFICATION NEEDED'
                        : 'NOT SUBMITTED'}
              </Badge>
            </div>
            <div className="mt-2 text-xs text-navy-700">
              {noc ? (
                <>
                  <div className="font-medium text-ink">{noc.issuingInstitution}</div>
                  <div className="text-[11px] text-navy-400">Signed by {noc.signatoryName} ({noc.signatoryRole}) · Valid: {noc.validFrom || '—'} to {noc.validUntil || '—'}</div>
                </>
              ) : (
                <span className="text-navy-400 italic">No institutional certificate on file. Upload a signed NOC from your institution.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Readiness + single next action */}
        <div className="card p-5">
          <SectionHeader title="Profile readiness" sub="How complete your profile is" />
          <div className="flex items-center gap-5">
            <ScoreRing value={ready?.overall ?? 0} size={84} label="ready" />
            <div className="flex-1 space-y-1.5">
              {(ready?.items ?? []).map(it => (
                <div key={it.key} className="flex items-center gap-2" title={it.detail}>
                  {it.status === 'COMPLETED'
                    ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
                    : <Clock className="h-4 w-4 shrink-0 text-amber-500" />}
                  <span className={`flex-1 truncate text-[12.5px] ${it.status === 'COMPLETED' ? 'text-navy-700' : 'text-navy-500'}`}>{it.label}</span>
                  <span className="text-[11.5px] font-semibold text-navy-400">{it.earned}/{it.maxScore}</span>
                </div>
              ))}
            </div>
          </div>
          <button className="btn-primary btn-sm mt-4 w-full" onClick={() => nav(actionRoute(primaryAction))}>
            <span className="max-w-full truncate">{primaryAction}</span> <ArrowRight className="h-3.5 w-3.5 shrink-0" />
          </button>
        </div>

        {/* Recommended for you (top 3) */}
        <div className="card p-5 lg:col-span-2">
          <SectionHeader title="Recommended for you"
            sub="Best current-fit internships — recommendation, not a final allocation"
            right={<button className="btn-ghost btn-sm" onClick={() => nav('/candidate/analytics')}>Full fit analytics <ArrowRight className="h-3.5 w-3.5" /></button>} />
          {recs.length === 0 ? (
            <div className="rounded-xl border border-dashed border-navy-200 p-6 text-center">
              <Target className="mx-auto h-8 w-8 text-navy-300" />
              <div className="mt-2 text-[13.5px] font-semibold text-navy-600">No recommendations yet</div>
              <div className="mx-auto mt-1 max-w-sm text-[12.5px] text-navy-400">
                Add skills, interests and a preference, and your best-fit internships will appear here — scored by the same engine that runs the global allocation.
              </div>
              <button className="btn-ghost btn-sm mt-3" onClick={() => nav('/candidate/profile')}>Complete your profile</button>
            </div>
          ) : (
            <div className="space-y-2">
              {recs.slice(0, 3).map(r => (
                <button key={r.opportunity.id} onClick={() => nav('/candidate/analytics')}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-navy-100 px-4 py-3 text-left transition hover:border-saffron-200 hover:bg-saffron-50/30">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="font-display flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-navy-900 text-[12px] font-bold text-white">#{r.rank}</span>
                    <div className="min-w-0">
                      <div className="truncate text-[13.5px] font-bold text-ink">{r.opportunity.title}</div>
                      <div className="truncate text-[11.5px] text-navy-400">
                        {r.opportunity.sector} · {r.opportunity.state}
                        {r.topGap ? <> · main gap: <span className="text-amber-600">{r.topGap}</span></> : <> · all listed skills covered</>}
                      </div>
                    </div>
                  </div>
                  <span className={`shrink-0 font-display text-[16px] font-bold ${r.overallScore >= 70 ? 'text-emerald-600' : r.overallScore >= 50 ? 'text-saffron-600' : 'text-red-500'}`}>
                    {r.overallScore.toFixed(0)}<span className="text-[10px] font-semibold text-navy-400"> /100</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Top improvement (skill gap highlight) */}
      {topRec && (
        <div className="card flex flex-wrap items-center justify-between gap-3 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-saffron-50 p-2.5 text-saffron-600 ring-1 ring-saffron-100"><Lightbulb className="h-5 w-5" /></div>
            <div>
              <div className="text-[13.5px] font-bold text-ink">
                {topRec.topGap
                  ? <>Top improvement: add <span className="text-saffron-700">{topRec.topGap}</span> to strengthen your fit for {topRec.opportunity.title}</>
                  : <>You cover every listed skill for {topRec.opportunity.title} — your strongest current fit</>}
              </div>
              <div className="mt-0.5 text-[12.5px] text-navy-400">
                {topRec.topGap
                  ? 'Skills you verify on your profile are the input the engine scores — see the skill-gap assistant for grounded guidance.'
                  : 'Work the other levers (preferences, location) in Fit Analytics to raise the score further.'}
              </div>
            </div>
          </div>
          <button className="btn-ghost btn-sm" onClick={() => nav('/candidate/analytics')}>Open skill gap <ArrowRight className="h-3.5 w-3.5" /></button>
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="card p-5">
          <SectionHeader title="Your allocation history" />
          <div className="space-y-2">
            {history.map(h => (
              <div key={h.runId} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-navy-100 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Badge tone="green" dot>Allocated</Badge>
                  <span className="text-[13px] font-medium text-navy-700">
                    Allocation Run #{h.runNumber} · {h.opportunityTitle ?? '—'}
                    {h.suitability != null && <span className="ml-2 text-[12px] text-navy-400">fit {h.suitability.toFixed(1)}</span>}
                  </span>
                </div>
                <span className="text-[12px] text-navy-400">{fmtTime(h.completedAt)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
