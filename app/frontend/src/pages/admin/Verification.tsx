import React, { useEffect, useState } from 'react';
import {
  ShieldCheck, FileText, CheckCircle2, XCircle, HelpCircle,
  AlertTriangle, Download, RefreshCw, UserCheck, Search,
  GraduationCap, Building2, Calendar, Clock, ArrowRight, ShieldAlert,
} from 'lucide-react';
import { apiGet, apiPost, apiDownload, errMsg } from '../../api/client';
import {
  NocReviewQueueItemDto,
  CandidateAcademicDetailDto,
  AcademicReviewResponseDto,
  AcademicReviewDecision,
  Page,
} from '../../api/types';
import { SectionHeader, Spinner, Callout, Badge, StatCard } from '../../components/ui';

export default function AdminVerification() {
  const [activeTab, setActiveTab] = useState<'noc' | 'academic'>('noc');

  // NOC Queue State
  const [nocQueue, setNocQueue] = useState<NocReviewQueueItemDto[]>([]);
  const [loadingNocs, setLoadingNocs] = useState(false);
  const [nocErr, setNocErr] = useState('');
  const [nocMsg, setNocMsg] = useState('');
  const [selectedNoc, setSelectedNoc] = useState<NocReviewQueueItemDto | null>(null);
  const [nocAction, setNocAction] = useState<'verify' | 'reject' | 'clarify' | null>(null);
  const [nocReasonCode, setNocReasonCode] = useState('INSTITUTIONAL_NOC_REJECTED');
  const [nocNotes, setNocNotes] = useState('');
  const [submittingNoc, setSubmittingNoc] = useState(false);

  // Academic Review State
  const [candidateIdInput, setCandidateIdInput] = useState('');
  const [academicDetail, setAcademicDetail] = useState<CandidateAcademicDetailDto | null>(null);
  const [loadingAcademic, setLoadingAcademic] = useState(false);
  const [academicErr, setAcademicErr] = useState('');
  const [academicMsg, setAcademicMsg] = useState('');
  const [academicDecision, setAcademicDecision] = useState<AcademicReviewDecision>('APPROVE');
  const [supportingEvidenceId, setSupportingEvidenceId] = useState<string>('');
  const [academicNotes, setAcademicNotes] = useState('');
  const [submittingAcademic, setSubmittingAcademic] = useState(false);
  const [academicConflict, setAcademicConflict] = useState(false);

  // Load NOC Queue
  const fetchNocQueue = async () => {
    setLoadingNocs(true);
    setNocErr('');
    try {
      const data = await apiGet<Page<NocReviewQueueItemDto>>('/admin/evidence/noc/pending', { page: 0, size: 50 });
      setNocQueue(data.content || []);
    } catch (e: any) {
      setNocErr(errMsg(e));
    } finally {
      setLoadingNocs(false);
    }
  };

  useEffect(() => {
    void fetchNocQueue();
  }, []);

  // Handle NOC Download
  const handleDownloadNoc = async (item: NocReviewQueueItemDto) => {
    try {
      await apiDownload(
        `/api/admin/evidence/noc/${item.id}/download`,
        `institutional-noc-${item.candidateId}-${item.id}.pdf`
      );
    } catch (e: any) {
      setNocErr(errMsg(e));
    }
  };

  // Submit NOC Review
  const handleNocDecision = async () => {
    if (!selectedNoc || !nocAction) return;
    setSubmittingNoc(true);
    setNocErr('');
    setNocMsg('');
    try {
      const endpoint = nocAction === 'verify'
        ? `/admin/evidence/noc/${selectedNoc.id}/verify`
        : nocAction === 'reject'
          ? `/admin/evidence/noc/${selectedNoc.id}/reject`
          : `/admin/evidence/noc/${selectedNoc.id}/request-clarification`;

      const payload: any = {
        expectedVersion: selectedNoc.version,
        notes: nocNotes.trim() || undefined,
      };

      if (nocAction === 'reject') {
        payload.reasonCode = nocReasonCode;
      }

      await apiPost(endpoint, payload);

      setNocMsg(`NOC #${selectedNoc.id} for candidate ${selectedNoc.candidateName} successfully ${nocAction === 'verify' ? 'approved' : nocAction === 'reject' ? 'rejected' : 'marked for clarification'}.`);
      setSelectedNoc(null);
      setNocAction(null);
      setNocNotes('');
      await fetchNocQueue();
    } catch (e: any) {
      if (e.status === 409) {
        setNocErr('Concurrency conflict (HTTP 409): This NOC was updated by another administrator or session. Reloading queue.');
        await fetchNocQueue();
      } else {
        setNocErr(errMsg(e));
      }
    } finally {
      setSubmittingNoc(false);
    }
  };

  // Fetch Academic Profile
  const fetchAcademicDetail = async (cId: string) => {
    if (!cId.trim()) return;
    setLoadingAcademic(true);
    setAcademicErr('');
    setAcademicMsg('');
    setAcademicConflict(false);
    try {
      const data = await apiGet<CandidateAcademicDetailDto>(`/admin/candidates/${cId.trim()}/academic`);
      setAcademicDetail(data);
      setSupportingEvidenceId(data.activeNocEvidenceId ? String(data.activeNocEvidenceId) : '');
      setAcademicDecision(data.finalYearStatus === 'CLAIMED_FINAL_YEAR' ? 'APPROVE' : 'VERIFY_NOT_FINAL_YEAR');
    } catch (e: any) {
      setAcademicErr(errMsg(e));
      setAcademicDetail(null);
    } finally {
      setLoadingAcademic(false);
    }
  };

  // Submit Academic Review
  const handleAcademicReview = async () => {
    if (!academicDetail) return;
    if (!academicNotes.trim()) {
      setAcademicErr('Reviewer notes are mandatory to provide audit transparency.');
      return;
    }
    if (academicDecision === 'APPROVE' && !supportingEvidenceId.trim()) {
      setAcademicErr('Approving final-year standing requires a valid supporting NOC evidence reference.');
      return;
    }

    setSubmittingAcademic(true);
    setAcademicErr('');
    setAcademicMsg('');
    setAcademicConflict(false);

    try {
      const payload = {
        decision: academicDecision,
        notes: academicNotes.trim(),
        supportingEvidenceId: supportingEvidenceId.trim() ? Number(supportingEvidenceId.trim()) : null,
        expectedVersion: academicDetail.version,
      };

      const result = await apiPost<AcademicReviewResponseDto>(
        `/admin/candidates/${academicDetail.candidateId}/academic/verify`,
        payload
      );

      setAcademicMsg(`Academic standing reviewed: Candidate ${result.candidateId} status is now ${result.finalYearStatus} (Version v${result.version}).`);
      setAcademicNotes('');
      // Reload updated record
      await fetchAcademicDetail(String(academicDetail.candidateId));
    } catch (e: any) {
      if (e.status === 409) {
        setAcademicConflict(true);
        setAcademicErr('Optimistic concurrency conflict (HTTP 409): Candidate updated their academic declaration or another administrator reviewed this record concurrently. Please refresh.');
      } else {
        setAcademicErr(errMsg(e));
      }
    } finally {
      setSubmittingAcademic(false);
    }
  };

  // Quick switch from NOC to Academic Review
  const inspectCandidateAcademic = (cId: number) => {
    setCandidateIdInput(String(cId));
    setActiveTab('academic');
    void fetchAcademicDetail(String(cId));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-[24px] font-bold text-ink">Verification & Governance</h1>
          <p className="mt-1 text-[13.5px] text-navy-500">
            Authoritative administrator review for institutional No Objection Certificates and candidate academic declarations.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { void fetchNocQueue(); if (academicDetail) void fetchAcademicDetail(String(academicDetail.candidateId)); }}
            className="btn-ghost btn-sm"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Pending NOC Submissions"
          value={loadingNocs ? '…' : nocQueue.length}
          sub="Official certificates awaiting review"
          icon={<FileText className="h-5 w-5" />}
          tone={nocQueue.length > 0 ? 'saffron' : 'leaf'}
        />
        <StatCard
          label="Active Governance Gate"
          value="Deterministic"
          sub="Requires NOC + Academic clearance"
          icon={<ShieldCheck className="h-5 w-5" />}
          tone="navy"
        />
        <StatCard
          label="Concurrency Protection"
          value="OCC (v4)"
          sub="Database-enforced @Version lock"
          icon={<ShieldAlert className="h-5 w-5" />}
          tone="leaf"
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-navy-200">
        <button
          onClick={() => setActiveTab('noc')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === 'noc'
              ? 'border-saffron-500 text-saffron-600'
              : 'border-transparent text-navy-500 hover:text-ink'
          }`}
        >
          <FileText className="h-4 w-4" />
          Institutional NOC Queue
          {nocQueue.length > 0 && (
            <span className="rounded-full bg-saffron-100 px-2 py-0.5 text-[11px] font-bold text-saffron-700">
              {nocQueue.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('academic')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition ${
            activeTab === 'academic'
              ? 'border-saffron-500 text-saffron-600'
              : 'border-transparent text-navy-500 hover:text-ink'
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          Academic Status Verification
        </button>
      </div>

      {/* ===================== TAB 1: NOC QUEUE ===================== */}
      {activeTab === 'noc' && (
        <div className="space-y-4">
          {nocErr && <Callout tone="danger">{nocErr}</Callout>}
          {nocMsg && <Callout tone="success">{nocMsg}</Callout>}

          <SectionHeader
            title="Pending Institutional NOC Reviews"
            sub="Review signed certificates uploaded by candidates. Verifying an NOC activates eligibility under rules requiring institutional clearance."
          />

          {loadingNocs ? (
            <Spinner label="Loading pending NOC queue…" />
          ) : nocQueue.length === 0 ? (
            <div className="card p-10 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500" />
              <div className="font-display mt-3 text-base font-bold text-ink">No Pending NOC Submissions</div>
              <p className="mt-1 text-sm text-navy-500">
                All submitted institutional No Objection Certificates have been reviewed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {nocQueue.map((item) => (
                <div key={item.id} className="card p-5 transition hover:border-navy-300">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-base font-bold text-ink">{item.candidateName}</span>
                        <span className="text-xs text-navy-400">ID #{item.candidateId}</span>
                        <Badge tone="amber" dot>SUBMITTED (v{item.version})</Badge>
                      </div>
                      <div className="text-xs text-navy-500">
                        {item.candidateEmail} · {item.candidatePhone}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => void handleDownloadNoc(item)}
                        className="btn-ghost btn-sm"
                        title="Download uploaded PDF document"
                      >
                        <Download className="h-3.5 w-3.5" /> Download PDF
                      </button>
                      <button
                        onClick={() => inspectCandidateAcademic(item.candidateId)}
                        className="btn-ghost btn-sm"
                        title="Open Candidate Academic Review"
                      >
                        <GraduationCap className="h-3.5 w-3.5" /> Academic Review <ArrowRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  {/* Document & Signatory Context */}
                  <div className="mt-4 grid gap-4 rounded-xl bg-navy-50/60 p-4 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <span className="font-semibold text-navy-500">Issuing Institution:</span>
                      <div className="mt-0.5 font-medium text-ink">{item.issuingInstitution}</div>
                    </div>
                    <div>
                      <span className="font-semibold text-navy-500">Signatory:</span>
                      <div className="mt-0.5 font-medium text-ink">
                        {item.signatoryName} ({item.signatoryRole})
                      </div>
                      <div className="text-[11px] text-navy-400">{item.signatoryEmail}</div>
                    </div>
                    <div>
                      <span className="font-semibold text-navy-500">Validity Window:</span>
                      <div className="mt-0.5 font-medium text-ink">
                        {item.validFrom || '—'} to {item.validUntil || '—'}
                      </div>
                    </div>
                    <div>
                      <span className="font-semibold text-navy-500">Conflict Declaration:</span>
                      <div className="mt-0.5 font-medium text-emerald-700">
                        {item.declaresNoAcademicConflict ? '✓ No conflict certified' : '✗ Conflict declared'}
                      </div>
                    </div>
                  </div>

                  {/* Signatory Validation Warning if any */}
                  {item.signatoryValidationWarning && (
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-800">
                      <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 text-amber-600" />
                      <span className="font-semibold">Signatory Advisory:</span> {item.signatoryValidationWarning}
                    </div>
                  )}

                  {/* Candidate Academic Standing Context */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-navy-100 pt-3 text-xs text-navy-600">
                    <span className="font-semibold text-navy-500">Academic Context:</span>
                    <span>{item.academicDegreeProgram || 'Program unspecified'}</span>
                    <span>·</span>
                    <span>{item.academicInstitutionName || 'Institution unstated'}</span>
                    <span>·</span>
                    <span>Year {item.currentAcademicYear || '?'} of {item.programDurationYears || '?'}</span>
                    <span>·</span>
                    <Badge tone={item.academicFinalYearStatus === 'CLAIMED_FINAL_YEAR' ? 'amber' : 'navy'}>
                      {item.academicFinalYearStatus || 'UNKNOWN'}
                    </Badge>
                  </div>

                  {/* Action Bar */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-navy-100 pt-3">
                    <div className="text-[11.5px] text-navy-400">
                      Fingerprint: <span className="font-mono">{item.documentSha256 ? item.documentSha256.substring(0, 16) + '…' : '—'}</span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => { setSelectedNoc(item); setNocAction('clarify'); setNocNotes(''); }}
                        className="btn-ghost btn-sm text-amber-700 hover:bg-amber-50"
                      >
                        <HelpCircle className="h-3.5 w-3.5" /> Request Clarification
                      </button>
                      <button
                        onClick={() => { setSelectedNoc(item); setNocAction('reject'); setNocNotes(''); }}
                        className="btn-ghost btn-sm text-red-600 hover:bg-red-50"
                      >
                        <XCircle className="h-3.5 w-3.5" /> Reject NOC
                      </button>
                      <button
                        onClick={() => { setSelectedNoc(item); setNocAction('verify'); setNocNotes('Approved after verifying institutional signatory and dates.'); }}
                        className="btn-primary btn-sm"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Approve NOC
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal / Dialog for NOC Review Actions */}
          {selectedNoc && nocAction && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-navy-950/60 p-4">
              <div className="card w-full max-w-lg p-6 shadow-2xl">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-display text-lg font-bold text-ink">
                      {nocAction === 'verify' ? 'Approve Institutional NOC' : nocAction === 'reject' ? 'Reject Institutional NOC' : 'Request NOC Clarification'}
                    </h3>
                    <p className="mt-1 text-xs text-navy-500">
                      Candidate: {selectedNoc.candidateName} (ID #{selectedNoc.candidateId}) · NOC #{selectedNoc.id} (Version v{selectedNoc.version})
                    </p>
                  </div>
                  <button onClick={() => { setSelectedNoc(null); setNocAction(null); }} className="text-navy-400 hover:text-ink">
                    ✕
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {nocAction === 'reject' && (
                    <div>
                      <label className="label">Rejection Reason Code</label>
                      <select
                        className="input"
                        value={nocReasonCode}
                        onChange={(e) => setNocReasonCode(e.target.value)}
                      >
                        <option value="INSTITUTIONAL_NOC_REJECTED">INSTITUTIONAL_NOC_REJECTED — Non-compliant document</option>
                        <option value="INSTITUTIONAL_NOC_EXPIRED">INSTITUTIONAL_NOC_EXPIRED — Validity window elapsed</option>
                        <option value="UNAUTHORIZED_NOC_SIGNATORY">UNAUTHORIZED_NOC_SIGNATORY — Signatory unauthorized</option>
                        <option value="NOC_ACADEMIC_CONFLICT_DECLARED">NOC_ACADEMIC_CONFLICT_DECLARED — Academic conflict present</option>
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="label">
                      {nocAction === 'verify' ? 'Review Notes (Optional)' : 'Review Notes / Feedback (Required)'}
                    </label>
                    <textarea
                      className="input min-h-[90px]"
                      placeholder={
                        nocAction === 'verify'
                          ? 'Optional review notes…'
                          : nocAction === 'reject'
                            ? 'Explain reason for rejection to candidate…'
                            : 'Specify required clarifications from student or college authority…'
                      }
                      value={nocNotes}
                      onChange={(e) => setNocNotes(e.target.value)}
                    />
                  </div>

                  <div className="rounded-lg bg-navy-50 p-2.5 text-[11.5px] text-navy-600">
                    <span className="font-semibold">Optimistic Lock Check:</span> Verifying with Expected Version: <code>v{selectedNoc.version}</code>.
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => { setSelectedNoc(null); setNocAction(null); }}
                    className="btn-ghost btn-sm"
                    disabled={submittingNoc}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => void handleNocDecision()}
                    disabled={submittingNoc || (nocAction !== 'verify' && !nocNotes.trim())}
                    className={`btn-sm ${nocAction === 'verify' ? 'btn-primary' : nocAction === 'reject' ? 'btn-danger' : 'btn-dark'}`}
                  >
                    {submittingNoc ? 'Submitting…' : nocAction === 'verify' ? 'Confirm Approval' : nocAction === 'reject' ? 'Confirm Rejection' : 'Send Clarification Request'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB 2: ACADEMIC VERIFICATION ===================== */}
      {activeTab === 'academic' && (
        <div className="space-y-4">
          {academicErr && <Callout tone="danger">{academicErr}</Callout>}
          {academicMsg && <Callout tone="success">{academicMsg}</Callout>}

          <SectionHeader
            title="Candidate Academic Review & Status Authorization"
            sub="Review candidate-declared enrollment data against supporting evidence. Authorizing final-year standing enables allocation into final-year positions."
          />

          {/* Lookup Input */}
          <div className="card p-5">
            <label className="label">Inspect Candidate by ID</label>
            <div className="flex gap-2">
              <input
                className="input max-w-xs"
                type="number"
                placeholder="Candidate ID (e.g. 101)…"
                value={candidateIdInput}
                onChange={(e) => setCandidateIdInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void fetchAcademicDetail(candidateIdInput)}
              />
              <button
                onClick={() => void fetchAcademicDetail(candidateIdInput)}
                disabled={loadingAcademic || !candidateIdInput.trim()}
                className="btn-primary"
              >
                <Search className="h-4 w-4" />
                {loadingAcademic ? 'Loading…' : 'Inspect Academic Profile'}
              </button>
            </div>
          </div>

          {/* Detail & Decision Form */}
          {academicDetail && (
            <div className="space-y-4">
              {/* Conflict Callout if 409 */}
              {academicConflict && (
                <div className="card border-amber-300 bg-amber-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                    <div>
                      <div className="font-semibold text-amber-900">Academic Concurrency Conflict (HTTP 409)</div>
                      <p className="mt-1 text-xs text-amber-800">
                        The candidate modified their academic declaration or another administrator completed a review while this view was open.
                      </p>
                      <button
                        onClick={() => void fetchAcademicDetail(String(academicDetail.candidateId))}
                        className="btn-ghost btn-sm mt-3"
                      >
                        <RefreshCw className="h-3.5 w-3.5" /> Refresh Latest Data
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Candidate Academic Details */}
              <div className="card p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-navy-100 pb-4">
                  <div>
                    <div className="font-display text-lg font-bold text-ink">{academicDetail.candidateName}</div>
                    <div className="text-xs text-navy-500">
                      ID #{academicDetail.candidateId} · {academicDetail.candidateEmail}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-navy-400">Current Status:</span>
                    <Badge
                      tone={
                        academicDetail.finalYearStatus === 'VERIFIED_FINAL_YEAR'
                          ? 'green'
                          : academicDetail.finalYearStatus === 'CLAIMED_FINAL_YEAR'
                            ? 'amber'
                            : academicDetail.finalYearStatus === 'VERIFIED_NOT_FINAL_YEAR'
                              ? 'red'
                              : 'gray'
                      }
                      dot
                    >
                      {academicDetail.finalYearStatus}
                    </Badge>
                    <span className="rounded-md bg-navy-100 px-2 py-0.5 text-xs font-mono font-semibold text-navy-700">
                      v{academicDetail.version}
                    </span>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 text-xs sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-xl bg-navy-50/60 p-3.5">
                    <span className="font-semibold text-navy-500">Institution:</span>
                    <div className="mt-1 font-medium text-ink">{academicDetail.institutionName || 'Unstated'}</div>
                    <div className="text-[11px] text-navy-400">AISHE: {academicDetail.institutionAisheCode || 'N/A'}</div>
                  </div>
                  <div className="rounded-xl bg-navy-50/60 p-3.5">
                    <span className="font-semibold text-navy-500">Program & Enrollment:</span>
                    <div className="mt-1 font-medium text-ink">{academicDetail.degreeProgram || 'Unstated'}</div>
                    <div className="text-[11px] text-navy-400">Status: {academicDetail.enrollmentStatus}</div>
                  </div>
                  <div className="rounded-xl bg-navy-50/60 p-3.5">
                    <span className="font-semibold text-navy-500">Year & Completion:</span>
                    <div className="mt-1 font-medium text-ink">
                      Year {academicDetail.currentAcademicYear || '?'} of {academicDetail.programDurationYears || '?'}
                    </div>
                    <div className="text-[11px] text-navy-400">
                      Expected: {academicDetail.expectedCompletionDate || 'Not specified'}
                    </div>
                  </div>
                </div>

                {/* Supporting NOC context */}
                <div className="mt-4 rounded-xl border border-navy-100 p-3.5 text-xs">
                  <div className="font-semibold text-navy-700">Supporting Evidence Linkage:</div>
                  <div className="mt-1 text-navy-600">
                    {academicDetail.activeNocEvidenceId ? (
                      <span className="inline-flex items-center gap-2">
                        Active NOC Evidence ID: <strong>#{academicDetail.activeNocEvidenceId}</strong>
                        <Badge tone={academicDetail.activeNocStatus === 'VERIFIED' ? 'green' : 'amber'}>
                          {academicDetail.activeNocStatus}
                        </Badge>
                      </span>
                    ) : (
                      <span className="text-amber-700">
                        ⚠ No active institutional NOC on file for this candidate. Approval of final-year standing requires a valid NOC reference.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Review Decision Form */}
              <div className="card p-5">
                <SectionHeader
                  title="Authoritative Academic Verification Action"
                  sub="Select an administrative decision. Approving final-year standing requires a valid supporting evidence reference."
                />

                <div className="space-y-4">
                  {/* Decision Selector */}
                  <div>
                    <label className="label">Verification Decision</label>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3.5 text-xs font-semibold transition ${
                          academicDecision === 'APPROVE'
                            ? 'border-emerald-500 bg-emerald-50/60 text-emerald-900 ring-2 ring-emerald-200'
                            : 'border-navy-200 bg-white text-navy-700 hover:bg-navy-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="academicDecision"
                          value="APPROVE"
                          checked={academicDecision === 'APPROVE'}
                          onChange={() => setAcademicDecision('APPROVE')}
                          className="text-emerald-600"
                        />
                        <div>
                          <div>APPROVE</div>
                          <div className="text-[11px] font-normal text-emerald-700">Promotes to VERIFIED_FINAL_YEAR</div>
                        </div>
                      </label>

                      <label
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3.5 text-xs font-semibold transition ${
                          academicDecision === 'VERIFY_NOT_FINAL_YEAR'
                            ? 'border-sky-500 bg-sky-50/60 text-sky-900 ring-2 ring-sky-200'
                            : 'border-navy-200 bg-white text-navy-700 hover:bg-navy-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="academicDecision"
                          value="VERIFY_NOT_FINAL_YEAR"
                          checked={academicDecision === 'VERIFY_NOT_FINAL_YEAR'}
                          onChange={() => setAcademicDecision('VERIFY_NOT_FINAL_YEAR')}
                          className="text-sky-600"
                        />
                        <div>
                          <div>VERIFY NOT FINAL YEAR</div>
                          <div className="text-[11px] font-normal text-sky-700">e.g. Student is in 2nd year</div>
                        </div>
                      </label>

                      <label
                        className={`flex cursor-pointer items-center gap-2 rounded-xl border p-3.5 text-xs font-semibold transition ${
                          academicDecision === 'REJECT'
                            ? 'border-red-500 bg-red-50/60 text-red-900 ring-2 ring-red-200'
                            : 'border-navy-200 bg-white text-navy-700 hover:bg-navy-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name="academicDecision"
                          value="REJECT"
                          checked={academicDecision === 'REJECT'}
                          onChange={() => setAcademicDecision('REJECT')}
                          className="text-red-600"
                        />
                        <div>
                          <div>REJECT / RESET</div>
                          <div className="text-[11px] font-normal text-red-700">Resets status to UNKNOWN</div>
                        </div>
                      </label>
                    </div>
                  </div>

                  {/* Supporting Evidence ID */}
                  <div>
                    <label className="label">
                      Supporting NOC Evidence ID {academicDecision === 'APPROVE' && <span className="text-red-500">*</span>}
                    </label>
                    <input
                      className="input max-w-sm"
                      type="number"
                      placeholder="e.g. 10"
                      value={supportingEvidenceId}
                      onChange={(e) => setSupportingEvidenceId(e.target.value)}
                    />
                    <div className="mt-1 text-[11.5px] text-navy-400">
                      Must refer to a submitted or verified institutional NOC belonging to this candidate.
                    </div>
                  </div>

                  {/* Review Notes */}
                  <div>
                    <label className="label">
                      Reviewer Justification & Audit Notes <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      className="input min-h-[90px]"
                      placeholder="Explain basis for approval or rejection (e.g. Verified enrolled in B.Tech semester 8 against university records)…"
                      value={academicNotes}
                      onChange={(e) => setAcademicNotes(e.target.value)}
                      maxLength={1000}
                    />
                    <div className="mt-1 flex justify-between text-[11.5px] text-navy-400">
                      <span>Mandatory for audit trail and compliance ledger.</span>
                      <span>{academicNotes.length} / 1000</span>
                    </div>
                  </div>

                  {/* Concurrency Token Info */}
                  <div className="rounded-lg bg-navy-50 p-2.5 text-[11.5px] text-navy-600">
                    <span className="font-semibold">Optimistic Lock Check:</span> Submitting with Expected Version: <code>v{academicDetail.version}</code>.
                  </div>

                  {/* Submit Button */}
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => void handleAcademicReview()}
                      disabled={submittingAcademic || !academicNotes.trim()}
                      className="btn-primary"
                    >
                      <UserCheck className="h-4 w-4" />
                      {submittingAcademic ? 'Recording Review…' : 'Submit Authoritative Review'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
