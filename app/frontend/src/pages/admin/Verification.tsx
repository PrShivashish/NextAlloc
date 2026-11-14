import React, { useEffect, useState } from 'react';
import {
  FileText,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle,
  Download,
  RefreshCw,
  UserCheck,
  Search,
  GraduationCap,
  ArrowRight,
} from 'lucide-react';
import { apiGet, apiPost, apiDownload, errMsg } from '../../api/client';
import {
  NocReviewQueueItemDto,
  CandidateAcademicDetailDto,
  AcademicReviewResponseDto,
  AcademicReviewDecision,
  Page,
} from '../../api/types';
import {
  SectionHeader,
  Spinner,
  Callout,
  Badge,
  MetricBand,
  Modal,
  Disclosure,
  fmtNum,
  formatEnumLabel,
} from '../../components/ui';

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

  const fetchNocQueue = async () => {
    setLoadingNocs(true);
    setNocErr('');
    try {
      const data = await apiGet<Page<NocReviewQueueItemDto>>('/admin/evidence/noc/pending', {
        page: 0,
        size: 50,
      });
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

  const handleNocDecision = async () => {
    if (!selectedNoc || !nocAction) return;
    setSubmittingNoc(true);
    setNocErr('');
    setNocMsg('');
    try {
      const endpoint =
        nocAction === 'verify'
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

      setNocMsg(
        `NOC #${selectedNoc.id} for candidate ${selectedNoc.candidateName} successfully ${
          nocAction === 'verify'
            ? 'approved'
            : nocAction === 'reject'
              ? 'rejected'
              : 'marked for clarification'
        }.`
      );
      setSelectedNoc(null);
      setNocAction(null);
      setNocNotes('');
      await fetchNocQueue();
    } catch (e: any) {
      if (e.status === 409) {
        setNocErr(
          'Concurrency conflict (HTTP 409): This NOC was updated by another administrator or session. Reloading queue.'
        );
        await fetchNocQueue();
      } else {
        setNocErr(errMsg(e));
      }
    } finally {
      setSubmittingNoc(false);
    }
  };

  const fetchAcademicDetail = async (cId: string) => {
    if (!cId.trim()) return;
    setLoadingAcademic(true);
    setAcademicErr('');
    setAcademicMsg('');
    setAcademicConflict(false);
    try {
      const data = await apiGet<CandidateAcademicDetailDto>(
        `/admin/candidates/${cId.trim()}/academic`
      );
      setAcademicDetail(data);
      setSupportingEvidenceId(data.activeNocEvidenceId ? String(data.activeNocEvidenceId) : '');
      setAcademicDecision(
        data.finalYearStatus === 'CLAIMED_FINAL_YEAR' ? 'APPROVE' : 'VERIFY_NOT_FINAL_YEAR'
      );
    } catch (e: any) {
      setAcademicErr(errMsg(e));
      setAcademicDetail(null);
    } finally {
      setLoadingAcademic(false);
    }
  };

  const handleAcademicReview = async () => {
    if (!academicDetail) return;
    if (!academicNotes.trim()) {
      setAcademicErr('Reviewer notes are mandatory to provide audit transparency.');
      return;
    }
    if (academicDecision === 'APPROVE' && !supportingEvidenceId.trim()) {
      setAcademicErr(
        'Approving final-year standing requires a valid supporting NOC evidence reference.'
      );
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
        supportingEvidenceId: supportingEvidenceId.trim()
          ? Number(supportingEvidenceId.trim())
          : null,
        expectedVersion: academicDetail.version,
      };

      const result = await apiPost<AcademicReviewResponseDto>(
        `/admin/candidates/${academicDetail.candidateId}/academic/verify`,
        payload
      );

      setAcademicMsg(
        `Academic standing reviewed: Candidate ${result.candidateId} status is now ${result.finalYearStatus} (Version v${result.version}).`
      );
      setAcademicNotes('');
      await fetchAcademicDetail(String(academicDetail.candidateId));
    } catch (e: any) {
      if (e.status === 409) {
        setAcademicConflict(true);
        setAcademicErr(
          'Optimistic concurrency conflict (HTTP 409): Candidate updated their academic declaration or another administrator reviewed this record concurrently. Please refresh.'
        );
      } else {
        setAcademicErr(errMsg(e));
      }
    } finally {
      setSubmittingAcademic(false);
    }
  };

  const inspectCandidateAcademic = (cId: number) => {
    setCandidateIdInput(String(cId));
    setActiveTab('academic');
    void fetchAcademicDetail(String(cId));
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-[var(--na-border)] pb-5">
        <div>
          <h1 className="font-display text-[28px] font-semibold tracking-tight text-[var(--na-ink-primary)]">
            Verification & governance
          </h1>
          <p className="mt-1.5 max-w-2xl text-[15px] text-[var(--na-ink-secondary)]">
            Review institutional No Objection Certificates and candidate academic standing declarations.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            void fetchNocQueue();
            if (academicDetail) void fetchAcademicDetail(String(academicDetail.candidateId));
          }}
          className="btn-ghost btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" />
          Refresh
        </button>
      </div>

      <MetricBand
        items={[
          {
            label: 'Pending NOC submissions',
            value: loadingNocs ? '…' : fmtNum(nocQueue.length),
            sub: 'Uploaded certificates awaiting review',
            accent: nocQueue.length > 0,
          },
          {
            label: 'Conflict-free declarations',
            value: loadingNocs
              ? '…'
              : fmtNum(nocQueue.filter((item) => item.declaresNoAcademicConflict).length),
            sub: 'Within pending NOC queue',
          },
          {
            label: 'Claimed final-year',
            value: loadingNocs
              ? '…'
              : fmtNum(
                  nocQueue.filter((item) => item.academicFinalYearStatus === 'CLAIMED_FINAL_YEAR')
                    .length
                ),
            sub: 'Pending standing authorization',
          },
          {
            label: 'Loaded academic record',
            value: academicDetail ? `#${academicDetail.candidateId}` : 'None',
            sub: academicDetail
              ? formatEnumLabel(academicDetail.finalYearStatus)
              : 'Select from queue or ID lookup',
          },
        ]}
      />

      <div
        role="tablist"
        aria-label="Verification sections"
        className="flex flex-wrap gap-1 border-b border-[var(--na-border)]"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'noc'}
          onClick={() => setActiveTab('noc')}
          className={`flex min-h-[44px] items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-[14px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] active:opacity-80 disabled:opacity-50 ${
            activeTab === 'noc'
              ? 'border-[var(--na-accent)] text-[var(--na-ink-primary)]'
              : 'border-transparent text-[var(--na-ink-secondary)] hover:text-[var(--na-ink-primary)]'
          }`}
        >
          <FileText className="h-4 w-4" aria-hidden="true" />
          Institutional NOC queue
          {nocQueue.length > 0 && (
            <Badge tone="saffron">
              <span className="tabular-nums">{fmtNum(nocQueue.length)}</span>
            </Badge>
          )}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'academic'}
          onClick={() => setActiveTab('academic')}
          className={`flex min-h-[44px] items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-[14px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] active:opacity-80 disabled:opacity-50 ${
            activeTab === 'academic'
              ? 'border-[var(--na-accent)] text-[var(--na-ink-primary)]'
              : 'border-transparent text-[var(--na-ink-secondary)] hover:text-[var(--na-ink-primary)]'
          }`}
        >
          <GraduationCap className="h-4 w-4" aria-hidden="true" />
          Academic review
        </button>
      </div>

      {activeTab === 'noc' && (
        <div className="space-y-5">
          {nocErr && <Callout tone="danger">{nocErr}</Callout>}
          {nocMsg && <Callout tone="success">{nocMsg}</Callout>}

          <SectionHeader
            title="Pending institutional NOC reviews"
            sub="Review signed certificates uploaded by candidates. Verifying an NOC activates eligibility under institutional clearance rules."
          />

          {loadingNocs ? (
            <Spinner label="Loading pending NOC queue…" />
          ) : nocQueue.length === 0 ? (
            <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-10 text-center">
              <CheckCircle2
                className="mx-auto h-8 w-8 text-[var(--na-status-success-text)]"
                aria-hidden="true"
              />
              <div className="font-display mt-3 text-[16px] font-semibold text-[var(--na-ink-primary)]">
                No pending NOC submissions
              </div>
              <p className="mt-1 text-[14px] text-[var(--na-ink-secondary)]">
                All submitted institutional No Objection Certificates have been reviewed.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {nocQueue.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <h3 className="font-display text-[17px] font-semibold text-[var(--na-ink-primary)]">
                          {item.candidateName}
                        </h3>
                        <span className="tabular-nums text-[13px] text-[var(--na-ink-secondary)]">
                          ID #{item.candidateId}
                        </span>
                        <Badge tone="amber">SUBMITTED (v{item.version})</Badge>
                      </div>
                      <div className="flex flex-wrap gap-4 text-[13px] text-[var(--na-ink-secondary)]">
                        <span>{item.candidateEmail}</span>
                        <span className="tabular-nums">{item.candidatePhone}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleDownloadNoc(item)}
                        className="btn-ghost btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                        title="Download uploaded PDF document"
                      >
                        <Download className="h-3.5 w-3.5" aria-hidden="true" />
                        Download PDF
                      </button>
                      <button
                        type="button"
                        onClick={() => inspectCandidateAcademic(item.candidateId)}
                        className="btn-ghost btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                        title="Open candidate academic review"
                      >
                        <GraduationCap className="h-3.5 w-3.5" aria-hidden="true" />
                        Academic review
                        <ArrowRight className="h-3 w-3" aria-hidden="true" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 rounded-[var(--na-radius-md)] bg-[var(--na-well)] p-4 text-[13px] sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <div className="text-[12px] font-medium text-[var(--na-ink-secondary)]">
                        Issuing institution
                      </div>
                      <div className="mt-0.5 font-medium text-[var(--na-ink-primary)]">
                        {item.issuingInstitution}
                      </div>
                    </div>
                    <div>
                      <div className="text-[12px] font-medium text-[var(--na-ink-secondary)]">
                        Signatory
                      </div>
                      <div className="mt-0.5 font-medium text-[var(--na-ink-primary)]">
                        {item.signatoryName} ({formatEnumLabel(item.signatoryRole)})
                      </div>
                      <div className="text-[12px] text-[var(--na-ink-secondary)]">
                        {item.signatoryEmail}
                      </div>
                    </div>
                    <div>
                      <div className="text-[12px] font-medium text-[var(--na-ink-secondary)]">
                        Validity window
                      </div>
                      <div className="tabular-nums mt-0.5 font-medium text-[var(--na-ink-primary)]">
                        {item.validFrom || '—'} to {item.validUntil || '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-[12px] font-medium text-[var(--na-ink-secondary)]">
                        Conflict declaration
                      </div>
                      <div
                        className={`mt-0.5 font-medium ${
                          item.declaresNoAcademicConflict
                            ? 'text-[var(--na-status-success-text)]'
                            : 'text-[var(--na-status-error-text)]'
                        }`}
                      >
                        {item.declaresNoAcademicConflict
                          ? 'No conflict certified'
                          : 'Conflict declared'}
                      </div>
                    </div>
                  </div>

                  {item.signatoryValidationWarning && (
                    <div className="mt-3">
                      <Callout tone="warn" title="Signatory advisory">
                        {item.signatoryValidationWarning}
                      </Callout>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-[var(--na-border)] pt-3 text-[13px] text-[var(--na-ink-secondary)]">
                    <span className="font-medium text-[var(--na-ink-primary)]">
                      Academic context:
                    </span>
                    <span>{item.academicDegreeProgram || 'Program unspecified'}</span>
                    <span>{item.academicInstitutionName || 'Institution unstated'}</span>
                    <span className="tabular-nums">
                      Year {item.currentAcademicYear || '?'} of {item.programDurationYears || '?'}
                    </span>
                    <Badge
                      tone={
                        item.academicFinalYearStatus === 'CLAIMED_FINAL_YEAR' ? 'amber' : 'navy'
                      }
                    >
                      {formatEnumLabel(item.academicFinalYearStatus || 'UNKNOWN')}
                    </Badge>
                  </div>

                  <div className="mt-3">
                    <Disclosure label="Document verification metadata">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[12px] text-[var(--na-ink-secondary)]">
                          SHA-256 document digest
                        </span>
                        <span className="na-mono text-[var(--na-ink-primary)]">
                          {item.documentSha256 || '—'}
                        </span>
                      </div>
                    </Disclosure>
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-end gap-2 border-t border-[var(--na-border)] pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNoc(item);
                        setNocAction('clarify');
                        setNocNotes('');
                      }}
                      className="btn-ghost btn-sm text-[var(--na-status-warning-text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                    >
                      <HelpCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Request clarification
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNoc(item);
                        setNocAction('reject');
                        setNocNotes('');
                      }}
                      className="btn-danger btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                    >
                      <XCircle className="h-3.5 w-3.5" aria-hidden="true" />
                      Reject NOC
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedNoc(item);
                        setNocAction('verify');
                        setNocNotes(
                          'Approved after verifying institutional signatory and validity dates.'
                        );
                      }}
                      className="btn-primary btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Approve NOC
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}

          <Modal
            open={!!(selectedNoc && nocAction)}
            onClose={() => {
              setSelectedNoc(null);
              setNocAction(null);
            }}
            title={
              nocAction === 'verify'
                ? 'Approve institutional NOC'
                : nocAction === 'reject'
                  ? 'Reject institutional NOC'
                  : 'Request NOC clarification'
            }
          >
            {selectedNoc && nocAction && (
              <div className="space-y-4">
                <p className="tabular-nums text-[13px] text-[var(--na-ink-secondary)]">
                  Candidate: {selectedNoc.candidateName} (ID #{selectedNoc.candidateId}), NOC #
                  {selectedNoc.id} (v{selectedNoc.version})
                </p>

                {nocAction === 'reject' && (
                  <div>
                    <label htmlFor="noc-reject-reason" className="label">
                      Rejection reason code
                    </label>
                    <select
                      id="noc-reject-reason"
                      className="input"
                      value={nocReasonCode}
                      onChange={(e) => setNocReasonCode(e.target.value)}
                    >
                      <option value="INSTITUTIONAL_NOC_REJECTED">
                        INSTITUTIONAL_NOC_REJECTED: Non-compliant document
                      </option>
                      <option value="INSTITUTIONAL_NOC_EXPIRED">
                        INSTITUTIONAL_NOC_EXPIRED: Validity window elapsed
                      </option>
                      <option value="UNAUTHORIZED_NOC_SIGNATORY">
                        UNAUTHORIZED_NOC_SIGNATORY: Signatory unauthorized
                      </option>
                      <option value="NOC_ACADEMIC_CONFLICT_DECLARED">
                        NOC_ACADEMIC_CONFLICT_DECLARED: Academic conflict present
                      </option>
                    </select>
                  </div>
                )}

                <div>
                  <label htmlFor="noc-review-notes" className="label">
                    {nocAction === 'verify'
                      ? 'Review notes (optional)'
                      : 'Review notes / feedback (required)'}
                  </label>
                  <textarea
                    id="noc-review-notes"
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

                <div className="rounded-[var(--na-radius-md)] bg-[var(--na-well)] p-3 text-[12px] text-[var(--na-ink-secondary)]">
                  Optimistic lock check: submitting with expected version{' '}
                  <code className="na-mono text-[var(--na-ink-primary)]">
                    v{selectedNoc.version}
                  </code>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedNoc(null);
                      setNocAction(null);
                    }}
                    className="btn-ghost btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                    disabled={submittingNoc}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleNocDecision()}
                    disabled={submittingNoc || (nocAction !== 'verify' && !nocNotes.trim())}
                    className={`btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)] ${
                      nocAction === 'verify'
                        ? 'btn-primary'
                        : nocAction === 'reject'
                          ? 'btn-danger'
                          : 'btn-dark'
                    }`}
                  >
                    {submittingNoc
                      ? 'Submitting…'
                      : nocAction === 'verify'
                        ? 'Confirm approval'
                        : nocAction === 'reject'
                          ? 'Confirm rejection'
                          : 'Send clarification request'}
                  </button>
                </div>
              </div>
            )}
          </Modal>
        </div>
      )}

      {activeTab === 'academic' && (
        <div className="space-y-5">
          {academicErr && <Callout tone="danger">{academicErr}</Callout>}
          {academicMsg && <Callout tone="success">{academicMsg}</Callout>}

          <SectionHeader
            title="Candidate academic review & status authorization"
            sub="Review candidate-declared enrollment data against supporting evidence. Authorizing final-year standing enables allocation into final-year positions."
          />

          <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
            <label htmlFor="inspect-candidate-id" className="label">
              Inspect candidate by ID
            </label>
            <div className="flex flex-wrap gap-2">
              <input
                id="inspect-candidate-id"
                className="input max-w-xs tabular-nums"
                type="number"
                placeholder="Candidate ID (e.g. 101)…"
                value={candidateIdInput}
                onChange={(e) => setCandidateIdInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && void fetchAcademicDetail(candidateIdInput)}
              />
              <button
                type="button"
                onClick={() => void fetchAcademicDetail(candidateIdInput)}
                disabled={loadingAcademic || !candidateIdInput.trim()}
                className="btn-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
                {loadingAcademic ? 'Loading…' : 'Inspect academic profile'}
              </button>
            </div>
          </div>

          {academicDetail && (
            <div className="space-y-5">
              {academicConflict && (
                <Callout tone="warn" title="Academic concurrency conflict (HTTP 409)">
                  <span>
                    The candidate modified their academic declaration or another administrator
                    completed a review while this view was open.
                  </span>
                  <div className="mt-3">
                    <button
                      type="button"
                      onClick={() => void fetchAcademicDetail(String(academicDetail.candidateId))}
                      className="btn-ghost btn-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      Refresh latest data
                    </button>
                  </div>
                </Callout>
              )}

              <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--na-border)] pb-4">
                  <div>
                    <h3 className="font-display text-[18px] font-semibold text-[var(--na-ink-primary)]">
                      {academicDetail.candidateName}
                    </h3>
                    <div className="mt-0.5 flex flex-wrap gap-3 text-[13px] text-[var(--na-ink-secondary)]">
                      <span className="tabular-nums">ID #{academicDetail.candidateId}</span>
                      <span>{academicDetail.candidateEmail}</span>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] text-[var(--na-ink-secondary)]">
                      Current status:
                    </span>
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
                    >
                      {formatEnumLabel(academicDetail.finalYearStatus)}
                    </Badge>
                    <Badge tone="navy">
                      <span className="na-mono">v{academicDetail.version}</span>
                    </Badge>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 text-[13px] sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-[var(--na-radius-md)] bg-[var(--na-well)] p-3.5">
                    <div className="text-[12px] font-medium text-[var(--na-ink-secondary)]">
                      Institution
                    </div>
                    <div className="mt-1 font-medium text-[var(--na-ink-primary)]">
                      {academicDetail.institutionName || 'Unstated'}
                    </div>
                    <div className="tabular-nums text-[12px] text-[var(--na-ink-secondary)]">
                      AISHE: {academicDetail.institutionAisheCode || 'N/A'}
                    </div>
                  </div>
                  <div className="rounded-[var(--na-radius-md)] bg-[var(--na-well)] p-3.5">
                    <div className="text-[12px] font-medium text-[var(--na-ink-secondary)]">
                      Program & enrollment
                    </div>
                    <div className="mt-1 font-medium text-[var(--na-ink-primary)]">
                      {academicDetail.degreeProgram || 'Unstated'}
                    </div>
                    <div className="text-[12px] text-[var(--na-ink-secondary)]">
                      Status: {formatEnumLabel(academicDetail.enrollmentStatus)}
                    </div>
                  </div>
                  <div className="rounded-[var(--na-radius-md)] bg-[var(--na-well)] p-3.5">
                    <div className="text-[12px] font-medium text-[var(--na-ink-secondary)]">
                      Year & completion
                    </div>
                    <div className="tabular-nums mt-1 font-medium text-[var(--na-ink-primary)]">
                      Year {academicDetail.currentAcademicYear || '?'} of{' '}
                      {academicDetail.programDurationYears || '?'}
                    </div>
                    <div className="tabular-nums text-[12px] text-[var(--na-ink-secondary)]">
                      Expected: {academicDetail.expectedCompletionDate || 'Not specified'}
                    </div>
                  </div>
                </div>

                <div className="mt-4 border-t border-[var(--na-border)] pt-3.5 text-[13px]">
                  <div className="font-medium text-[var(--na-ink-primary)]">
                    Supporting evidence linkage
                  </div>
                  <div className="mt-1 text-[var(--na-ink-secondary)]">
                    {academicDetail.activeNocEvidenceId ? (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        <span>
                          Active NOC Evidence ID:{' '}
                          <strong className="tabular-nums font-semibold text-[var(--na-ink-primary)]">
                            #{academicDetail.activeNocEvidenceId}
                          </strong>
                        </span>
                        <Badge
                          tone={academicDetail.activeNocStatus === 'VERIFIED' ? 'green' : 'amber'}
                        >
                          {formatEnumLabel(academicDetail.activeNocStatus)}
                        </Badge>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[var(--na-status-warning-text)]">
                        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                        No active institutional NOC on file for this candidate. Approval of
                        final-year standing requires a valid NOC reference.
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-[var(--na-radius-lg)] border border-[var(--na-border)] bg-[var(--na-surface)] p-5">
                <SectionHeader
                  title="Authoritative academic verification action"
                  sub="Select an administrative decision. Approving final-year standing requires a valid supporting evidence reference."
                />

                <div className="space-y-5">
                  <div>
                    <div className="label">Verification decision</div>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <label
                        className={`flex cursor-pointer items-start gap-2.5 rounded-[var(--na-radius-md)] border p-3.5 text-[13px] transition-colors duration-150 ${
                          academicDecision === 'APPROVE'
                            ? 'border-[var(--na-status-success-text)] bg-[var(--na-status-success-bg)] text-[var(--na-status-success-text)]'
                            : 'border-[var(--na-border-strong)] bg-[var(--na-surface)] text-[var(--na-ink-primary)] hover:bg-[var(--na-well)]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="academicDecision"
                          value="APPROVE"
                          checked={academicDecision === 'APPROVE'}
                          onChange={() => setAcademicDecision('APPROVE')}
                          className="mt-0.5 accent-[var(--na-accent)]"
                        />
                        <div>
                          <div className="font-semibold">APPROVE</div>
                          <div className="mt-0.5 text-[12px] opacity-90">
                            Promotes to VERIFIED_FINAL_YEAR
                          </div>
                        </div>
                      </label>

                      <label
                        className={`flex cursor-pointer items-start gap-2.5 rounded-[var(--na-radius-md)] border p-3.5 text-[13px] transition-colors duration-150 ${
                          academicDecision === 'VERIFY_NOT_FINAL_YEAR'
                            ? 'border-[var(--na-status-info-text)] bg-[var(--na-status-info-bg)] text-[var(--na-status-info-text)]'
                            : 'border-[var(--na-border-strong)] bg-[var(--na-surface)] text-[var(--na-ink-primary)] hover:bg-[var(--na-well)]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="academicDecision"
                          value="VERIFY_NOT_FINAL_YEAR"
                          checked={academicDecision === 'VERIFY_NOT_FINAL_YEAR'}
                          onChange={() => setAcademicDecision('VERIFY_NOT_FINAL_YEAR')}
                          className="mt-0.5 accent-[var(--na-accent)]"
                        />
                        <div>
                          <div className="font-semibold">VERIFY NOT FINAL YEAR</div>
                          <div className="mt-0.5 text-[12px] opacity-90">
                            Sets standing to non-final year
                          </div>
                        </div>
                      </label>

                      <label
                        className={`flex cursor-pointer items-start gap-2.5 rounded-[var(--na-radius-md)] border p-3.5 text-[13px] transition-colors duration-150 ${
                          academicDecision === 'REJECT'
                            ? 'border-[var(--na-status-error-text)] bg-[var(--na-status-error-bg)] text-[var(--na-status-error-text)]'
                            : 'border-[var(--na-border-strong)] bg-[var(--na-surface)] text-[var(--na-ink-primary)] hover:bg-[var(--na-well)]'
                        }`}
                      >
                        <input
                          type="radio"
                          name="academicDecision"
                          value="REJECT"
                          checked={academicDecision === 'REJECT'}
                          onChange={() => setAcademicDecision('REJECT')}
                          className="mt-0.5 accent-[var(--na-accent)]"
                        />
                        <div>
                          <div className="font-semibold">REJECT / RESET</div>
                          <div className="mt-0.5 text-[12px] opacity-90">
                            Resets status to UNKNOWN
                          </div>
                        </div>
                      </label>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="supporting-evidence-id" className="label">
                      Supporting NOC evidence ID{' '}
                      {academicDecision === 'APPROVE' && (
                        <span className="text-[var(--na-status-error-text)]">*</span>
                      )}
                    </label>
                    <input
                      id="supporting-evidence-id"
                      className="input max-w-sm tabular-nums"
                      type="number"
                      placeholder="e.g. 10"
                      value={supportingEvidenceId}
                      onChange={(e) => setSupportingEvidenceId(e.target.value)}
                    />
                    <div className="mt-1 text-[12px] text-[var(--na-ink-secondary)]">
                      Must refer to a submitted or verified institutional NOC belonging to this
                      candidate.
                    </div>
                  </div>

                  <div>
                    <label htmlFor="academic-review-notes" className="label">
                      Reviewer justification & audit notes{' '}
                      <span className="text-[var(--na-status-error-text)]">*</span>
                    </label>
                    <textarea
                      id="academic-review-notes"
                      className="input min-h-[90px]"
                      placeholder="Explain basis for approval or rejection (e.g. Verified enrolled in B.Tech semester 8 against university records)…"
                      value={academicNotes}
                      onChange={(e) => setAcademicNotes(e.target.value)}
                      maxLength={1000}
                    />
                    <div className="mt-1 flex justify-between text-[12px] text-[var(--na-ink-secondary)]">
                      <span>Recorded in the audit trail.</span>
                      <span className="tabular-nums">{academicNotes.length} / 1000</span>
                    </div>
                  </div>

                  <div className="rounded-[var(--na-radius-md)] bg-[var(--na-well)] p-3 text-[12px] text-[var(--na-ink-secondary)]">
                    Optimistic lock check: submitting with expected version{' '}
                    <code className="na-mono text-[var(--na-ink-primary)]">
                      v{academicDetail.version}
                    </code>
                  </div>

                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => void handleAcademicReview()}
                      disabled={submittingAcademic || !academicNotes.trim()}
                      className="btn-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--na-accent)]"
                    >
                      <UserCheck className="h-4 w-4" aria-hidden="true" />
                      {submittingAcademic ? 'Recording review…' : 'Submit review'}
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
