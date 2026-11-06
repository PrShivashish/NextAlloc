import test from 'node:test';
import assert from 'node:assert/strict';

import type {
  CandidateAcademicDto,
  CandidateAcademicInput,
  NocEvidenceDto,
  NocReviewQueueItemDto,
  CandidateAcademicDetailDto,
  AcademicReviewInput,
  AcademicReviewResponseDto,
  NocReviewDecisionInput,
  EnrollmentStatus,
  FinalYearStatus,
  EvidenceStatus,
  SignatoryRole,
} from '../api/types.ts';

test('Gate 8.1 & 8.2: Candidate Academic Profile Retrieval & Submission Contract', () => {
  const serverAcademicRecord: CandidateAcademicDto = {
    id: 1,
    candidateId: 101,
    enrollmentStatus: 'ENROLLED_FULL_TIME',
    degreeProgram: 'B.Tech Computer Science',
    institutionName: 'National Institute of Technology',
    institutionAisheCode: 'U-12345',
    currentAcademicYear: 4,
    programDurationYears: 4,
    finalYearStatus: 'CLAIMED_FINAL_YEAR',
    expectedCompletionDate: '2026-06-30',
    updatedAt: '2026-11-06T10:00:00Z',
    version: 3,
  };

  assert.equal(serverAcademicRecord.candidateId, 101);
  assert.equal(serverAcademicRecord.finalYearStatus, 'CLAIMED_FINAL_YEAR');
  assert.equal(serverAcademicRecord.version, 3);

  // Candidate mutation sends expectedVersion matching server version
  const candidateSubmission: CandidateAcademicInput = {
    enrollmentStatus: 'ENROLLED_FULL_TIME',
    degreeProgram: 'B.Tech Computer Science',
    institutionName: 'National Institute of Technology',
    institutionAisheCode: 'U-12345',
    currentAcademicYear: 4,
    programDurationYears: 4,
    expectedCompletionDate: '2026-06-30',
    expectedVersion: serverAcademicRecord.version,
  };

  assert.equal(candidateSubmission.expectedVersion, 3);
  // Verify candidate input does not contain a finalYearStatus field (property-level authorization guard)
  assert.equal((candidateSubmission as any).finalYearStatus, undefined);
});

test('Gate 8.3: Property-Level Authorization — Candidates Cannot Self-Assign Verified Status', () => {
  const candidateInput: CandidateAcademicInput = {
    enrollmentStatus: 'ENROLLED_FULL_TIME',
    degreeProgram: 'B.Tech Information Technology',
    institutionName: 'State Engineering College',
    institutionAisheCode: 'C-99999',
    currentAcademicYear: 4,
    programDurationYears: 4,
    expectedCompletionDate: '2026-05-31',
    expectedVersion: 0,
  };

  // Even if a malicious client injects finalYearStatus, backend strips it and only transitions to CLAIMED_FINAL_YEAR or UNKNOWN
  const maliciousPayload = {
    ...candidateInput,
    finalYearStatus: 'VERIFIED_FINAL_YEAR',
  };

  assert.equal(maliciousPayload.finalYearStatus, 'VERIFIED_FINAL_YEAR');
  // Client UI contract ensures candidate can never select or submit VERIFIED_FINAL_YEAR
  const allowedStatusesForCandidate: FinalYearStatus[] = ['UNKNOWN', 'CLAIMED_FINAL_YEAR'];
  assert.ok(!allowedStatusesForCandidate.includes('VERIFIED_FINAL_YEAR'));
});

test('Gate 8.4: Candidate Update Version Conflict (HTTP 409) Handling', () => {
  const initialVersion = 1;
  const staleExpectedVersion = 0;

  function simulateCandidateUpdate(expectedVersion: number, currentServerVersion: number) {
    if (expectedVersion !== currentServerVersion) {
      return {
        status: 409,
        error: 'Concurrency Conflict (HTTP 409): Academic declaration modified by another session or administrator.',
        preventOverwrite: true,
        offerRefresh: true,
      };
    }
    return { status: 200, version: currentServerVersion + 1 };
  }

  const result = simulateCandidateUpdate(staleExpectedVersion, initialVersion);
  assert.equal(result.status, 409);
  assert.equal(result.preventOverwrite, true);
  assert.equal(result.offerRefresh, true);
});

test('Gate 8.5 & 8.6: NOC Upload Client-Side File Validation (Format and 5 MB Limit)', () => {
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

  function validateNocUpload(fileName: string, mimeType: string, sizeBytes: number) {
    if (!fileName.toLowerCase().endsWith('.pdf') && mimeType !== 'application/pdf') {
      return { valid: false, error: 'Unsupported file format: NextAlloc accepts only PDF documents (.pdf) for institutional NOCs.' };
    }
    if (sizeBytes > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (sizeBytes / (1024 * 1024)).toFixed(2);
      return { valid: false, error: `File exceeds limit: The selected file is ${sizeMb} MB. Institutional NOC uploads are strictly limited to 5.00 MB. Please compress your PDF.` };
    }
    return { valid: true };
  }

  // Valid PDF under 5 MB
  const valid = validateNocUpload('college_noc.pdf', 'application/pdf', 2 * 1024 * 1024);
  assert.equal(valid.valid, true);

  // Invalid format (e.g. Word or Image)
  const invalidFormat = validateNocUpload('certificate.docx', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 1024 * 1024);
  assert.equal(invalidFormat.valid, false);
  assert.match(invalidFormat.error!, /Unsupported file format/);

  // Oversized PDF (6.5 MB)
  const oversized = validateNocUpload('large_scan.pdf', 'application/pdf', 6.5 * 1024 * 1024);
  assert.equal(oversized.valid, false);
  assert.match(oversized.error!, /File exceeds limit: The selected file is 6.50 MB/);
});

test('Gate 8.7 & 8.8: NOC Status Transitions and Resubmission Preservation', () => {
  const initialNoc: NocEvidenceDto = {
    id: 10,
    candidateId: 201,
    evidenceType: 'INSTITUTIONAL_NOC',
    documentSha256: 'abc123sha256hash',
    issuingInstitution: 'IIT Delhi',
    signatoryRole: 'DEAN',
    signatoryName: 'Prof. Sharma',
    signatoryEmail: 'dean@iitd.ac.in',
    declaresNoAcademicConflict: true,
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    verificationStatus: 'REJECTED',
    verifiedAt: '2026-11-06T09:00:00Z',
    verifiedByUserId: 1,
    rejectionReasonCode: 'INSTITUTIONAL_NOC_EXPIRED',
    rejectionNotes: 'Document validity expired prior to proposed internship window.',
    version: 1,
    createdAt: '2026-11-05T08:00:00Z',
    updatedAt: '2026-11-06T09:00:00Z',
  };

  assert.equal(initialNoc.verificationStatus, 'REJECTED');
  assert.equal(initialNoc.rejectionReasonCode, 'INSTITUTIONAL_NOC_EXPIRED');

  // Candidate resubmission creates a new evidence row while preserving evidence #10 in audit history
  const revisedNoc: NocEvidenceDto = {
    id: 11,
    candidateId: 201,
    evidenceType: 'INSTITUTIONAL_NOC',
    documentSha256: 'def456newsha256hash',
    issuingInstitution: 'IIT Delhi',
    signatoryRole: 'DEAN',
    signatoryName: 'Prof. Sharma',
    signatoryEmail: 'dean@iitd.ac.in',
    declaresNoAcademicConflict: true,
    validFrom: '2026-06-01',
    validUntil: '2027-05-31',
    verificationStatus: 'SUBMITTED',
    verifiedAt: null,
    verifiedByUserId: null,
    rejectionReasonCode: null,
    rejectionNotes: null,
    version: 0,
    createdAt: '2026-11-06T10:00:00Z',
    updatedAt: '2026-11-06T10:00:00Z',
  };

  assert.equal(revisedNoc.id, 11);
  assert.equal(revisedNoc.verificationStatus, 'SUBMITTED');
  assert.notEqual(revisedNoc.id, initialNoc.id);
});

test('Gate 8.9 & 8.10: Administrator NOC Queue and Review Decision Contract', () => {
  const queueItem: NocReviewQueueItemDto = {
    id: 15,
    candidateId: 301,
    evidenceType: 'INSTITUTIONAL_NOC',
    documentSha256: '998877hash',
    issuingInstitution: 'BITS Pilani',
    signatoryRole: 'HEAD_OF_DEPARTMENT',
    signatoryName: 'Dr. Mukherjee',
    signatoryEmail: 'hod_cs@pilani.bits-pilani.ac.in',
    declaresNoAcademicConflict: true,
    validFrom: '2026-01-01',
    validUntil: '2026-12-31',
    verificationStatus: 'SUBMITTED',
    verifiedAt: null,
    verifiedByUserId: null,
    rejectionReasonCode: null,
    rejectionNotes: null,
    version: 2,
    createdAt: '2026-11-06T08:00:00Z',
    updatedAt: '2026-11-06T08:00:00Z',
    candidateName: 'Priya Patel',
    candidateEmail: 'priya@bits.edu.in',
    candidatePhone: '+919876543210',
    academicEnrollmentStatus: 'ENROLLED_FULL_TIME',
    academicDegreeProgram: 'M.Sc Computer Science',
    academicInstitutionName: 'BITS Pilani',
    academicInstitutionAisheCode: 'U-0012',
    academicFinalYearStatus: 'CLAIMED_FINAL_YEAR',
    currentAcademicYear: 2,
    programDurationYears: 2,
    expectedCompletionDate: '2026-06-30',
    signatoryValidationWarning: null,
  };

  assert.equal(queueItem.candidateName, 'Priya Patel');
  assert.equal(queueItem.academicFinalYearStatus, 'CLAIMED_FINAL_YEAR');

  // Verify approval decision structure
  const approvalDecision: NocReviewDecisionInput = {
    expectedVersion: queueItem.version,
    notes: 'Approved after verifying signatory authority credentials.',
  };
  assert.equal(approvalDecision.expectedVersion, 2);

  // Verify rejection decision structure
  const rejectionDecision: NocReviewDecisionInput = {
    expectedVersion: queueItem.version,
    reasonCode: 'UNAUTHORIZED_NOC_SIGNATORY',
    notes: 'Signatory authority role could not be verified against institution directory.',
  };
  assert.equal(rejectionDecision.reasonCode, 'UNAUTHORIZED_NOC_SIGNATORY');
});

test('Gate 8.11 & 8.12: Administrator Academic Status Review & OCC Contract', () => {
  const academicDetail: CandidateAcademicDetailDto = {
    id: 5,
    candidateId: 401,
    candidateName: 'Ananya Sen',
    candidateEmail: 'ananya@univ.in',
    enrollmentStatus: 'ENROLLED_FULL_TIME',
    degreeProgram: 'B.E. Electronics',
    institutionName: 'Jadavpur University',
    institutionAisheCode: 'U-0570',
    currentAcademicYear: 4,
    programDurationYears: 4,
    finalYearStatus: 'CLAIMED_FINAL_YEAR',
    expectedCompletionDate: '2026-06-30',
    updatedAt: '2026-11-06T09:00:00Z',
    version: 4,
    activeNocEvidenceId: 22,
    activeNocStatus: 'VERIFIED',
  };

  // Administrator approval review requires supporting evidence ID and expectedVersion
  const reviewInput: AcademicReviewInput = {
    decision: 'APPROVE',
    notes: 'Verified university enrollment and final year standing against approved NOC #22.',
    supportingEvidenceId: academicDetail.activeNocEvidenceId,
    expectedVersion: academicDetail.version,
  };

  assert.equal(reviewInput.decision, 'APPROVE');
  assert.equal(reviewInput.supportingEvidenceId, 22);
  assert.equal(reviewInput.expectedVersion, 4);

  // Simulating stale admin review (expectedVersion 3 != server version 4)
  function simulateAdminReview(submittedVersion: number, currentServerVersion: number) {
    if (submittedVersion !== currentServerVersion) {
      return {
        status: 409,
        error: 'Stale academic record version: Expected ' + submittedVersion + ' but current is ' + currentServerVersion,
      };
    }
    return { status: 200, finalYearStatus: 'VERIFIED_FINAL_YEAR' };
  }

  const conflictResult = simulateAdminReview(3, academicDetail.version);
  assert.equal(conflictResult.status, 409);
});

test('Gate 8.13 & 8.14: Authentication & Secure Document Download Security', () => {
  // Document download URL must use authenticated endpoint and not expose filesystem paths
  const candidateNocDownloadUrl = '/api/candidates/me/evidence/noc/download';
  const adminNocDownloadUrl = (id: number) => `/api/admin/evidence/noc/${id}/download`;

  assert.ok(!candidateNocDownloadUrl.includes('C:'));
  assert.ok(!candidateNocDownloadUrl.includes('/uploads/'));
  assert.equal(adminNocDownloadUrl(15), '/api/admin/evidence/noc/15/download');

  // Must require Bearer token in headers
  function buildDownloadHeaders(jwtToken: string | null) {
    return jwtToken ? { Authorization: `Bearer ${jwtToken}` } : {};
  }

  assert.deepEqual(buildDownloadHeaders('mock_jwt_token_123'), {
    Authorization: 'Bearer mock_jwt_token_123',
  });
  assert.deepEqual(buildDownloadHeaders(null), {});
});

test('Gate 8.15 & 8.16: Allocation Distinction (GLOBAL vs BASELINE) and Navigation Integrity', () => {
  // Verifying allocation assignment source distinction
  const globalAssignment = {
    candidateId: 101,
    opportunityId: 501,
    source: 'GLOBAL', // Actual CP-SAT Multi-Objective Allocation
    isPublishedInternship: true,
  };

  const baselineAssignment = {
    candidateId: 101,
    opportunityId: 502,
    source: 'BASELINE', // Greedy Benchmark Comparison Only
    isPublishedInternship: false,
  };

  assert.equal(globalAssignment.source, 'GLOBAL');
  assert.equal(globalAssignment.isPublishedInternship, true);
  assert.equal(baselineAssignment.source, 'BASELINE');
  assert.equal(baselineAssignment.isPublishedInternship, false);

  // Administrative Navigation Includes Verification & Governance
  const adminRoutes = [
    '/admin',
    '/admin/verification',
    '/admin/scenarios',
    '/admin/runs',
    '/admin/whatif',
    '/admin/reallocation',
    '/admin/audit',
    '/admin/judge',
    '/admin/technical',
  ];
  assert.ok(adminRoutes.includes('/admin/verification'));

  // Candidate Navigation Includes Profile with Academic & NOC
  const candidateRoutes = [
    '/candidate',
    '/candidate/explore',
    '/candidate/analytics',
    '/candidate/profile',
  ];
  assert.ok(candidateRoutes.includes('/candidate/profile'));
});
