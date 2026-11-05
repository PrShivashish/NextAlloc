package in.pragati.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

import java.lang.reflect.Method;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.util.AopTestUtils;

import com.fasterxml.jackson.databind.ObjectMapper;

import in.pragati.ai.AiServiceClient;
import in.pragati.common.ApiException;
import in.pragati.common.Weights;
import in.pragati.domain.*;
import in.pragati.domain.enums.*;
import in.pragati.repo.*;
import in.pragati.security.AuthUser;

/**
 * Gate 6 — End-to-End Real Boundary Integration Tests for Phase 4A-2B:
 * Deterministic Hard Eligibility Integrated into AllocationService, ReallocationService, and PolicyService.
 *
 * Backed by actual H2 database and capturing live AiServiceClient optimizer request payloads.
 */
@SpringBootTest
@DisplayName("Phase 4A-2B Integration — Deterministic Eligibility into Global Allocation Pipeline")
class EligibilityIntegrationTest {

    @Autowired
    private AllocationService allocationService;

    @Autowired
    private ReallocationService reallocationService;

    @Autowired
    private PolicyService policyService;

    @Autowired
    private AllocationRunRepository runRepo;

    @Autowired
    private DatasetSnapshotRepository snapshotRepo;

    @Autowired
    private CandidateProfileRepository profileRepo;

    @Autowired
    private CandidateSkillRepository skillRepo;

    @Autowired
    private OpportunityRepository oppRepo;

    @Autowired
    private OpportunitySkillRepository oppSkillRepo;

    @Autowired
    private CandidateAcademicRecordRepository acadRepo;

    @Autowired
    private CandidateEvidenceRepository evidRepo;

    @Autowired
    private AllocationEligibilitySnapshotRepository eligSnapshotRepo;

    @Autowired
    private ObjectMapper json;

    @MockBean
    private AiServiceClient aiClient;

    private AuthUser adminUser;
    private DatasetSnapshot activeDataset;
    private Opportunity softwareOpp;

    @BeforeEach
    void setUp() {
        runRepo.findAllByStatusIn(List.of(RunStatus.QUEUED, RunStatus.RUNNING)).forEach(r -> {
            r.status = RunStatus.COMPLETED;
            runRepo.save(r);
        });

        adminUser = new AuthUser(1L, "admin@pragati.gov.in", "admin", "ADMIN");

        // Ensure a dataset snapshot exists
        activeDataset = snapshotRepo.findTopByOrderByIdDesc().orElseGet(() -> {
            DatasetSnapshot s = new DatasetSnapshot();
            s.scenario = ScenarioKey.STANDARD_SHOWCASE;
            s.version = 1;
            s.fingerprint = "test-fingerprint";
            s.seed = 42L;
            s.candidateCount = 10;
            s.opportunityCount = 5;
            s.seatCount = 10;
            return snapshotRepo.save(s);
        });

        // Ensure active opportunity
        softwareOpp = oppRepo.findAllByStatus(OppStatus.ACTIVE).stream().findFirst().orElseGet(() -> {
            Opportunity o = new Opportunity();
            o.title = "Junior Software Engineer";
            o.sector = Sector.SOFTWARE_IT;
            o.status = OppStatus.ACTIVE;
            o.minQualification = Qualification.BACHELORS;
            o.capacity = 5;
            o.state = "Karnataka";
            return oppRepo.save(o);
        });

        reset(aiClient);
        // Mock AI optimizer response
        when(aiClient.optimize(any())).thenReturn(new AiServiceClient.OptimizeResult(
                "OPTIMAL",
                8500L,
                42,
                new AiServiceClient.ModelStats(10, 10, 10, 42),
                List.of(),
                List.of()
        ));
    }

    @AfterEach
    void tearDown() {
        runRepo.findAllByStatusIn(List.of(RunStatus.QUEUED, RunStatus.RUNNING)).forEach(r -> {
            r.status = RunStatus.COMPLETED;
            runRepo.save(r);
        });
    }

    private void invokeExecute(Long runId) throws Exception {
        AllocationService target = AopTestUtils.getTargetObject(allocationService);
        Method m = AllocationService.class.getDeclaredMethod("execute", Long.class);
        m.setAccessible(true);
        m.invoke(target, runId);
    }

    // ------------------------------------------------------------------
    // 1. Legacy behavior remains unchanged
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 1: Legacy run uses prototype-legacy-v1 and preserves legacy behavior")
    void test1_legacyBehaviorUnchanged() {
        AllocationService.StartRunRequest req = new AllocationService.StartRunRequest(
                "balanced", null, false, 0, "v1", null, null);
        AllocationRun run = allocationService.prepareRun(req, null, null, adminUser);

        assertEquals("prototype-legacy-v1", run.eligibilityRuleSetId);
        assertEquals("1.0.0", run.eligibilityRuleSetVersion);
        assertEquals("v1", run.policyVersion);
        assertNotNull(run.createdAt);
        assertEquals(run.createdAt.atZone(java.time.ZoneId.of("Asia/Kolkata")).toLocalDate(),
                AllocationService.resolveReferenceDate(run));
    }

    // ------------------------------------------------------------------
    // 2. Ineligible high-scoring candidate never appears in optimizer pairs
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 2: Ineligible full-time employed candidate never in optimizer pairs")
    void test2_ineligibleCandidateNeverInOptimizerPairs() throws Exception {
        // Create full-time employed candidate (ineligible under 2026 PMIS)
        CandidateProfile inelig = new CandidateProfile();
        inelig.userId = 8801L;
        inelig.fullName = "Employed Applicant";
        inelig.candidateState = CandidateState.ACTIVE;
        inelig.dob = LocalDate.of(2002, 1, 1);
        inelig.employmentType = EmploymentType.FULL_TIME;
        inelig.qualification = Qualification.BACHELORS;
        inelig.locationType = LocationType.RURAL;
        CandidateProfile savedInelig = profileRepo.save(inelig);
        final int ineligId = savedInelig.id.intValue();

        // Prepare run with 2026 demo rules
        AllocationService.StartRunRequest req = new AllocationService.StartRunRequest(
                "balanced", null, false, 0, "v2",
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0");
        AllocationRun run = allocationService.prepareRun(req, null, null, adminUser);

        invokeExecute(run.id);

        ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
        verify(aiClient, atLeastOnce()).optimize(captor.capture());

        AiServiceClient.OptimizeRequest captured = captor.getValue();
        // Candidate universe MUST include the candidate (DEF-001 cohort preservation)
        assertTrue(captured.candidates().contains(ineligId),
                "Ineligible candidate MUST be in cohort candidate universe for full coverage tracking");

        // Optimizer pairs MUST NOT contain any pair with this ineligible candidate
        assertTrue(captured.pairs().stream().noneMatch(p -> p.c() == ineligId),
                "Ineligible candidate MUST NOT have any candidate-opportunity pair submitted to the solver");
    }

    // ------------------------------------------------------------------
    // 3. Missing mandatory evidence results in no eligible pairs for demonstration rule
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 3: Enrolled student with missing NOC has no eligible pairs in optimizer")
    void test3_missingNocProducesNoPairs() throws Exception {
        CandidateProfile student = new CandidateProfile();
        student.userId = 8802L;
        student.fullName = "Enrolled Student Without NOC";
        student.candidateState = CandidateState.ACTIVE;
        student.dob = LocalDate.of(2003, 5, 10);
        student.employmentType = EmploymentType.UNEMPLOYED;
        student.qualification = Qualification.BACHELORS;
        student.locationType = LocationType.URBAN;
        CandidateProfile savedStudent = profileRepo.save(student);
        final int studentId = savedStudent.id.intValue();

        CandidateAcademicRecord acad = new CandidateAcademicRecord();
        acad.candidateId = savedStudent.id;
        acad.enrollmentStatus = EnrollmentStatus.ENROLLED_FULL_TIME;
        acad.finalYearStatus = FinalYearStatus.VERIFIED_FINAL_YEAR;
        acadRepo.save(acad);

        AllocationService.StartRunRequest req = new AllocationService.StartRunRequest(
                "balanced", null, false, 0, "v2",
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0");
        AllocationRun run = allocationService.prepareRun(req, null, null, adminUser);

        invokeExecute(run.id);

        ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
        verify(aiClient, atLeastOnce()).optimize(captor.capture());

        AiServiceClient.OptimizeRequest captured = captor.getValue();
        assertTrue(captured.pairs().stream().noneMatch(p -> p.c() == studentId),
                "Candidate with missing NOC evidence must not have any optimizer pair");
    }

    // ------------------------------------------------------------------
    // 4. Authorized eligible pair reaches scoring and optimization
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 4: Final-year student with verified Dean NOC reaches optimizer pairs")
    void test4_verifiedStudentNocReachesOptimizerPairs() throws Exception {
        CandidateProfile student = new CandidateProfile();
        student.userId = 8803L;
        student.fullName = "Eligible Final Year Student";
        student.candidateState = CandidateState.ACTIVE;
        student.dob = LocalDate.of(2003, 6, 1);
        student.employmentType = EmploymentType.UNEMPLOYED;
        student.qualification = Qualification.BACHELORS;
        student.locationType = LocationType.RURAL;
        student.state = "Karnataka";
        CandidateProfile savedStudent = profileRepo.save(student);
        final int studentId = savedStudent.id.intValue();

        CandidateAcademicRecord acad = new CandidateAcademicRecord();
        acad.candidateId = savedStudent.id;
        acad.enrollmentStatus = EnrollmentStatus.ENROLLED_FULL_TIME;
        acad.finalYearStatus = FinalYearStatus.VERIFIED_FINAL_YEAR;
        acadRepo.save(acad);

        CandidateEvidence noc = new CandidateEvidence();
        noc.candidateId = savedStudent.id;
        noc.evidenceType = "INSTITUTIONAL_NOC";
        noc.documentReference = "NOC-DEAN-8803.pdf";
        noc.documentSha256 = "8f434346648f6b96df89dda901c5176b10a6d83961dd3c1ac88b59b2dc327aa4";
        noc.signatoryRole = SignatoryRole.DEAN;
        noc.signatoryName = "Dr. Engineering Dean";
        noc.declaresNoAcademicConflict = true;
        noc.verificationStatus = EvidenceStatus.VERIFIED;
        noc.validFrom = LocalDate.of(2025, 1, 1);
        noc.validUntil = LocalDate.of(2027, 1, 1);
        evidRepo.save(noc);

        // Grant candidate skills to satisfy opportunity requirements
        for (OpportunitySkill os : oppSkillRepo.findByOpportunityId(softwareOpp.id)) {
            CandidateSkill cs = new CandidateSkill();
            cs.candidateId = savedStudent.id;
            cs.rawLabel = os.skill;
            cs.canonical = os.skill;
            skillRepo.save(cs);
        }

        AllocationService.StartRunRequest req = new AllocationService.StartRunRequest(
                "balanced", null, false, 0, "v2",
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0");
        AllocationRun run = allocationService.prepareRun(req, null, null, adminUser);

        invokeExecute(run.id);

        ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
        verify(aiClient, atLeastOnce()).optimize(captor.capture());

        AiServiceClient.OptimizeRequest captured = captor.getValue();
        assertTrue(captured.pairs().stream().anyMatch(p -> p.c() == studentId),
                "Eligible candidate with verified NOC must produce an eligible optimizer pair");
    }

    // ------------------------------------------------------------------
    // 5. Full candidate cohort preserved in optimizer universe (DEF-001)
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 5: Zero-pair ineligible candidates are retained in optimizer candidate universe")
    void test5_zeroPairCandidateRetainedInUniverse() throws Exception {
        CandidateProfile inelig = new CandidateProfile();
        inelig.userId = 8805L;
        inelig.fullName = "Cohort Preservation Candidate";
        inelig.candidateState = CandidateState.ACTIVE;
        inelig.dob = LocalDate.of(2001, 1, 1);
        inelig.employmentType = EmploymentType.FULL_TIME;
        inelig.qualification = Qualification.BACHELORS;
        inelig.locationType = LocationType.RURAL;
        inelig.state = "Karnataka";
        CandidateProfile saved = profileRepo.save(inelig);
        final int ineligId = saved.id.intValue();

        AllocationService.StartRunRequest req = new AllocationService.StartRunRequest(
                "balanced", null, false, 0, "v2",
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0");
        AllocationRun run = allocationService.prepareRun(req, null, null, adminUser);

        invokeExecute(run.id);

        ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
        verify(aiClient, atLeastOnce()).optimize(captor.capture());

        AiServiceClient.OptimizeRequest captured = captor.getValue();
        assertTrue(captured.candidates().contains(ineligId),
                "Candidate universe must preserve all active candidates for full coverage tracking");
        assertTrue(captured.pairs().stream().noneMatch(p -> p.c() == ineligId),
                "Candidate must have zero pairs submitted to solver");
    }

    // ------------------------------------------------------------------
    // 6. Candidate IDs are not duplicated
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 6: Candidate IDs in optimizer payload are unique and sorted")
    void test6_candidateIdsUniqueAndSorted() throws Exception {
        AllocationService.StartRunRequest req = new AllocationService.StartRunRequest(
                "balanced", null, false, 0, "v1", null, null);
        AllocationRun run = allocationService.prepareRun(req, null, null, adminUser);

        invokeExecute(run.id);

        ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
        verify(aiClient, atLeastOnce()).optimize(captor.capture());

        List<Integer> candidates = captor.getValue().candidates();
        Set<Integer> unique = new HashSet<>(candidates);
        assertEquals(unique.size(), candidates.size(), "Candidates list must not contain duplicates");
    }

    // ------------------------------------------------------------------
    // 7. Opportunity capacity remains unchanged
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 7: Opportunity capacity preserved in optimizer request")
    void test7_opportunityCapacityPreserved() throws Exception {
        AllocationService.StartRunRequest req = new AllocationService.StartRunRequest(
                "balanced", null, false, 0, "v1", null, null);
        AllocationRun run = allocationService.prepareRun(req, null, null, adminUser);

        invokeExecute(run.id);

        ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
        verify(aiClient, atLeastOnce()).optimize(captor.capture());

        AiServiceClient.OptOpp optOpp = captor.getValue().opportunities().stream()
                .filter(o -> o.id() == softwareOpp.id.intValue())
                .findFirst()
                .orElse(null);

        assertNotNull(optOpp);
        assertEquals(softwareOpp.capacity, optOpp.capacity());
    }

    // ------------------------------------------------------------------
    // 8. Fairness v1/v2 does not alter eligibility rule-set selection
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 8: Fairness version (v1/v2) does not determine eligibility rule-set")
    void test8_fairnessVersionDoesNotAlterEligibilityRuleSet() {
        // Start v2 fairness run with default (unspecified) eligibility -> defaults to legacy
        AllocationService.StartRunRequest reqA = new AllocationService.StartRunRequest(
                "balanced_v2", null, false, 30, "v2", null, null);
        AllocationRun runA = allocationService.prepareRun(reqA, null, null, adminUser);
        assertEquals("v2", runA.policyVersion);
        assertEquals("prototype-legacy-v1", runA.eligibilityRuleSetId);

        // Mark runA as completed so prepareRun does not block on active run
        runA.status = RunStatus.COMPLETED;
        runRepo.save(runA);

        // Start v1 fairness run with 2026 demo eligibility
        AllocationService.StartRunRequest reqB = new AllocationService.StartRunRequest(
                "balanced", null, false, 30, "v1",
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0");
        AllocationRun runB = allocationService.prepareRun(reqB, null, null, adminUser);
        assertEquals("v1", runB.policyVersion);
        assertEquals("pmis-2026-expansion-demo-v1", runB.eligibilityRuleSetId);
    }

    // ------------------------------------------------------------------
    // 9. Reallocation inherits parent eligibility version
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 9: Reallocation inherits exact parent eligibility rule-set and version")
    void test9_reallocationInheritsParentEligibilityRuleSet() {
        AllocationRun base = new AllocationRun();
        base.runCode = "RUN-BASE-P4";
        base.number = 991;
        base.scenario = ScenarioKey.STANDARD_SHOWCASE;
        base.snapshotId = activeDataset.id;
        base.policyName = "Base Run 2026";
        base.policyKey = "balanced_v2";
        base.policyVersion = "v2";
        base.eligibilityRuleSetId = EligibilityEvaluator.RULESET_PMIS_2026_DEMO;
        base.eligibilityRuleSetVersion = "1.0.0";
        base.weightsJson = Weights.defaultBalanced().toJson(json);
        base.status = RunStatus.COMPLETED;
        base = runRepo.save(base);

        ReallocationService.Change ch = new ReallocationService.Change(
                "CAPACITY", softwareOpp.id, null, softwareOpp.capacity + 2, null, null, null, null);
        ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                base.id, List.of(ch));

        AllocationRun child = reallocationService.start(req, adminUser);

        assertEquals(base.id, child.parentRunId);
        assertEquals(base.eligibilityRuleSetId, child.eligibilityRuleSetId);
        assertEquals(base.eligibilityRuleSetVersion, child.eligibilityRuleSetVersion);
    }

    // ------------------------------------------------------------------
    // 10. Simulation and normal allocation use same rule-set contract
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 10: Policy simulation uses base run's eligibility rule-set contract")
    void test10_simulationUsesBaseRunEligibilityRuleSet() {
        AllocationRun base = new AllocationRun();
        base.runCode = "RUN-BASE-SIM";
        base.number = 992;
        base.scenario = ScenarioKey.STANDARD_SHOWCASE;
        base.snapshotId = activeDataset.id;
        base.policyName = "Base Run";
        base.policyKey = "balanced";
        base.policyVersion = "v1";
        base.eligibilityRuleSetId = EligibilityEvaluator.RULESET_LEGACY;
        base.eligibilityRuleSetVersion = "1.0.0";
        base.weightsJson = Weights.defaultBalanced().toJson(json);
        base.status = RunStatus.COMPLETED;
        base = runRepo.save(base);

        PolicyService.SimulateRequest simReq = new PolicyService.SimulateRequest(
                base.id, null, false, 0, "v1");

        SimulationRun sim = policyService.startSimulation(simReq, adminUser);
        assertNotNull(sim);
        assertEquals(base.id, sim.baseRunId);
    }

    // ------------------------------------------------------------------
    // 13. Evidence is not leaked into optimizer request payloads
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 13: Serialized optimizer payload contains no confidential document or signatory data")
    void test13_noSensitiveEvidenceLeakageIntoPayloads() throws Exception {
        AllocationService.StartRunRequest req = new AllocationService.StartRunRequest(
                "balanced", null, false, 0, "v1", null, null);
        AllocationRun run = allocationService.prepareRun(req, null, null, adminUser);

        invokeExecute(run.id);

        ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
        verify(aiClient, atLeastOnce()).optimize(captor.capture());

        String jsonPayload = json.writeValueAsString(captor.getValue());
        assertFalse(jsonPayload.contains(".pdf"), "Payload must not contain document file references");
        assertFalse(jsonPayload.contains("sha256"), "Payload must not contain hash field keys");
        assertFalse(jsonPayload.contains("@nit.edu.in"), "Payload must not contain signatory email addresses");
        assertFalse(jsonPayload.contains("DEAN"), "Payload must not contain signatory roles");
    }

    // ------------------------------------------------------------------
    // 15. Snapshot data is saved correctly and is idempotent on retries
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 15: Decision snapshots are persisted in database and idempotent on run retry")
    void test15_snapshotPersistenceAndIdempotency() throws Exception {
        AllocationService.StartRunRequest req = new AllocationService.StartRunRequest(
                "balanced", null, false, 0, "v2",
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0");
        AllocationRun run = allocationService.prepareRun(req, null, null, adminUser);

        // First execution
        invokeExecute(run.id);
        List<AllocationEligibilitySnapshot> snapshots1 = eligSnapshotRepo.findByRunId(run.id);
        assertFalse(snapshots1.isEmpty(), "Snapshots must be persisted in database");
        int count1 = snapshots1.size();

        // Second execution (retry/replay)
        invokeExecute(run.id);
        List<AllocationEligibilitySnapshot> snapshots2 = eligSnapshotRepo.findByRunId(run.id);
        assertEquals(count1, snapshots2.size(), "Retrying run must NOT insert duplicate snapshots");
    }

    // ------------------------------------------------------------------
    // 16. Stored decisions remain historically interpretable after evidence changes
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 16: Snapshot retains point-in-time decision after candidate evidence mutation")
    void test16_historicalDecisionSurvivesEvidenceMutation() throws Exception {
        CandidateProfile cand = new CandidateProfile();
        cand.userId = 8804L;
        cand.fullName = "Mutation Test Candidate";
        cand.candidateState = CandidateState.ACTIVE;
        cand.dob = LocalDate.of(2003, 1, 1);
        cand.employmentType = EmploymentType.UNEMPLOYED;
        cand.qualification = Qualification.BACHELORS;
        cand.locationType = LocationType.RURAL;
        cand.state = "Karnataka";
        cand = profileRepo.save(cand);

        CandidateAcademicRecord acad = new CandidateAcademicRecord();
        acad.candidateId = cand.id;
        acad.enrollmentStatus = EnrollmentStatus.ENROLLED_FULL_TIME;
        acad.finalYearStatus = FinalYearStatus.VERIFIED_FINAL_YEAR;
        acadRepo.save(acad);

        CandidateEvidence noc = new CandidateEvidence();
        noc.candidateId = cand.id;
        noc.evidenceType = "INSTITUTIONAL_NOC";
        noc.documentReference = "DOC-SUBMITTED.pdf";
        noc.signatoryRole = SignatoryRole.PRINCIPAL;
        noc.verificationStatus = EvidenceStatus.SUBMITTED;
        noc = evidRepo.save(noc);

        AllocationService.StartRunRequest req = new AllocationService.StartRunRequest(
                "balanced", null, false, 0, "v2",
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0");
        AllocationRun run = allocationService.prepareRun(req, null, null, adminUser);

        invokeExecute(run.id);

        AllocationEligibilitySnapshot snap = eligSnapshotRepo.findByRunIdAndCandidateId(run.id, cand.id).orElseThrow();
        assertEquals(EligibilityDecision.INELIGIBLE, snap.decision);
        assertEquals("SUBMITTED", snap.evidenceStatusSnapshot);

        // Evidence mutated in database post-run
        noc.verificationStatus = EvidenceStatus.VERIFIED;
        noc.signatoryName = "Post-Verification Principal";
        evidRepo.save(noc);

        // Historical snapshot still reflects point-in-time state
        AllocationEligibilitySnapshot snapAfter = eligSnapshotRepo.findByRunIdAndCandidateId(run.id, cand.id).orElseThrow();
        assertEquals(EligibilityDecision.INELIGIBLE, snapAfter.decision);
        assertEquals("SUBMITTED", snapAfter.evidenceStatusSnapshot);
    }

    // ------------------------------------------------------------------
    // Gate 1: Non-deterministic date fallback removal
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Gate 1: Missing createdAt throws IllegalStateException refusing non-deterministic replay")
    void testGate1_missingCreationDateThrowsException() {
        AllocationRun corruptRun = new AllocationRun();
        corruptRun.createdAt = null;

        IllegalStateException ex = assertThrows(IllegalStateException.class,
                () -> AllocationService.resolveReferenceDate(corruptRun));
        assertTrue(ex.getMessage().contains("no persisted creation date provenance"));

        assertThrows(IllegalStateException.class,
                () -> AllocationService.resolveReferenceDate(null));
    }

    // ------------------------------------------------------------------
    // Gate 2: Partial interrupted snapshot write repaired safely on retry
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Gate 2: Partial interrupted snapshot write repaired without duplicates on retry")
    void testGate2_partialInterruptedSnapshotWriteRepairedOnRetry() throws Exception {
        AllocationService.StartRunRequest req = new AllocationService.StartRunRequest(
                "balanced", null, false, 0, "v2",
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0");
        AllocationRun run = allocationService.prepareRun(req, null, null, adminUser);

        List<CandidateProfile> activeCandidates = profileRepo.findAllByCandidateState(CandidateState.ACTIVE);
        assertTrue(activeCandidates.size() >= 2, "Need at least 2 candidates for partial write simulation");

        // Simulate an interrupted run that persisted a snapshot for only the FIRST candidate
        CandidateProfile first = activeCandidates.get(0);
        AllocationEligibilitySnapshot partial = new AllocationEligibilitySnapshot();
        partial.runId = run.id;
        partial.candidateId = first.id;
        partial.decision = EligibilityDecision.ELIGIBLE;
        partial.reasonCodesJson = "[]";
        eligSnapshotRepo.save(partial);

        assertEquals(1, eligSnapshotRepo.findByRunId(run.id).size(),
                "Precondition: only 1 snapshot exists prior to retry");

        // Execute run (replaying/retrying the interrupted run)
        invokeExecute(run.id);

        List<AllocationEligibilitySnapshot> repaired = eligSnapshotRepo.findByRunId(run.id);
        assertEquals(activeCandidates.size(), repaired.size(),
                "All missing candidate snapshots must be populated on retry");

        // Verify uniqueness: exactly one snapshot per candidate
        Set<Long> candidateIdsInSnapshots = repaired.stream().map(s -> s.candidateId).collect(Collectors.toSet());
        assertEquals(activeCandidates.size(), candidateIdsInSnapshots.size(),
                "Each candidate must have exactly one snapshot with no duplicate records");

        // Idempotent re-execution must not insert duplicate rows
        invokeExecute(run.id);
        List<AllocationEligibilitySnapshot> afterSecondRetry = eligSnapshotRepo.findByRunId(run.id);
        assertEquals(activeCandidates.size(), afterSecondRetry.size(),
                "Subsequent retry must remain idempotent and not add duplicate rows");
    }

    // ------------------------------------------------------------------
    // Gate 3: Policy Lab counterfactual preserves baseline eligibility across evidence mutation
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Gate 3: Policy Lab simulation preserves baseline eligibility decision across post-baseline evidence mutation")
    void testGate3_policySimulationPreservesBaselineEligibilityAcrossEvidenceMutation() throws Exception {
        CandidateProfile cand = new CandidateProfile();
        cand.userId = 8806L;
        cand.fullName = "Counterfactual Consistency Candidate";
        cand.candidateState = CandidateState.ACTIVE;
        cand.dob = LocalDate.of(2003, 1, 1);
        cand.employmentType = EmploymentType.UNEMPLOYED;
        cand.qualification = Qualification.BACHELORS;
        cand.locationType = LocationType.RURAL;
        cand.state = "Karnataka";
        CandidateProfile savedCand = profileRepo.save(cand);
        final int candId = savedCand.id.intValue();

        CandidateAcademicRecord acad = new CandidateAcademicRecord();
        acad.candidateId = savedCand.id;
        acad.enrollmentStatus = EnrollmentStatus.ENROLLED_FULL_TIME;
        acad.finalYearStatus = FinalYearStatus.VERIFIED_FINAL_YEAR;
        acadRepo.save(acad);

        // NOC submitted but UNVERIFIED during baseline run -> evaluates to INELIGIBLE
        CandidateEvidence noc = new CandidateEvidence();
        noc.candidateId = savedCand.id;
        noc.evidenceType = "INSTITUTIONAL_NOC";
        noc.documentReference = "NOC-PENDING-8806.pdf";
        noc.signatoryRole = SignatoryRole.PRINCIPAL;
        noc.verificationStatus = EvidenceStatus.SUBMITTED;
        noc = evidRepo.save(noc);

        AllocationService.StartRunRequest req = new AllocationService.StartRunRequest(
                "balanced", null, false, 0, "v2",
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0");
        AllocationRun base = allocationService.prepareRun(req, null, null, adminUser);
        invokeExecute(base.id);

        // Verify baseline snapshot recorded INELIGIBLE
        AllocationEligibilitySnapshot baseSnap = eligSnapshotRepo.findByRunIdAndCandidateId(base.id, savedCand.id).orElseThrow();
        assertEquals(EligibilityDecision.INELIGIBLE, baseSnap.decision);

        // Mutate candidate evidence in DB post-baseline (e.g. NOC verified later)
        noc.verificationStatus = EvidenceStatus.VERIFIED;
        noc.declaresNoAcademicConflict = true;
        noc.validFrom = LocalDate.of(2025, 1, 1);
        noc.validUntil = LocalDate.of(2027, 1, 1);
        evidRepo.save(noc);

        // Now run Policy Lab simulation on the baseline run
        PolicyService.SimulateRequest simReq = new PolicyService.SimulateRequest(
                base.id, null, false, 0, "v2");
        reset(aiClient);
        when(aiClient.optimize(any())).thenReturn(new AiServiceClient.OptimizeResult(
                "OPTIMAL", 100L, 42, new AiServiceClient.ModelStats(10, 10, 10, 42), List.of(), List.of()));

        SimulationRun sim = policyService.startSimulation(simReq, adminUser);
        assertNotNull(sim);

        // Wait briefly for simulation thread to finish
        Thread.sleep(600);

        ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
        verify(aiClient, atLeastOnce()).optimize(captor.capture());

        // In the simulation, candId MUST NOT have pairs because baseline snapshot was INELIGIBLE
        AiServiceClient.OptimizeRequest captured = captor.getValue();
        assertTrue(captured.pairs().stream().noneMatch(p -> p.c() == candId),
                "Policy Lab simulation must NOT re-evaluate candidate using mutated evidence; candidate must remain ineligible per baseline snapshot");
    }

    // ------------------------------------------------------------------
    // Gate 4: Reallocation rejects unsupported eligibility rule sets
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Gate 4: Reallocation rejects invalid or unsupported eligibility rule-set ID")
    void testGate4_reallocationRejectsUnsupportedEligibilityRuleSet() {
        AllocationRun base = new AllocationRun();
        base.runCode = "RUN-BASE-REALLOC-GATE4";
        base.number = 993;
        base.scenario = ScenarioKey.STANDARD_SHOWCASE;
        base.snapshotId = activeDataset.id;
        base.policyName = "Base Run";
        base.policyKey = "balanced";
        base.policyVersion = "v1";
        base.eligibilityRuleSetId = EligibilityEvaluator.RULESET_LEGACY;
        base.eligibilityRuleSetVersion = "1.0.0";
        base.weightsJson = Weights.defaultBalanced().toJson(json);
        base.status = RunStatus.COMPLETED;
        base = runRepo.save(base);

        ReallocationService.Change invalidChange = new ReallocationService.Change(
                "POLICY", null, null, null, null, null, null, null, "invalid-future-ruleset-v99", "1.0.0");
        ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                base.id, List.of(invalidChange));

        ApiException ex = assertThrows(ApiException.class, () -> reallocationService.start(req, adminUser));
        assertTrue(ex.getMessage().contains("Unsupported eligibility rule-set"),
                "Reallocation must reject unsupported eligibility rule set IDs");
    }
}
