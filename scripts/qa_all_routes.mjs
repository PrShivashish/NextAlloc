import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(new URL('../app/frontend/package.json', import.meta.url));
const { chromium } = require('playwright');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const OUT = process.env.SCREENSHOT_DIR || path.join(REPO_ROOT, '.stitch', 'redesign-final');
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.NEXTALLOC_UI_URL || 'http://127.0.0.1:5173';

// Fail-closed safety guard: prevent running against non-local or production endpoints
const parsedUrl = new URL(BASE);
if (!['localhost', '127.0.0.1', '::1'].includes(parsedUrl.hostname)) {
  console.error(`[SAFETY ERROR] Refusing to run screenshot suite against non-local target: ${BASE}`);
  process.exit(1);
}

const OPPS = [
  { id: 1, title: 'Backend Engineering Intern', provider: 'TCS Digital Systems', sector: 'Information Technology', state: 'Karnataka', city: 'Bengaluru', capacity: 4, durationMonths: 6, minQualification: 'B.Tech', status: 'ACTIVE', active: true, mandatorySkills: ['Java', 'SQL'], niceSkills: ['Spring Boot', 'Docker'], eligible: true, eligibilityReasons: ['Meets academic & final-year rules'], myPreferenceRank: 1, fitScore: 89.4, description: 'Core Java microservices and allocation engine integration.' },
  { id: 2, title: 'Cloud Platform Intern', provider: 'Infosys Cloud Labs', sector: 'Information Technology', state: 'Maharashtra', city: 'Pune', capacity: 3, durationMonths: 6, minQualification: 'B.Tech', status: 'ACTIVE', active: true, mandatorySkills: ['Python', 'REST APIs'], niceSkills: ['Docker', 'Kubernetes'], eligible: true, eligibilityReasons: ['Meets academic & final-year rules'], myPreferenceRank: 2, fitScore: 82.1, description: 'Automated telemetry and distributed compute clusters.' },
  { id: 3, title: 'Data Governance Intern', provider: 'NIC Analytics Cell', sector: 'Public Sector Tech', state: 'Delhi', city: 'New Delhi', capacity: 2, durationMonths: 6, minQualification: 'B.Tech', status: 'ACTIVE', active: true, mandatorySkills: ['SQL', 'Python'], niceSkills: ['Statistics'], eligible: false, eligibilityReasons: ['Missing district residency preference'], myPreferenceRank: null, fitScore: 68.5, description: 'National dataset verification and fairness auditing.' },
];

const RUN_14 = { id: 14, number: 14, code: 'RUN-014', scenario: 'SIH National Cohort', policyName: 'Balanced', status: 'COMPLETED', solverStatus: 'OPTIMAL', createdAt: '2026-11-12T10:30:00Z', completedAt: '2026-11-12T10:30:01Z', totalRuntimeMs: 842, stale: false, reallocation: false, parentRunNumber: null };
const RUN_13 = { id: 13, number: 13, code: 'RUN-013', scenario: 'SIH National Cohort', policyName: 'Merit-weighted', status: 'COMPLETED', solverStatus: 'OPTIMAL', createdAt: '2026-11-11T16:10:00Z', completedAt: '2026-11-11T16:10:01Z', totalRuntimeMs: 910, stale: true, reallocation: false, parentRunNumber: null };
const RUN_12 = { id: 12, number: 12, code: 'RUN-012', scenario: 'Regional Equity Test', policyName: 'Geography-first', status: 'COMPLETED', solverStatus: 'FEASIBLE', createdAt: '2026-11-10T11:45:00Z', completedAt: '2026-11-10T11:45:02Z', totalRuntimeMs: 1420, stale: false, reallocation: true, parentRunNumber: 11 };

const SCENARIO = { key: 'sih-default', name: 'SIH National Cohort', candidateCount: 1200, opportunityCount: 180, seatCount: 420, version: 3, fingerprint: 'a4c9f10b' };

const COMMON_FIXTURES = {
  '/api/opportunities': { content: OPPS, totalElements: 3, totalPages: 1 },
  '/api/opportunities/1': { card: OPPS[0], description: OPPS[0].description },
  '/api/opportunities/2': { card: OPPS[1], description: OPPS[1].description },
  '/api/opportunities/3': { card: OPPS[2], description: OPPS[2].description },
};

const CAND_FIXTURES = {
  ...COMMON_FIXTURES,
  '/api/auth/login': { token: 'demo-cand', user: { id: 101, email: 'candidate@nextalloc.in', name: 'Aarav Sharma', role: 'CANDIDATE' } },
  '/api/auth/me': { user: { id: 101, email: 'candidate@nextalloc.in', name: 'Aarav Sharma', role: 'CANDIDATE' } },
  '/api/candidates/me/allocation': {
    state: 'ALLOCATED', message: 'Allocated to Backend Engineering Intern',
    runId: 14, runNumber: 14, opportunityTitle: 'Backend Engineering Intern',
    sector: 'Information Technology', opportunityState: 'Karnataka',
    suitability: 89.4, preferenceRank: 1, runAt: '2026-11-12T10:30:00Z',
  },
  '/api/candidates/me/dashboard': {
    readiness: {
      overall: 85,
      items: [
        { key: 'academic', label: 'Academic declaration', maxScore: 30, earned: 30, status: 'COMPLETE', detail: 'Final-year B.Tech verified' },
        { key: 'skills', label: 'Skills & preferences', maxScore: 40, earned: 40, status: 'COMPLETE', detail: '8 skills indexed' },
        { key: 'noc', label: 'NOC evidence', maxScore: 30, earned: 15, status: 'PENDING', detail: 'Submitted for institutional review' },
      ],
    },
    nextActions: ['Review your received internship offer and confirm acceptance before deadline.'],
  },
  '/api/candidates/me/readiness': {
    overall: 85,
    items: [
      { key: 'academic', label: 'Academic declaration', maxScore: 30, earned: 30, status: 'COMPLETE', detail: 'Final-year B.Tech verified' },
      { key: 'skills', label: 'Skills & preferences', maxScore: 40, earned: 40, status: 'COMPLETE', detail: '8 skills indexed' },
      { key: 'noc', label: 'NOC evidence', maxScore: 30, earned: 15, status: 'PENDING', detail: 'Submitted for institutional review' },
    ],
  },
  '/api/candidates/me/allocation/history': [
    { runNumber: 14, opportunityTitle: 'Backend Engineering Intern', status: 'ALLOCATED', score: 89.4, at: '2026-11-12T10:30:00Z' },
  ],
  '/api/candidates/me/recommendations': {
    weightsSource: 'balanced',
    note: 'Suitability measures profile fit across weighted criteria.',
    items: [
      { rank: 1, overallScore: 89.4, eligible: true, strongestMatches: ['Java', 'Spring Boot', 'SQL'], topGap: null, preferenceRank: 1, reason: 'Strong overlap with backend requirements', opportunity: OPPS[0] },
      { rank: 2, overallScore: 82.1, eligible: true, strongestMatches: ['Python', 'REST APIs'], topGap: 'Docker', preferenceRank: 2, reason: 'Solid systems background', opportunity: OPPS[1] },
    ],
  },
  '/api/candidates/me/profile': {
    fullName: 'Aarav Sharma', email: 'candidate@nextalloc.in', phone: '+91-98450-11223', dob: '2005-04-12',
    state: 'Karnataka', district: 'Bengaluru Urban', locationType: 'URBAN', qualification: 'B.Tech',
    candidateStatus: 'FINAL_YEAR_STUDENT', experienceYears: 1, ruralArea: false, active: true,
    skills: [{ canonical: 'Java' }, { canonical: 'Spring Boot' }, { canonical: 'SQL' }, { canonical: 'Python' }, { canonical: 'REST APIs' }],
    interests: ['Backend Systems', 'Distributed Computing'],
    bio: 'Final-year CS undergraduate focusing on constraint optimization and Java backend services.',
  },
  '/api/candidates/me/preferences': [
    { rank: 1, opportunityId: 1, opportunityTitle: 'Backend Engineering Intern' },
    { rank: 2, opportunityId: 2, opportunityTitle: 'Cloud Platform Intern' },
  ],
  '/api/candidates/me/resume': { uploaded: true, fileName: 'Aarav_Sharma_Resume.pdf', uploadedAt: '2026-11-08T12:00:00Z', status: 'PARSED' },
  '/api/candidates/me/resume/suggestions': {
    resumeId: 7, status: 'READY', statusMessage: 'Extracted 3 structured skills from resume.',
    fields: [{ field: 'qualification', value: 'B.Tech', confidence: 'HIGH', evidence: 'Header degree summary' }],
    skills: ['PostgreSQL', 'Docker', 'JUnit'], interests: ['Cloud Native'],
  },
  '/api/candidates/me/related-skills': [
    { id: 11, raw: 'Spring Boot', rawLabel: 'Spring Boot', conceptId: 'esco:spring-boot', relatedCanonical: 'Java Enterprise Framework', relationshipType: 'SPECIALIZATION', evidenceStatus: 'CONFIRMED' },
  ],
  '/api/candidates/me/academic': {
    id: 21, candidateId: 101, enrollmentStatus: 'ENROLLED_FULL_TIME', degreeProgram: 'B.Tech Computer Science',
    institutionName: 'NIT Karnataka', institutionAisheCode: 'U-0234', currentAcademicYear: 4, programDurationYears: 4,
    finalYearStatus: 'VERIFIED_FINAL_YEAR', expectedCompletionDate: '2027-05-30', updatedAt: '2026-11-05T10:00:00Z', version: 2,
  },
  '/api/candidates/me/evidence/noc': {
    id: 31, candidateId: 101, evidenceType: 'INSTITUTIONAL_NOC', documentSha256: 'e3b0c44298fc1c149afbf4c8996fb924',
    issuingInstitution: 'NIT Karnataka', signatoryRole: 'HEAD_OF_DEPARTMENT', signatoryName: 'Dr. Ramesh Kulkarni',
    signatoryEmail: 'hod.cse@nitk.edu.in', declaresNoAcademicConflict: true, validFrom: '2026-11-01', validUntil: '2027-06-30',
    verificationStatus: 'SUBMITTED', verifiedAt: null, verifiedByUserId: null, rejectionReasonCode: null, rejectionNotes: null,
    version: 1, createdAt: '2026-11-10T09:15:00Z', updatedAt: '2026-11-10T09:15:00Z',
  },
  '/api/candidates/me/offers': [
    { id: 501, runId: 14, opportunityId: 1, opportunityTitle: 'Backend Engineering Intern', providerName: 'TCS Digital Systems', sector: 'Information Technology', state: 'Karnataka', city: 'Bengaluru', capacity: 4, durationMonths: 6, status: 'OFFERED', offeredAt: '2026-11-12T10:35:00Z' },
  ],
  '/api/candidates/me/analytics/opportunity/1': {
    opportunity: OPPS[0], eligible: true, eligibilityReasons: ['All hard gates satisfied'], overallScore: 89.4, possibleScore: 100, lostPoints: 10.6,
    recommendationLabel: 'Strong Fit', weightsSource: 'balanced',
    factors: [
      { key: 'mandatory_skills', label: 'Mandatory skills', fit: 100, weight: 45, contribution: 45, lostPoints: 0, explanation: 'Matches Java & SQL' },
      { key: 'preferred_skills', label: 'Preferred skills', fit: 78, weight: 25, contribution: 19.5, lostPoints: 5.5, explanation: 'Matches Spring Boot; missing Docker evidence' },
      { key: 'geography', label: 'Location alignment', fit: 95, weight: 15, contribution: 14.3, lostPoints: 0.7, explanation: 'Karnataka home cluster' },
      { key: 'academic', label: 'Academic readiness', fit: 88, weight: 15, contribution: 10.6, lostPoints: 4.4, explanation: 'Final-year verified' },
    ],
    strongestMatches: ['Java', 'SQL', 'Spring Boot'], topGaps: ['Docker'], preferenceRank: 1,
  },
  '/api/candidates/me/skill-gap/1': {
    opportunity: OPPS[0], eligible: true, coveredSkills: ['Java', 'SQL', 'Spring Boot'], mandatoryGaps: [], preferredGaps: ['Docker'],
    readinessPercent: 89, assistantSummary: 'Mandatory core is 100% covered. Adding containerization lab proof would raise score by ~5 points.',
  },
};

const PROV_FIXTURES = {
  ...COMMON_FIXTURES,
  '/api/auth/login': { token: 'demo-prov', user: { id: 201, email: 'provider@nextalloc.in', name: 'Meera Deshmukh', role: 'PROVIDER' } },
  '/api/auth/me': { user: { id: 201, email: 'provider@nextalloc.in', name: 'Meera Deshmukh', role: 'PROVIDER' } },
  '/api/providers/me': {
    id: 201, orgName: 'TCS Digital Systems', orgType: 'Technology Partner', state: 'Karnataka',
    about: 'National campus & SIH industrial internship host across distributed cloud and Java platforms.',
    opportunityCount: 2, activeCount: 2, totalSeats: 7,
  },
  '/api/providers/me/impact': [
    { opportunityId: 1, title: 'Backend Engineering Intern', capacity: 4, allocated: 4, unmetDemand: 18, avgSuitability: 88.6 },
    { opportunityId: 2, title: 'Cloud Platform Intern', capacity: 3, allocated: 3, unmetDemand: 9, avgSuitability: 84.1 },
  ],
  '/api/providers/me/capacity': [
    { opportunityId: 1, title: 'Backend Engineering Intern', capacity: 4, eligible: 22, pressure: 5.5 },
    { opportunityId: 2, title: 'Cloud Platform Intern', capacity: 3, eligible: 12, pressure: 4.0 },
  ],
  '/api/providers/me/opportunities': {
    content: [
      { id: 1, title: 'Backend Engineering Intern', sector: 'Information Technology', state: 'Karnataka', city: 'Bengaluru', capacity: 4, durationMonths: 6, minQualification: 'B.Tech', status: 'ACTIVE', mandatorySkills: ['Java', 'SQL'], niceSkills: ['Spring Boot'], allocatedCount: 4, avgSuitability: 88.6 },
      { id: 2, title: 'Cloud Platform Intern', sector: 'Information Technology', state: 'Maharashtra', city: 'Pune', capacity: 3, durationMonths: 6, minQualification: 'B.Tech', status: 'ACTIVE', mandatorySkills: ['Python', 'REST APIs'], niceSkills: ['Docker'], allocatedCount: 3, avgSuitability: 84.1 },
    ],
    totalElements: 2, totalPages: 1,
  },
  '/api/providers/me/opportunities/1/offers': [
    { id: 501, runId: 14, candidateId: 101, candidateName: 'Aarav Sharma', qualification: 'B.Tech CS', status: 'OFFERED', offeredAt: '2026-11-12T10:35:00Z', respondedAt: null, joinedAt: null },
    { id: 502, runId: 14, candidateId: 102, candidateName: 'Ananya Verma', qualification: 'B.Tech IT', status: 'ACCEPTED', offeredAt: '2026-11-12T10:35:00Z', respondedAt: '2026-11-12T11:20:00Z', joinedAt: null },
    { id: 504, runId: 14, candidateId: 104, candidateName: 'Pooja Iyer', qualification: 'B.Tech CS', status: 'JOINED', offeredAt: '2026-11-12T10:35:00Z', respondedAt: '2026-11-12T11:00:00Z', joinedAt: '2026-11-12T14:00:00Z' },
  ],
  '/api/providers/me/opportunities/2/offers': [
    { id: 503, runId: 14, candidateId: 103, candidateName: 'Rohan Kulkarni', qualification: 'B.Tech CS', status: 'OFFERED', offeredAt: '2026-11-12T10:35:00Z', respondedAt: null, joinedAt: null },
  ],
};

const ADMIN_FIXTURES = {
  ...COMMON_FIXTURES,
  '/api/auth/login': { token: 'demo-admin', user: { id: 1, email: 'admin@nextalloc.in', name: 'Priya Nair', role: 'ADMIN' } },
  '/api/auth/me': { user: { id: 1, email: 'admin@nextalloc.in', name: 'Priya Nair', role: 'ADMIN' } },
  '/api/admin/overview': {
    scenario: SCENARIO,
    readiness: { ready: 912, partial: 198, incomplete: 90, average: 84.6 },
    allocation: { allocated: 398, unallocated: 802, totalCandidates: 1200, seatUtilization: 94.8, avgSuitability: 86.2, preferenceSatisfaction: 79.5, runNumber: 14 },
    latestRun: {
      id: 14, number: 14, code: 'RUN-014', status: 'COMPLETED', solverStatus: 'OPTIMAL', scenario: 'SIH National Cohort', createdAt: '2026-11-12T10:30:00Z', totalRuntimeMs: 842,
      stages: [
        { stage: 'Eligibility gate', at: '2026-11-12T10:30:00Z', ms: 112 },
        { stage: 'Suitability scoring', at: '2026-11-12T10:30:00Z', ms: 245 },
        { stage: 'Global optimization', at: '2026-11-12T10:30:01Z', ms: 485 },
      ],
    },
    aiMode: 'Hybrid semantic + CP-SAT',
  },
  '/api/admin/runs': { content: [RUN_14, RUN_13, RUN_12], totalElements: 3, totalPages: 1 },
  '/api/admin/runs/14': {
    run: RUN_14, dataset: SCENARIO, infeasibleMessage: null,
    stages: [
      { stage: 'Eligibility gate', at: '2026-11-12T10:30:00Z', ms: 112 },
      { stage: 'Suitability scoring', at: '2026-11-12T10:30:00Z', ms: 245 },
      { stage: 'Global optimization', at: '2026-11-12T10:30:01Z', ms: 485 },
    ],
    provenance: {
      runId: 'RUN-014', runNumber: 14, scenario: 'SIH National Cohort', datasetVersion: 'v3', datasetFingerprint: 'a4c9f10b',
      candidates: 1200, opportunities: 180, seats: 420, seed: 42, policyName: 'Balanced', policyKey: 'balanced',
      policyVersion: '1.2', weights: { skill: 0.45, preference: 0.25, location: 0.15, equity: 0.15 }, optimizer: 'OR-Tools CP-SAT',
      solverStatus: 'OPTIMAL', objective: 34890, variables: 18420, constraints: 2680, solverRuntimeMs: 485, totalRuntimeMs: 842, workers: 8, solverSeed: 42,
    },
  },
  '/api/admin/runs/14/comparison': {
    globalAllocated: 398, baselineAllocated: 342, globalSuitability: 86.2, baselineSuitability: 79.4,
    globalPreferenceSatisfaction: 79.5, baselinePreferenceSatisfaction: 68.1, seatUtilization: 94.8,
    globalObjective: 34890, baselineObjective: 28110, globalSolverSeconds: 0.49,
    summary: 'CP-SAT recovers 56 additional valid placements over greedy assignment while boosting rank-1/rank-2 preference fulfillment by 11.4 percentage points.',
  },
  '/api/admin/runs/14/fairness': {
    ruralUrban: [
      { groupValue: 'Rural / Aspirational', population: 410, allocated: 142, rate: 34.6, avgSuitability: 84.9, preferenceSatisfaction: 77.2 },
      { groupValue: 'Urban / Metro', population: 790, allocated: 256, rate: 32.4, avgSuitability: 86.9, preferenceSatisfaction: 80.8 },
    ],
    states: [
      { groupValue: 'Karnataka', population: 240, allocated: 84, rate: 35.0, avgSuitability: 87.2, preferenceSatisfaction: 81.4 },
      { groupValue: 'Maharashtra', population: 220, allocated: 76, rate: 34.5, avgSuitability: 86.4, preferenceSatisfaction: 79.1 },
      { groupValue: 'Bihar', population: 145, allocated: 48, rate: 33.1, avgSuitability: 84.1, preferenceSatisfaction: 76.8 },
    ],
  },
  '/api/admin/runs/14/geography': {
    states: [
      { state: 'Karnataka', demand: 240, capacity: 90, allocated: 84, unmetDemand: 156, pressure: 2.67, allocationRate: 93.3 },
      { state: 'Maharashtra', demand: 220, capacity: 80, allocated: 76, unmetDemand: 144, pressure: 2.75, allocationRate: 95.0 },
      { state: 'Delhi', demand: 190, capacity: 60, allocated: 58, unmetDemand: 132, pressure: 3.17, allocationRate: 96.7 },
    ],
  },
  '/api/admin/runs/14/why/assigned': [
    { candidateId: 101, candidateName: 'Aarav Sharma', opportunityId: 1, opportunityTitle: 'Backend Engineering Intern', sector: 'Information Technology', state: 'Karnataka', suitability: 89.4, factors: [{ key: 'skill', label: 'Skill fit', fit: 92, weight: 0.45, contribution: 41.4 }, { key: 'pref', label: 'Preference', fit: 100, weight: 0.25, contribution: 25.0 }], narrative: 'Strong skill alignment and top-preference placement.', reason: 'Top fit within seat constraints', eligibleCount: 4, seatCount: 4, preferenceRank: 1, runId: 14, runNumber: 14 },
  ],
  '/api/admin/runs/14/why/101': {
    candidateId: 101, candidateName: 'Aarav Sharma', opportunityId: 1, opportunityTitle: 'Backend Engineering Intern', sector: 'Information Technology', state: 'Karnataka', suitability: 89.4,
    factors: [{ key: 'skill', label: 'Skill fit', fit: 92, weight: 0.45, contribution: 41.4 }, { key: 'pref', label: 'Preference', fit: 100, weight: 0.25, contribution: 25.0 }],
    narrative: 'Strong skill alignment and top-preference placement.', reason: 'Top fit within seat constraints', eligibleCount: 4, seatCount: 4, preferenceRank: 1, runId: 14, runNumber: 14,
  },
  '/api/admin/runs/14/movements': [
    { candidateId: 101, candidateName: 'Aarav Sharma', before: 'Cloud Platform Intern', after: 'Backend Engineering Intern', beforeScore: 81.2, afterScore: 89.4, status: 'UPGRADED' },
  ],
  '/api/admin/runs/14/conflicts': [
    { opportunityId: 1, title: 'Backend Engineering Intern', eligible: 28, seats: 4, allocated: 4, unmetDemand: 24, pressure: 7.0 },
    { opportunityId: 2, title: 'Cloud Platform Intern', eligible: 15, seats: 3, allocated: 3, unmetDemand: 12, pressure: 5.0 },
  ],
  '/api/admin/runs/14/offers': [
    { id: 501, runId: 14, candidateId: 101, candidateName: 'Aarav Sharma', qualification: 'B.Tech CS', status: 'OFFERED', offeredAt: '2026-11-12T10:35:00Z' },
    { id: 502, runId: 14, candidateId: 102, candidateName: 'Ananya Verma', qualification: 'B.Tech IT', status: 'ACCEPTED', offeredAt: '2026-11-12T10:35:00Z', respondedAt: '2026-11-12T11:20:00Z' },
  ],
  '/api/admin/evidence/noc/pending': {
    content: [
      {
        id: 31, candidateId: 101, evidenceType: 'INSTITUTIONAL_NOC', documentSha256: 'e3b0c44298fc1c149afbf4c8996fb924',
        issuingInstitution: 'NIT Karnataka', signatoryRole: 'HEAD_OF_DEPARTMENT', signatoryName: 'Dr. Ramesh Kulkarni',
        signatoryEmail: 'hod.cse@nitk.edu.in', declaresNoAcademicConflict: true, validFrom: '2026-11-01', validUntil: '2027-06-30',
        verificationStatus: 'SUBMITTED', verifiedAt: null, verifiedByUserId: null, rejectionReasonCode: null, rejectionNotes: null,
        version: 1, createdAt: '2026-11-10T09:15:00Z', updatedAt: '2026-11-10T09:15:00Z',
        candidateName: 'Aarav Sharma', candidateEmail: 'aarav.sharma@nitk.edu.in', candidatePhone: '+91-98450-11223',
        academicEnrollmentStatus: 'ENROLLED_FULL_TIME', academicDegreeProgram: 'B.Tech Computer Science',
        academicInstitutionName: 'NIT Karnataka', academicInstitutionAisheCode: 'U-0234',
        academicFinalYearStatus: 'CLAIMED_FINAL_YEAR', currentAcademicYear: 4, programDurationYears: 4, expectedCompletionDate: '2027-05-30',
        signatoryValidationWarning: null,
      },
      {
        id: 32, candidateId: 104, evidenceType: 'INSTITUTIONAL_NOC', documentSha256: '9f86d081884c7d659a2feaa0c55ad015',
        issuingInstitution: 'COEP Technological University', signatoryRole: 'OTHER_UNRECOGNIZED', signatoryName: 'Prof. S. Joshi',
        signatoryEmail: 'sjoshi@gmail.com', declaresNoAcademicConflict: true, validFrom: '2026-11-01', validUntil: '2027-05-31',
        verificationStatus: 'SUBMITTED', verifiedAt: null, verifiedByUserId: null, rejectionReasonCode: null, rejectionNotes: null,
        version: 1, createdAt: '2026-11-11T14:20:00Z', updatedAt: '2026-11-11T14:20:00Z',
        candidateName: 'Kabir Mehta', candidateEmail: 'kabir.mehta@coep.ac.in', candidatePhone: '+91-98220-44556',
        academicEnrollmentStatus: 'ENROLLED_FULL_TIME', academicDegreeProgram: 'B.Tech Mechanical',
        academicInstitutionName: 'COEP Technological University', academicInstitutionAisheCode: 'U-0301',
        academicFinalYearStatus: 'CLAIMED_FINAL_YEAR', currentAcademicYear: 4, programDurationYears: 4, expectedCompletionDate: '2027-06-15',
        signatoryValidationWarning: 'Signatory role OTHER_UNRECOGNIZED & non-institutional email domain require manual oversight.',
      },
    ],
    totalElements: 2, totalPages: 1,
  },
  '/api/admin/candidates/101/academic': {
    id: 21, candidateId: 101, candidateName: 'Aarav Sharma', candidateEmail: 'aarav.sharma@nitk.edu.in',
    enrollmentStatus: 'ENROLLED_FULL_TIME', degreeProgram: 'B.Tech Computer Science', institutionName: 'NIT Karnataka',
    institutionAisheCode: 'U-0234', currentAcademicYear: 4, programDurationYears: 4, finalYearStatus: 'CLAIMED_FINAL_YEAR',
    expectedCompletionDate: '2027-05-30', updatedAt: '2026-11-05T10:00:00Z', version: 2, activeNocEvidenceId: 31, activeNocStatus: 'SUBMITTED',
  },
  '/api/admin/scenarios': [
    { key: 'sih-default', name: 'SIH National Cohort', description: 'Primary national demonstration dataset across 28 states and 180 verified host organizations.', active: true, lastLoadedAt: '2026-11-12T08:00:00Z' },
    { key: 'regional-equity', name: 'Regional Equity Stress Test', description: 'Heavy demand skew toward rural and aspirational districts to verify fairness bounds.', active: false, lastLoadedAt: '2026-11-10T11:30:00Z' },
  ],
  '/api/admin/policies': [
    { id: 1, key: 'balanced', name: 'Balanced National Policy', description: 'Balances skill merit, ranked preference, and state equity.', weightsJson: '{"skills":35,"qualification":15,"interest":15,"location":10,"preference":10,"learning":10,"experience":5}', fullCoverage: true, fairnessFloorPct: 30, isDefault: true, version: '1.2' },
    { id: 2, key: 'merit', name: 'Merit-First Priority', description: 'Maximizes skill suitability across top engineering cohorts.', weightsJson: '{"skills":50,"qualification":15,"interest":10,"location":5,"preference":10,"learning":5,"experience":5}', fullCoverage: false, fairnessFloorPct: 20, isDefault: false, version: '1.1' },
  ],
  '/api/admin/simulations': {
    content: [
      {
        id: 9, baseRunId: 14, policyName: 'Merit-First Priority', status: 'COMPLETED', solverStatus: 'OPTIMAL', createdAt: '2026-11-12T11:05:00Z', runtimeMs: 615, affected: 42, stability: 89.5,
        metricsJson: JSON.stringify({
          current: { allocated: 398, suitability: 86.2, preferenceSatisfaction: 79.5, seatUtilization: 94.8 },
          scenario: { allocated: 401, suitability: 88.1, preferenceSatisfaction: 77.2, seatUtilization: 95.5 },
          affected: 42,
          stability: 89.5,
        }),
      },
    ],
    totalElements: 1, totalPages: 1,
  },
  '/api/admin/audit': {
    content: [
      { id: 401, at: '2026-11-12T10:35:00Z', action: 'OFFERS_GENERATED', actor: 'priya.nair@nextalloc.in', summary: 'Dispatched 398 internship offers from Run #14', details: { runId: 14, count: 398 } },
      { id: 400, at: '2026-11-12T10:30:01Z', action: 'ALLOCATION_COMPLETED', actor: 'system-solver', summary: 'CP-SAT Run #14 reached OPTIMAL in 842 ms', details: { objective: 34890, status: 'OPTIMAL' } },
      { id: 399, at: '2026-11-12T09:15:12Z', action: 'NOC_VERIFIED', actor: 'priya.nair@nextalloc.in', summary: 'Verified institutional NOC #29 for NIT Trichy', details: { evidenceId: 29 } },
    ],
    totalElements: 3, totalPages: 1,
  },
  '/api/admin/judge/steps': [
    {
      n: 1,
      title: 'The Problem & National Ingestion',
      what: 'India needs a fair, defensible method to allocate limited internship capacity across large candidate populations respecting academic eligibility, capacity limits, and candidate preferences.',
      why: 'First-come-first-served systems systematically penalize candidates with slower connectivity and create severe misallocation.',
      data: { sihProblem: 'SIH25033 — AI Smart Allocation for Internship Scheme', candidatePool: 1200, totalCapacity: 420 },
      path: '/admin/scenarios',
    },
    {
      n: 2,
      title: 'Deterministic Eligibility Gating',
      what: 'Candidate academic standing and institutional NOC clearances are evaluated as hard boolean gates before scoring begins.',
      why: 'No candidate can be assigned to an internship if they lack verified enrollment or valid college clearance.',
      data: { verifiedFinalYearCount: 912, pendingReviewCount: 198, rejectedClearances: 12 },
      path: '/admin/verification',
    },
    {
      n: 3,
      title: 'Transparent Multi-Factor Scoring',
      what: 'Pairwise candidate-opportunity suitability is scored across validated skills, student preference rankings, and geographic alignment.',
      why: 'Weighted linear combinations provide full auditability for every scored placement pair without black-box opacity.',
      data: { skillWeight: '45%', preferenceWeight: '25%', locationWeight: '15%', academicWeight: '15%' },
      path: '/candidate/analytics',
    },
    {
      n: 4,
      title: 'Global CP-SAT Mathematical Optimization',
      what: 'Google OR-Tools CP-SAT integer programming optimizes placement across all 1,200 candidates simultaneously under hard seat constraints.',
      why: 'Global solving prevents early greedy matches from blocking globally superior allocations, maximizing aggregate social welfare.',
      data: { solverStatus: 'OPTIMAL', solveTimeMs: 485, variables: 18420, constraints: 2680 },
      path: '/admin/runs/14',
    },
    {
      n: 5,
      title: 'Counterfactual Sequential Baseline Comparison',
      what: 'Every global run is systematically benchmarked against an identical sequential greedy heuristic baseline.',
      why: 'Proves mathematical value-add: CP-SAT achieves higher seat fill, greater preference satisfaction, and superior average suitability.',
      data: { globalAllocated: 398, baselineAllocated: 342, seatsGained: 56, preferenceLift: '+18.4%' },
      path: '/admin/runs/14',
    },
    {
      n: 6,
      title: 'Tamper-Evident Audit & Reason Provenance',
      what: 'Every candidate match carries explicit reason codes, contributing factor breakdowns, and an immutable administrative event log.',
      why: 'Enables judicial and grievance review by providing the exact mathematical rationale for every assignment decision.',
      data: { auditEventsLogged: 402, reasonCodesAssigned: 398, actorAttribution: '100% verified' },
      path: '/admin/audit',
    },
    {
      n: 7,
      title: 'Operational Scope & System Boundaries',
      what: 'NextAlloc recognizes clear boundaries: offline institutional identity relies on AISHE registries; solver timeouts are bounded at 60s.',
      why: 'Honest system boundaries prevent overpromising and ensure robust, predictable real-world deployment.',
      data: { solverTimeoutSec: 60, fallbackPolicy: 'Greedy baseline on timeout', maxCandidateCohort: 50000 },
      path: '/admin/technical',
    },
  ],
  '/api/admin/technical': {
    ai: { status: 'ONLINE', aiMode: 'Hybrid semantic + CP-SAT', engineDescription: 'Deterministic eligibility gate + OR-Tools CP-SAT global optimizer', embeddingModel: 'bge-small-en-v1.5', optimizer: 'Google OR-Tools CP-SAT', optimizerVersion: '9.10', serviceVersion: '2.4.1', note: 'All hard statutory constraints enforced prior to objective scoring.' },
    solver: { lastRun: '2026-11-12T10:30:01Z', solverStatus: 'OPTIMAL', objective: 34890, eligiblePairs: 6420, variables: 18420, constraints: 2680, solverRuntimeMs: 485, totalRuntimeMs: 842 },
    dataset: { candidates: 1200, opportunities: 180, seats: 420, scenario: 'SIH National Cohort', version: 3, fingerprint: 'a4c9f10b', seed: 42 },
    stack: { backend: 'Spring Boot 3.3 (Java 21)', optimizer: 'FastAPI + OR-Tools CP-SAT 9.10', frontend: 'React 18 + TypeScript + Vite 5', database: 'PostgreSQL 16' },
    links: { apiDocs: '/swagger-ui.html', solverHealth: '/actuator/health' },
  },
  '/api/admin/data-quality': [
    { area: 'Institutional AISHE Codes', status: 'PASS', what: 'All 180 active institutions match registered AISHE/NITI codes.', why: 'Prevents spoofed university domains.', fix: 'None required', affected: 0 },
    { area: 'Duplicate Candidate Taxonomies', status: 'WARN', what: '4 candidate skill claims mapped to unconfirmed aliases.', why: 'Minor variance in elective naming.', fix: 'Review in Skill Normalization queue', affected: 4 },
  ],
};

async function attachMock(page, fixtures) {
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const match = fixtures[url.pathname];
    if (match !== undefined) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(match) });
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    }
  });
}

async function loginAs(page, fixtures, roleIdx, waitGlob) {
  await attachMock(page, fixtures);
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
  await page.getByRole('button', { name: /try a demo account/i }).click();
  await page.getByRole('button', { name: /^fill$/i }).nth(roleIdx).click();
  await page.locator('button[type="submit"]').click();
  await page.waitForURL(waitGlob, { timeout: 10000 });
}

async function auditRoute(page, name, urlPath, shotFile) {
  if (page.url() !== `${BASE}${urlPath}`) {
    await page.goto(`${BASE}${urlPath}`, { waitUntil: 'networkidle' });
  }
  await page.waitForTimeout(450);

  const metrics = await page.evaluate(() => {
    const imgs = [...document.querySelectorAll('img')];
    const brokenImgs = imgs.filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src);
    const bodyTextLen = (document.body.innerText || '').trim().length;
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      scrollW: document.documentElement.scrollWidth,
      innerW: window.innerWidth,
      brokenImgCount: brokenImgs.length,
      bodyTextLen,
    };
  });

  if (shotFile) {
    await page.screenshot({ path: path.join(OUT, shotFile), fullPage: true });
  }
  return { name, path: urlPath, ...metrics };
}

const results = [];
const chromePath = process.env.CHROME_PATH ||
  (process.platform === 'win32' && process.env['PROGRAMFILES']
    ? path.join(process.env['PROGRAMFILES'], 'Google', 'Chrome', 'Application', 'chrome.exe')
    : undefined);

const launchOptions = {
  headless: true,
  ...(chromePath && fs.existsSync(chromePath) ? { executablePath: chromePath } : {}),
};
const browser = await chromium.launch(launchOptions);

try {
  // 1. Public Login (Desktop + Tablet + Mobile 360/390)
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));

    await attachMock(page, CAND_FIXTURES);
    await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' });
    const d = await auditRoute(page, 'Login Desktop', '/login', '01_login_desktop.png');
    await page.setViewportSize({ width: 768, height: 1024 });
    await page.waitForTimeout(200);
    const t = await auditRoute(page, 'Login Tablet', '/login', null);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.waitForTimeout(200);
    const m360 = await auditRoute(page, 'Login Mobile 360', '/login', '01_login_mobile.png');
    results.push({ d, t, m360, errors });
    await ctx.close();
  }

  // 2. Candidate 4 routes
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    await loginAs(page, CAND_FIXTURES, 0, '**/candidate**');

    const routes = [
      ['Candidate Home', '/candidate', '02_candidate_home_desktop.png'],
      ['Candidate Profile', '/candidate/profile', '03_candidate_profile_desktop.png'],
      ['Candidate Explore', '/candidate/explore', '04_candidate_explore_desktop.png'],
      ['Candidate Analytics', '/candidate/analytics', '05_candidate_analytics_desktop.png'],
    ];
    for (const [name, p, shot] of routes) {
      await page.setViewportSize({ width: 1440, height: 900 });
      const d = await auditRoute(page, name, p, shot);
      await page.setViewportSize({ width: 360, height: 800 });
      const m = await auditRoute(page, `${name} 360px`, p, p === '/candidate' ? '02_candidate_home_mobile.png' : null);
      results.push({ route: p, desktop: d, mobile360: m });
    }

    // Test Mobile Drawer on Candidate Home at 390px
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${BASE}/candidate`, { waitUntil: 'networkidle' });
    const menuBtn = page.locator('.na-hamburger');
    await menuBtn.click();
    await page.waitForTimeout(250);
    const drawerOpen = await page.locator('#na-sidebar.is-open').count();
    await page.keyboard.press('Escape');
    await page.waitForTimeout(200);
    const drawerClosed = await page.locator('#na-sidebar.is-open').count();
    results.push({ check: 'mobile-drawer', drawerOpen, drawerClosed, errors });
    await ctx.close();
  }

  // 3. Provider 2 routes
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    await loginAs(page, PROV_FIXTURES, 1, '**/provider**');

    const routes = [
      ['Provider Overview', '/provider', '06_provider_home_desktop.png'],
      ['Provider Opportunities', '/provider/opportunities', '07_provider_opps_desktop.png'],
    ];
    for (const [name, p, shot] of routes) {
      await page.setViewportSize({ width: 1440, height: 900 });
      const d = await auditRoute(page, name, p, shot);
      await page.setViewportSize({ width: 390, height: 844 });
      const m = await auditRoute(page, `${name} 390px`, p, p === '/provider' ? '06_provider_home_mobile.png' : null);
      results.push({ route: p, desktop: d, mobile390: m });
    }
    results.push({ check: 'provider-errors', errors });
    await ctx.close();
  }

  // 4. Admin 10 routes
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push(e.message));
    await loginAs(page, ADMIN_FIXTURES, 2, '**/admin**');

    const routes = [
      ['Admin Overview', '/admin', '08_admin_overview_desktop.png'],
      ['Admin Verification', '/admin/verification', '09_admin_verification_desktop.png'],
      ['Admin Scenarios', '/admin/scenarios', '10_admin_scenarios_desktop.png'],
      ['Admin Runs', '/admin/runs', '11_admin_runs_desktop.png'],
      ['Admin Run Detail', '/admin/runs/14', '12_admin_rundetail_desktop.png'],
      ['Admin WhatIf', '/admin/whatif', '13_admin_whatif_desktop.png'],
      ['Admin Reallocation', '/admin/reallocation', '14_admin_reallocation_desktop.png'],
      ['Admin Audit', '/admin/audit', '15_admin_audit_desktop.png'],
      ['Admin Judge', '/admin/judge', '16_admin_judge_desktop.png'],
      ['Admin Technical', '/admin/technical', '17_admin_technical_desktop.png'],
    ];
    for (const [name, p, shot] of routes) {
      await page.setViewportSize({ width: 1440, height: 900 });
      const d = await auditRoute(page, name, p, shot);
      await page.setViewportSize({ width: 768, height: 1024 });
      const t = await auditRoute(page, `${name} 768px`, p, null);
      await page.setViewportSize({ width: 360, height: 800 });
      const m = await auditRoute(page, `${name} 360px`, p, p === '/admin' ? '08_admin_overview_mobile.png' : (p === '/admin/verification' ? '09_admin_verification_mobile.png' : null));
      results.push({ route: p, desktop: d, tablet768: t, mobile360: m });
    }
    // Check 1366 laptop overflow on Overview
    await page.setViewportSize({ width: 1366, height: 768 });
    const l1366 = await auditRoute(page, 'Admin Overview 1366px', '/admin', null);
    results.push({ check: 'laptop-1366', l1366 });
    results.push({ check: 'admin-errors', errors });
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(JSON.stringify(results, null, 2));
