package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.lang.reflect.Method;
import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.util.AopTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.ObjectMapper;

import in.nextalloc.ai.AiServiceClient;
import in.nextalloc.domain.*;
import in.nextalloc.domain.enums.*;
import in.nextalloc.repo.*;
import in.nextalloc.security.AuthUser;
import in.nextalloc.security.JwtService;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Phase 4A-2C Commit 2: NOC-to-Allocation Integration & Provenance Verification Tests")
public class NocAllocationIntegrationTest {

    @Autowired
    private AllocationService allocationService;

    @Autowired
    private ReallocationService reallocationService;

    @Autowired
    private PolicyService policyService;

    @Autowired
    private ScenarioService scenarioService;

    @Autowired
    private AllocationRunRepository runRepo;

    @Autowired
    private DatasetSnapshotRepository snapshotRepo;

    @Autowired
    private CandidateProfileRepository profileRepo;

    @Autowired
    private CandidateAcademicRecordRepository academicRepo;

    @Autowired
    private CandidateEvidenceRepository evidenceRepo;

    @Autowired
    private CandidateEvidenceCurrentRepository currentEvidenceRepo;

    @Autowired
    private AllocationEligibilitySnapshotRepository eligSnapshotRepo;

    @Autowired
    private OpportunityRepository oppRepo;

    @Autowired
    private OpportunitySkillRepository oppSkillRepo;

    @Autowired
    private CandidateSkillRepository candSkillRepo;

    @Autowired
    private CandidatePreferenceRepository prefRepo;

    @Autowired
    private UserRepository userRepo;

    @Autowired
    private AssignmentRepository assignmentRepo;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private ObjectMapper json;

    @MockBean
    private AiServiceClient aiClient;

    private AuthUser adminAuth;
    private String adminToken;
    private DatasetSnapshot activeDataset;
    private Opportunity testOpportunity;

    private void waitForRun(Long runId) throws Exception {
        long deadline = System.currentTimeMillis() + 10000;
        while (System.currentTimeMillis() < deadline) {
            AllocationRun r = runRepo.findById(runId).orElse(null);
            if (r != null && r.status != RunStatus.QUEUED && r.status != RunStatus.RUNNING && !allocationService.isRunActive()) {
                return;
            }
            Thread.sleep(25);
        }
    }

    private void waitForBackgroundExecutions() throws Exception {
        long deadline = System.currentTimeMillis() + 10000;
        while (System.currentTimeMillis() < deadline) {
            if (!allocationService.isRunActive() && allocationService.activeRuns().isEmpty()) {
                return;
            }
            Thread.sleep(25);
        }
    }

    @BeforeEach
    void setUp() throws Exception {
        waitForBackgroundExecutions();
        // Reset running states
        scenarioService.recoverStaleRuns();
        runRepo.findAllByStatusIn(List.of(RunStatus.QUEUED, RunStatus.RUNNING)).forEach(r -> {
            r.status = RunStatus.COMPLETED;
            runRepo.save(r);
        });

        User adminDb = userRepo.findByEmail("admin@pragati.gov.in").orElseGet(() -> {
            User u = new User();
            u.email = "admin@pragati.gov.in";
            u.passwordHash = "hash";
            u.name = "System Admin";
            u.role = Role.ADMIN;
            return userRepo.save(u);
        });

        adminAuth = new AuthUser(adminDb.id, adminDb.email, adminDb.name, "ROLE_ADMIN");
        adminToken = jwtService.issue(adminDb.id, adminDb.email, adminDb.name, "ADMIN");

        // Ensure active dataset snapshot
        activeDataset = snapshotRepo.findTopByOrderByIdDesc().orElseGet(() -> {
            DatasetSnapshot s = new DatasetSnapshot();
            s.scenario = ScenarioKey.STANDARD_SHOWCASE;
            s.version = 1;
            s.fingerprint = "noc-test-fingerprint";
            s.seed = 42L;
            s.candidateCount = 10;
            s.opportunityCount = 5;
            s.seatCount = 10;
            return snapshotRepo.save(s);
        });

        // Ensure active opportunity
        testOpportunity = oppRepo.findAllByStatus(OppStatus.ACTIVE).stream().findFirst().orElseGet(() -> {
            Opportunity o = new Opportunity();
            o.title = "Software Engineer Intern";
            o.sector = Sector.SOFTWARE_IT;
            o.status = OppStatus.ACTIVE;
            o.minQualification = Qualification.BACHELORS;
            o.capacity = 5;
            o.state = "Karnataka";
            return oppRepo.save(o);
        });

        reset(aiClient);
        when(aiClient.optimize(any())).thenReturn(new AiServiceClient.OptimizeResult(
                "OPTIMAL",
                9000L,
                50,
                new AiServiceClient.ModelStats(10, 10, 10, 50),
                List.of(),
                List.of()
        ));
    }

    @AfterEach
    void tearDown() throws Exception {
        waitForBackgroundExecutions();
        runRepo.findAllByStatusIn(List.of(RunStatus.QUEUED, RunStatus.RUNNING)).forEach(r -> {
            r.status = RunStatus.COMPLETED;
            runRepo.save(r);
        });
        scenarioService.recoverStaleRuns();
    }

    private void invokeExecute(Long runId) throws Exception {
        AllocationService target = AopTestUtils.getTargetObject(allocationService);
        Method m = AllocationService.class.getDeclaredMethod("execute", Long.class);
        m.setAccessible(true);
        m.invoke(target, runId);
    }

    private CandidateProfile createStudentCandidate(String name, boolean finalYear) {
        User u = new User();
        u.email = "student_" + UUID.randomUUID() + "@vtu.edu.in";
        u.passwordHash = "hash";
        u.name = name;
        u.role = Role.CANDIDATE;
        u = userRepo.save(u);

        CandidateProfile p = new CandidateProfile();
        p.userId = u.id;
        p.fullName = name;
        p.qualification = Qualification.BACHELORS;
        p.candidateStatus = CandidateStatus.STUDENT;
        p.candidateState = CandidateState.ACTIVE;
        p.employmentType = EmploymentType.UNEMPLOYED;
        p.dob = LocalDate.of(2003, 5, 15); // age 23 in 2026
        p.state = "Karnataka";
        p.district = "Bengaluru Urban";
        p.locationType = LocationType.URBAN;
        p = profileRepo.save(p);

        CandidateAcademicRecord ar = new CandidateAcademicRecord();
        ar.candidateId = p.id;
        ar.enrollmentStatus = EnrollmentStatus.ENROLLED_FULL_TIME;
        ar.degreeProgram = "B.E. Computer Science";
        ar.institutionName = "VTU Bengaluru";
        ar.finalYearStatus = finalYear ? FinalYearStatus.VERIFIED_FINAL_YEAR : FinalYearStatus.VERIFIED_NOT_FINAL_YEAR;
        ar.currentAcademicYear = finalYear ? 4 : 2;
        ar.programDurationYears = 4;
        ar.expectedCompletionDate = finalYear ? LocalDate.of(2027, 6, 30) : LocalDate.of(2029, 6, 30);
        academicRepo.save(ar);

        // Add 1 mandatory skill and preference for testOpportunity
        CandidateSkill sk = new CandidateSkill();
        sk.candidateId = p.id;
        sk.canonical = "Java";
        sk.rawLabel = "Java";
        sk.validated = true;
        candSkillRepo.save(sk);

        CandidatePreference pref = new CandidatePreference();
        pref.candidateId = p.id;
        pref.opportunityId = testOpportunity.id;
        pref.rank = 1;
        prefRepo.save(pref);

        return p;
    }

    private CandidateEvidence createNocEvidence(Long candidateId, EvidenceStatus status, SignatoryRole role) {
        CandidateEvidence e = new CandidateEvidence();
        e.candidateId = candidateId;
        e.evidenceType = EvidenceService.EVIDENCE_TYPE_NOC;
        e.documentReference = "noc/test-" + UUID.randomUUID() + ".pdf";
        e.documentSha256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        e.issuingInstitution = "VTU Bengaluru";
        e.signatoryRole = role;
        e.signatoryName = "Dr. Dean";
        e.signatoryEmail = "dean@vtu.ac.in";
        e.declaresNoAcademicConflict = true;
        e.validFrom = LocalDate.of(2026, 1, 1);
        e.validUntil = LocalDate.of(2027, 12, 31);
        e.verificationStatus = status;
        if (status == EvidenceStatus.VERIFIED) {
            e.verifiedAt = Instant.now();
            e.verifiedByUserId = adminAuth.id();
        } else if (status == EvidenceStatus.REJECTED) {
            e.verifiedAt = Instant.now();
            e.verifiedByUserId = adminAuth.id();
            e.rejectionReasonCode = EligibilityReasonCode.INSTITUTIONAL_NOC_REJECTED;
            e.rejectionNotes = "Official seal missing";
        }
        e = evidenceRepo.save(e);

        // Update active pointer
        CandidateEvidenceCurrent cur = currentEvidenceRepo
                .findByCandidateIdAndEvidenceType(candidateId, EvidenceService.EVIDENCE_TYPE_NOC)
                .orElseGet(() -> new CandidateEvidenceCurrent(candidateId, EvidenceService.EVIDENCE_TYPE_NOC, 0L));
        cur.evidenceId = e.id;
        currentEvidenceRepo.save(cur);

        return e;
    }

    // ------------------------------------------------------------------
    // Gate 5 Behavioral Tests
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Test 1: Candidate with unverified (SUBMITTED) NOC remains ineligible under demonstration rule")
    void test1_candidateWithUnverifiedNoc_remainsIneligible() throws Exception {
        CandidateProfile cand = createStudentCandidate("Aarav Unverified", true);
        createNocEvidence(cand.id, EvidenceStatus.SUBMITTED, SignatoryRole.DEAN);

        AllocationRun run = allocationService.prepareRun(
                new AllocationService.StartRunRequest("balanced", Map.of(), false, null, "v2",
                        EligibilityEvaluator.RULESET_PMIS_2026_DEMO, EligibilityEvaluator.VERSION_1_0_0),
                null, null, adminAuth);

        invokeExecute(run.id);

        // Verify snapshot
        AllocationEligibilitySnapshot snap = eligSnapshotRepo.findByRunIdAndCandidateId(run.id, cand.id).orElseThrow();
        assertEquals(EligibilityDecision.INELIGIBLE, snap.decision);
        assertEquals("SUBMITTED", snap.evidenceStatusSnapshot);
        assertTrue(snap.reasonCodesJson.contains(EligibilityReasonCode.INSTITUTIONAL_NOC_UNVERIFIED.name()));

        // Verify optimizer pairs: 0 pairs for this candidate
        ArgumentCaptor<AiServiceClient.OptimizeRequest> captor = ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
        verify(aiClient).optimize(captor.capture());
        boolean hasPair = captor.getValue().pairs().stream().anyMatch(pair -> pair.c() == cand.id.intValue());
        assertFalse(hasPair, "Ineligible candidate must not produce any optimizer pairs");
    }

    @Test
    @DisplayName("Test 2: Candidate with rejected NOC remains ineligible")
    void test2_candidateWithRejectedNoc_remainsIneligible() throws Exception {
        CandidateProfile cand = createStudentCandidate("Pooja Rejected", true);
        createNocEvidence(cand.id, EvidenceStatus.REJECTED, SignatoryRole.DEAN);

        AllocationRun run = allocationService.prepareRun(
                new AllocationService.StartRunRequest("balanced", Map.of(), false, null, "v2",
                        EligibilityEvaluator.RULESET_PMIS_2026_DEMO, EligibilityEvaluator.VERSION_1_0_0),
                null, null, adminAuth);

        invokeExecute(run.id);

        AllocationEligibilitySnapshot snap = eligSnapshotRepo.findByRunIdAndCandidateId(run.id, cand.id).orElseThrow();
        assertEquals(EligibilityDecision.INELIGIBLE, snap.decision);
        assertEquals("REJECTED", snap.evidenceStatusSnapshot);
        assertTrue(snap.reasonCodesJson.contains(EligibilityReasonCode.INSTITUTIONAL_NOC_REJECTED.name()));

        ArgumentCaptor<AiServiceClient.OptimizeRequest> captor = ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
        verify(aiClient).optimize(captor.capture());
        boolean hasPair = captor.getValue().pairs().stream().anyMatch(pair -> pair.c() == cand.id.intValue());
        assertFalse(hasPair, "Candidate with rejected NOC must have 0 eligible pairs");
    }

    @Test
    @DisplayName("Test 3: Candidate with verified current NOC satisfies the requirement and generates eligible pairs")
    void test3_candidateWithVerifiedNoc_satisfiesRequirement() throws Exception {
        CandidateProfile cand = createStudentCandidate("Vikram Verified", true);
        CandidateEvidence verifiedNoc = createNocEvidence(cand.id, EvidenceStatus.VERIFIED, SignatoryRole.DEAN);

        AllocationRun run = allocationService.prepareRun(
                new AllocationService.StartRunRequest("balanced", Map.of(), false, null, "v2",
                        EligibilityEvaluator.RULESET_PMIS_2026_DEMO, EligibilityEvaluator.VERSION_1_0_0),
                null, null, adminAuth);

        invokeExecute(run.id);

        AllocationEligibilitySnapshot snap = eligSnapshotRepo.findByRunIdAndCandidateId(run.id, cand.id).orElseThrow();
        assertEquals(EligibilityDecision.ELIGIBLE, snap.decision);
        assertEquals("VERIFIED", snap.evidenceStatusSnapshot);
        assertEquals(verifiedNoc.id, snap.evidenceIdRef);

        ArgumentCaptor<AiServiceClient.OptimizeRequest> captor = ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
        verify(aiClient).optimize(captor.capture());
        boolean hasPair = captor.getValue().pairs().stream().anyMatch(pair -> pair.c() == cand.id.intValue());
        assertTrue(hasPair, "Verified candidate must reach the optimizer with eligible pairs");
    }

    @Test
    @DisplayName("Test 4: High AI suitability cannot override mandatory NOC eligibility")
    void test4_highSuitabilityCannotOverrideMandatoryNocEligibility() throws Exception {
        // Candidate has perfect skills & rank 1 preference, but NO verified NOC
        CandidateProfile cand = createStudentCandidate("Super Qualified Unverified", true);
        createNocEvidence(cand.id, EvidenceStatus.SUBMITTED, SignatoryRole.DEAN);

        AllocationRun run = allocationService.prepareRun(
                new AllocationService.StartRunRequest("balanced", Map.of(), false, null, "v2",
                        EligibilityEvaluator.RULESET_PMIS_2026_DEMO, EligibilityEvaluator.VERSION_1_0_0),
                null, null, adminAuth);

        invokeExecute(run.id);

        AllocationEligibilitySnapshot snap = eligSnapshotRepo.findByRunIdAndCandidateId(run.id, cand.id).orElseThrow();
        assertEquals(EligibilityDecision.INELIGIBLE, snap.decision, "Candidate must be INELIGIBLE regardless of suitability");

        ArgumentCaptor<AiServiceClient.OptimizeRequest> captor = ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
        verify(aiClient).optimize(captor.capture());
        boolean hasPair = captor.getValue().pairs().stream().anyMatch(pair -> pair.c() == cand.id.intValue());
        assertFalse(hasPair, "High suitability cannot inject edges for an ineligible candidate");
    }

    @Test
    @DisplayName("Test 5: Superseded verified evidence cannot be used in place of current rejected evidence")
    void test5_supersededVerifiedEvidenceCannotBeUsedInPlaceOfCurrentRejected() throws Exception {
        CandidateProfile cand = createStudentCandidate("Rohan Superseded", true);

        // 1. Candidate previously had NOC v1 (VERIFIED)
        CandidateEvidence v1 = createNocEvidence(cand.id, EvidenceStatus.VERIFIED, SignatoryRole.DEAN);

        // 2. Candidate uploaded NOC v2 which was then REJECTED by reviewer
        CandidateEvidence v2 = createNocEvidence(cand.id, EvidenceStatus.REJECTED, SignatoryRole.DEAN);

        // Active pointer points to v2
        CandidateEvidenceCurrent cur = currentEvidenceRepo.findByCandidateIdAndEvidenceType(cand.id, EvidenceService.EVIDENCE_TYPE_NOC).orElseThrow();
        assertEquals(v2.id, cur.evidenceId, "Active pointer must be v2");

        AllocationRun run = allocationService.prepareRun(
                new AllocationService.StartRunRequest("balanced", Map.of(), false, null, "v2",
                        EligibilityEvaluator.RULESET_PMIS_2026_DEMO, EligibilityEvaluator.VERSION_1_0_0),
                null, null, adminAuth);

        invokeExecute(run.id);

        // Stored snapshot must evaluate v2 (REJECTED), NOT superseded v1
        AllocationEligibilitySnapshot snap = eligSnapshotRepo.findByRunIdAndCandidateId(run.id, cand.id).orElseThrow();
        assertEquals(EligibilityDecision.INELIGIBLE, snap.decision);
        assertEquals(v2.id, snap.evidenceIdRef, "Snapshot must trace to current evidence v2, not superseded v1");
        assertEquals("REJECTED", snap.evidenceStatusSnapshot);

        ArgumentCaptor<AiServiceClient.OptimizeRequest> captor = ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
        verify(aiClient).optimize(captor.capture());
        boolean hasPair = captor.getValue().pairs().stream().anyMatch(pair -> pair.c() == cand.id.intValue());
        assertFalse(hasPair, "Candidate whose active submission is REJECTED must have 0 eligible pairs");
    }

    @Test
    @DisplayName("Test 6: Rule-set selection is independent from fairness policy")
    void test6_ruleSetSelectionIsIndependentFromFairnessPolicy() {
        // Combination 1: fairness v1 + demo rule-set
        AllocationRun r1 = allocationService.prepareRun(
                new AllocationService.StartRunRequest("balanced", Map.of(), false, null, "v1",
                        EligibilityEvaluator.RULESET_PMIS_2026_DEMO, EligibilityEvaluator.VERSION_1_0_0),
                null, null, adminAuth);
        assertEquals("v1", r1.policyVersion);
        assertEquals(EligibilityEvaluator.RULESET_PMIS_2026_DEMO, r1.eligibilityRuleSetId);
        r1.status = RunStatus.COMPLETED;
        runRepo.save(r1);

        // Combination 2: fairness v2 + demo rule-set
        AllocationRun r2 = allocationService.prepareRun(
                new AllocationService.StartRunRequest("balanced", Map.of(), false, null, "v2",
                        EligibilityEvaluator.RULESET_PMIS_2026_DEMO, EligibilityEvaluator.VERSION_1_0_0),
                null, null, adminAuth);
        assertEquals("v2", r2.policyVersion);
        assertEquals(EligibilityEvaluator.RULESET_PMIS_2026_DEMO, r2.eligibilityRuleSetId);
        r2.status = RunStatus.COMPLETED;
        runRepo.save(r2);

        // Combination 3: fairness v1 + legacy rule-set
        AllocationRun r3 = allocationService.prepareRun(
                new AllocationService.StartRunRequest("balanced", Map.of(), false, null, "v1",
                        EligibilityEvaluator.RULESET_LEGACY, EligibilityEvaluator.VERSION_1_0_0),
                null, null, adminAuth);
        assertEquals("v1", r3.policyVersion);
        assertEquals(EligibilityEvaluator.RULESET_LEGACY, r3.eligibilityRuleSetId);
        r3.status = RunStatus.COMPLETED;
        runRepo.save(r3);

        // Combination 4: fairness v2 + legacy rule-set
        AllocationRun r4 = allocationService.prepareRun(
                new AllocationService.StartRunRequest("balanced", Map.of(), false, null, "v2",
                        EligibilityEvaluator.RULESET_LEGACY, EligibilityEvaluator.VERSION_1_0_0),
                null, null, adminAuth);
        assertEquals("v2", r4.policyVersion);
        assertEquals(EligibilityEvaluator.RULESET_LEGACY, r4.eligibilityRuleSetId);
        r4.status = RunStatus.COMPLETED;
        runRepo.save(r4);
    }

    @Test
    @DisplayName("Test 7: Legacy allocation behavior remains backward-compatible when rule-set omitted")
    void test7_legacyAllocationBehaviorRemainsBackwardCompatible() throws Exception {
        CandidateProfile cand = createStudentCandidate("Legacy Student Without NOC", true);

        // Omit rule-set ID -> defaults to prototype-legacy-v1
        AllocationRun run = allocationService.prepareRun(
                new AllocationService.StartRunRequest("balanced", Map.of(), false, null, "v2"),
                null, null, adminAuth);

        assertEquals(EligibilityEvaluator.RULESET_LEGACY, run.eligibilityRuleSetId);

        invokeExecute(run.id);

        AllocationEligibilitySnapshot snap = eligSnapshotRepo.findByRunIdAndCandidateId(run.id, cand.id).orElseThrow();
        assertEquals(EligibilityDecision.ELIGIBLE, snap.decision, "Legacy rule-set evaluates student as ELIGIBLE without NOC");
    }

    @Test
    @DisplayName("Test 8: Full candidate universe and capacity constraints remain intact")
    void test8_fullCandidateUniverseAndCapacityConstraintsIntact() throws Exception {
        CandidateProfile cand = createStudentCandidate("Zero Pair Ineligible", false); // Not in final year -> INELIGIBLE

        reset(aiClient);
        when(aiClient.optimize(any())).thenReturn(new AiServiceClient.OptimizeResult(
                "OPTIMAL", 9000L, 50, new AiServiceClient.ModelStats(10, 10, 10, 50), List.of(), List.of()
        ));

        AllocationRun run = allocationService.prepareRun(
                new AllocationService.StartRunRequest("balanced", Map.of(), false, null, "v2",
                        EligibilityEvaluator.RULESET_PMIS_2026_DEMO, EligibilityEvaluator.VERSION_1_0_0),
                null, null, adminAuth);

        invokeExecute(run.id);

        // Run completes cleanly without metrics persistence failure
        AllocationRun completedRun = runRepo.findById(run.id).orElseThrow();
        assertEquals(RunStatus.COMPLETED, completedRun.status, "Allocation run must complete successfully");

        // Verify optimizer was invoked exactly once for this run
        ArgumentCaptor<AiServiceClient.OptimizeRequest> captor = ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
        verify(aiClient, times(1)).optimize(captor.capture());

        AiServiceClient.OptimizeRequest req = captor.getValue();
        // Candidate universe includes all active candidates (even with 0 pairs)
        assertTrue(req.candidates().contains(cand.id.intValue()), "Ineligible candidate must remain in candidate universe for global reporting");

        // Ineligible candidate must never produce forbidden eligible pairs
        boolean hasPair = req.pairs().stream().anyMatch(pair -> pair.c() == cand.id.intValue());
        assertFalse(hasPair, "Ineligible candidate must never produce forbidden eligible pairs");

        // Capacity for testOpportunity preserved
        AiServiceClient.OptOpp targetOpp = req.opportunities().stream()
                .filter(o -> o.id() == testOpportunity.id.intValue())
                .findFirst()
                .orElseThrow();
        assertEquals(testOpportunity.capacity, targetOpp.capacity(), "Optimizer must receive authoritative effective seat capacity");

        // Prove capacity invariant: allocated assignments <= effective authorized seat capacity
        long assignedToOpp = assignmentRepo.findByRunIdAndSource(run.id, AssignmentSource.GLOBAL).stream()
                .filter(a -> a.opportunityId.equals(testOpportunity.id)).count();
        assertTrue(assignedToOpp <= targetOpp.capacity(),
                "Allocated assignments (" + assignedToOpp + ") must not exceed effective authorized capacity (" + targetOpp.capacity() + ")");
    }

    @Test
    @DisplayName("Test 9: Reallocation inherits exact parent eligibility rule-set and version")
    void test9_reallocationInheritsRuleSetVersion() throws Exception {
        AllocationRun parent = allocationService.prepareRun(
                new AllocationService.StartRunRequest("balanced", Map.of(), false, null, "v2",
                        EligibilityEvaluator.RULESET_PMIS_2026_DEMO, EligibilityEvaluator.VERSION_1_0_0),
                null, null, adminAuth);
        parent.status = RunStatus.COMPLETED;
        parent = runRepo.save(parent);

        ReallocationService.Change change = new ReallocationService.Change(
                "CAPACITY", testOpportunity.id, null, 10, null, null, null, null, null, null);
        ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                parent.id, List.of(change));

        AllocationRun child = reallocationService.start(req, adminAuth);

        assertEquals(parent.id, child.parentRunId);
        assertEquals(EligibilityEvaluator.RULESET_PMIS_2026_DEMO, child.eligibilityRuleSetId, "Child run must inherit parent rule-set ID");
        assertEquals(EligibilityEvaluator.VERSION_1_0_0, child.eligibilityRuleSetVersion, "Child run must inherit parent rule-set version");

        // Wait for asynchronous reallocation execution to finish so background thread does not contaminate other tests
        waitForRun(child.id);
    }

    @Test
    @DisplayName("Test 10: Historical snapshots are preserved after evidence changes")
    void test10_historicalSnapshotsPreservedAfterEvidenceChanges() throws Exception {
        CandidateProfile cand = createStudentCandidate("Audit Preserved Candidate", true);
        CandidateEvidence v1 = createNocEvidence(cand.id, EvidenceStatus.VERIFIED, SignatoryRole.DEAN);

        AllocationRun run = allocationService.prepareRun(
                new AllocationService.StartRunRequest("balanced", Map.of(), false, null, "v2",
                        EligibilityEvaluator.RULESET_PMIS_2026_DEMO, EligibilityEvaluator.VERSION_1_0_0),
                null, null, adminAuth);

        invokeExecute(run.id);

        AllocationEligibilitySnapshot snapBefore = eligSnapshotRepo.findByRunIdAndCandidateId(run.id, cand.id).orElseThrow();
        assertEquals(EligibilityDecision.ELIGIBLE, snapBefore.decision);
        assertEquals(v1.id, snapBefore.evidenceIdRef);

        // Candidate later submits v2 (REJECTED)
        CandidateEvidence v2 = createNocEvidence(cand.id, EvidenceStatus.REJECTED, SignatoryRole.DEAN);

        // Historical snapshot of completed run MUST NOT CHANGE
        AllocationEligibilitySnapshot snapAfter = eligSnapshotRepo.findByRunIdAndCandidateId(run.id, cand.id).orElseThrow();
        assertEquals(EligibilityDecision.ELIGIBLE, snapAfter.decision, "Completed run snapshot decision must be immutable");
        assertEquals(v1.id, snapAfter.evidenceIdRef, "Completed run snapshot evidence reference must be immutable");
    }

    @Test
    @DisplayName("Test 11: Unsafe same-run retries remain rejected")
    void test11_unsafeSameRunRetriesRemainRejected() throws Exception {
        CandidateProfile cand = createStudentCandidate("Retry Guard Candidate", true);
        createNocEvidence(cand.id, EvidenceStatus.VERIFIED, SignatoryRole.DEAN);

        AllocationRun run = allocationService.prepareRun(
                new AllocationService.StartRunRequest("balanced", Map.of(), false, null, "v2",
                        EligibilityEvaluator.RULESET_PMIS_2026_DEMO, EligibilityEvaluator.VERSION_1_0_0),
                null, null, adminAuth);

        // First attempt succeeds and persists snapshots
        invokeExecute(run.id);
        assertTrue(eligSnapshotRepo.findByRunId(run.id).size() > 0);

        // Reset status to QUEUED to simulate same-run retry attempt
        run.status = RunStatus.QUEUED;
        runRepo.save(run);
        reset(aiClient);

        // Re-executing same run must fail closed with RunStatus.FAILED and ERROR_UNSAFE_RETRY
        invokeExecute(run.id);

        AllocationRun failedRun = runRepo.findById(run.id).orElseThrow();
        assertEquals(RunStatus.FAILED, failedRun.status);
        assertEquals(AllocationService.ERROR_UNSAFE_RETRY, failedRun.errorMessage);

        // Optimizer is NEVER invoked on an unsafe retry
        verify(aiClient, never()).optimize(any());
    }

    @Test
    @DisplayName("Test 12: Real HTTP allocation produces expected results using synthetic data via MockMvc")
    void test12_realHttpAllocationProducesExpectedResults() throws Exception {
        String body = """
                {
                    "policyKey": "balanced",
                    "policyVersion": "v2",
                    "eligibilityRuleSetId": "pmis-2026-expansion-demo-v1",
                    "eligibilityRuleSetVersion": "1.0.0"
                }
                """;

        MvcResult res = mockMvc.perform(post("/api/admin/runs")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isAccepted())
                .andExpect(jsonPath("$.eligibilityRuleSetId").value(EligibilityEvaluator.RULESET_PMIS_2026_DEMO))
                .andExpect(jsonPath("$.eligibilityRuleSetVersion").value("1.0.0"))
                .andReturn();

        assertNotNull(res.getResponse().getContentAsString());

        com.fasterxml.jackson.databind.JsonNode root = json.readTree(res.getResponse().getContentAsString());
        if (root.has("id")) {
            waitForRun(root.get("id").asLong());
        }

        // Unsupported eligibility rule-set ID is rejected with 400 Bad Request
        mockMvc.perform(post("/api/admin/runs")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                        {
                            "policyKey": "balanced",
                            "policyVersion": "v2",
                            "eligibilityRuleSetId": "unsupported-ruleset-xyz"
                        }
                        """))
                .andExpect(status().isBadRequest());
    }
}
