package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.lang.reflect.Method;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.fasterxml.jackson.databind.ObjectMapper;

import in.nextalloc.ai.AiServiceClient;
import in.nextalloc.common.Weights;
import in.nextalloc.config.AppProperties;
import in.nextalloc.domain.*;
import in.nextalloc.domain.enums.*;
import in.nextalloc.repo.*;
import in.nextalloc.security.AuthUser;
import in.nextalloc.service.SuitabilityService.EligiblePair;
import in.nextalloc.service.SuitabilityService.PairScore;

/**
 * Quality Gate Regression Tests for Patch 1: Full Candidate Universe Correctness (DEF-001).
 *
 * <p>Verifies that both AllocationService and PolicyService transmit the complete
 * effective candidate cohort to the AI optimizer microservice (AiServiceClient.optimize),
 * including applicants who have zero eligible pairs.
 *
 * <p>Contains:
 * 1. Helper unit tests for toCandidateIds() static seams.
 * 2. True behavioral boundary regression tests capturing AiServiceClient.OptimizeRequest
 *    via Mockito ArgumentCaptor across the actual service pipelines.
 */
@DisplayName("Patch 1 — Candidate Universe & Optimizer Request Boundary Tests")
class CandidateUniverseTest {

    private static CandidateProfile activeProfile(long id, String name, LocationType loc) {
        CandidateProfile p = new CandidateProfile();
        p.id = id;
        p.userId = id + 1000;
        p.fullName = name;
        p.qualification = Qualification.BACHELORS;
        p.candidateState = CandidateState.ACTIVE;
        p.candidateStatus = CandidateStatus.STUDENT;
        p.locationType = loc;
        p.state = "Delhi";
        p.experienceYears = 0.0;
        return p;
    }

    private static Opportunity activeOpp(long id, String title, int capacity) {
        Opportunity o = new Opportunity();
        o.id = id;
        o.title = title;
        o.status = OppStatus.ACTIVE;
        o.minQualification = Qualification.BACHELORS;
        o.capacity = capacity;
        o.sector = Sector.SOFTWARE_IT;
        o.state = "Delhi";
        return o;
    }

    private static EligiblePair samplePair(long candidateId, long opportunityId) {
        PairScore score = new PairScore(80, 85, 70, 90, 100, 60, 30, 80.0);
        return new EligiblePair(candidateId, opportunityId, score, 1);
    }

    // ==================================================================
    // PART 1: Helper Unit Tests (Seams)
    // ==================================================================

    @Nested
    @DisplayName("1. Helper Unit Tests — toCandidateIds()")
    class HelperUnitTests {

        @Test
        @DisplayName("H1 — AllocationService: unmatchable candidate included")
        void allocUnmatchableCandidateIncluded() {
            List<CandidateProfile> cohort = List.of(
                    activeProfile(1L, "Alice", LocationType.URBAN),
                    activeProfile(2L, "Bob", LocationType.RURAL),
                    activeProfile(3L, "Charlie", LocationType.URBAN)
            );
            List<Integer> ids = AllocationService.toCandidateIds(cohort);
            assertEquals(List.of(1, 2, 3), ids);
        }

        @Test
        @DisplayName("H2 — AllocationService: sorted complete order")
        void allocSortedOrder() {
            List<CandidateProfile> cohort = List.of(
                    activeProfile(5L, "E", LocationType.URBAN),
                    activeProfile(2L, "B", LocationType.RURAL),
                    activeProfile(8L, "H", LocationType.URBAN)
            );
            List<Integer> ids = AllocationService.toCandidateIds(cohort);
            assertEquals(List.of(2, 5, 8), ids);
        }

        @Test
        @DisplayName("H3 — AllocationService: empty cohort returns empty list")
        void allocEmptyCohort() {
            List<Integer> ids = AllocationService.toCandidateIds(List.of());
            assertNotNull(ids);
            assertTrue(ids.isEmpty());
        }

        @Test
        @DisplayName("H4 — PolicyService: unmatchable candidate included")
        void policyUnmatchableCandidateIncluded() {
            List<CandidateProfile> cohort = List.of(
                    activeProfile(1L, "Alice", LocationType.URBAN),
                    activeProfile(2L, "Bob", LocationType.RURAL),
                    activeProfile(3L, "Charlie", LocationType.URBAN)
            );
            List<Integer> ids = PolicyService.toCandidateIds(cohort);
            assertEquals(List.of(1, 2, 3), ids);
        }

        @Test
        @DisplayName("H5 — PolicyService: empty cohort returns empty list")
        void policyEmptyCohort() {
            List<Integer> ids = PolicyService.toCandidateIds(List.of());
            assertNotNull(ids);
            assertTrue(ids.isEmpty());
        }

        @Test
        @DisplayName("H6 — Invariant: both services produce identical candidate lists")
        void crossServiceInvariant() {
            List<CandidateProfile> cohort = List.of(
                    activeProfile(10L, "Ten", LocationType.URBAN),
                    activeProfile(20L, "Twenty", LocationType.RURAL)
            );
            assertEquals(AllocationService.toCandidateIds(cohort), PolicyService.toCandidateIds(cohort));
        }
    }

    // ==================================================================
    // PART 2: AllocationService Request Boundary Tests (ArgumentCaptor)
    // ==================================================================

    @Nested
    @DisplayName("2. AllocationService — Real Optimizer Request Boundary Tests")
    class AllocationServiceBoundaryTests {

        private AllocationRunRepository runs;
        private DatasetSnapshotRepository snapshots;
        private CandidateProfileRepository profiles;
        private CandidateSkillRepository skills;
        private CandidateInterestRepository interests;
        private CandidatePreferenceRepository preferences;
        private OpportunityRepository opportunities;
        private OpportunitySkillRepository oppSkills;
        private AssignmentRepository assignments;
        private PolicyPresetRepository presets;
        private AiServiceClient ai;
        private MetricsService metrics;
        private AuditService audit;
        private ScenarioService scenarios;
        private SuitabilityService suitability;
        private ObjectMapper json;
        private AppProperties props;
        private AllocationService allocationService;

        @BeforeEach
        void setUp() {
            runs = mock(AllocationRunRepository.class);
            snapshots = mock(DatasetSnapshotRepository.class);
            profiles = mock(CandidateProfileRepository.class);
            skills = mock(CandidateSkillRepository.class);
            interests = mock(CandidateInterestRepository.class);
            preferences = mock(CandidatePreferenceRepository.class);
            opportunities = mock(OpportunityRepository.class);
            oppSkills = mock(OpportunitySkillRepository.class);
            assignments = mock(AssignmentRepository.class);
            presets = mock(PolicyPresetRepository.class);
            ai = mock(AiServiceClient.class);
            metrics = mock(MetricsService.class);
            audit = mock(AuditService.class);
            scenarios = mock(ScenarioService.class);
            suitability = mock(SuitabilityService.class);
            json = new ObjectMapper();
            props = new AppProperties();

            allocationService = new AllocationService(
                    runs, snapshots, profiles, skills, interests, preferences,
                    opportunities, oppSkills, assignments, presets, ai,
                    metrics, audit, scenarios, suitability, json, props);
        }

        private void invokeExecute(Long runId) throws Exception {
            Method m = AllocationService.class.getDeclaredMethod("execute", Long.class);
            m.setAccessible(true);
            m.invoke(allocationService, runId);
        }

        @Test
        @DisplayName("Test A — Full Coverage: Candidate C (0 pairs) is in candidates payload and NO fake pair invented")
        void testA_unmatchableCandidatePreservedInRequestUnderFullCoverage() throws Exception {
            AllocationRun run = new AllocationRun();
            run.id = 100L;
            run.runCode = "RUN-TEST-001";
            run.number = 1;
            run.scenario = ScenarioKey.STANDARD_SHOWCASE;
            run.fullCoverage = true;
            run.weightsJson = Weights.defaultBalanced().toJson(json);

            when(runs.findById(100L)).thenReturn(Optional.of(run));
            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

            CandidateProfile candA = activeProfile(1L, "Alice", LocationType.URBAN);
            CandidateProfile candB = activeProfile(2L, "Bob", LocationType.RURAL);
            CandidateProfile candC = activeProfile(3L, "Charlie", LocationType.URBAN); // Unmatchable
            when(profiles.findAllByCandidateState(CandidateState.ACTIVE)).thenReturn(List.of(candA, candB, candC));

            Opportunity oppX = activeOpp(10L, "Dev Intern", 1);
            Opportunity oppY = activeOpp(11L, "QA Intern", 1);
            when(opportunities.findAllByStatus(OppStatus.ACTIVE)).thenReturn(List.of(oppX, oppY));

            when(skills.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(interests.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(preferences.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(oppSkills.findByOpportunityIdIn(anyList())).thenReturn(Collections.emptyList());

            // Cand A eligible for oppX, Cand B eligible for oppY, Cand C ineligible for ALL
            when(suitability.check(eq(candA), any(), eq(oppX), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(true, List.of()));
            when(suitability.check(eq(candA), any(), eq(oppY), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(false, List.of("Role mismatch")));

            when(suitability.check(eq(candB), any(), eq(oppX), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(false, List.of("Role mismatch")));
            when(suitability.check(eq(candB), any(), eq(oppY), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(true, List.of()));

            when(suitability.check(eq(candC), any(), any(), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(false, List.of("Degree mismatch")));

            when(suitability.score(any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(new PairScore(80, 80, 80, 80, 80, 80, 80, 80.0));

            // Return INFEASIBLE from solver to trigger clean termination path
            when(ai.optimize(any())).thenReturn(new AiServiceClient.OptimizeResult(
                    "INFEASIBLE", 0, 15, new AiServiceClient.ModelStats(2, 2, 2, 15), List.of(), List.of()));

            // Execute the production service pipeline
            invokeExecute(100L);

            // Capture the actual payload sent to the AI microservice
            ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                    ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
            verify(ai, times(1)).optimize(captor.capture());

            AiServiceClient.OptimizeRequest captured = captor.getValue();
            assertNotNull(captured);

            // 1. All candidates A (1), B (2), and C (3) must be in the candidates list
            assertEquals(List.of(1, 2, 3), captured.candidates(),
                    "The candidate universe must contain Candidate C (id=3) despite having zero eligible pairs");

            // 2. Pairs must contain only valid eligible pairs (A->10, B->11) and NO invented pair for C
            assertEquals(2, captured.pairs().size(), "Only genuine eligible pairs should be passed");
            assertTrue(captured.pairs().stream().anyMatch(p -> p.c() == 1 && p.i() == 10));
            assertTrue(captured.pairs().stream().anyMatch(p -> p.c() == 2 && p.i() == 11));
            assertFalse(captured.pairs().stream().anyMatch(p -> p.c() == 3),
                    "No invented pair should exist for Candidate C");

            // 3. Full Coverage policy flag must be true
            assertTrue(captured.policy().fullCoverage(), "fullCoverage must be preserved as true");
        }

        @Test
        @DisplayName("Test B — Full Coverage False: Candidate C is still present in candidate universe")
        void testB_unmatchableCandidatePreservedWhenFullCoverageFalse() throws Exception {
            AllocationRun run = new AllocationRun();
            run.id = 101L;
            run.runCode = "RUN-TEST-002";
            run.number = 2;
            run.scenario = ScenarioKey.STANDARD_SHOWCASE;
            run.fullCoverage = false;
            run.weightsJson = Weights.defaultBalanced().toJson(json);

            when(runs.findById(101L)).thenReturn(Optional.of(run));
            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

            CandidateProfile candA = activeProfile(1L, "Alice", LocationType.URBAN);
            CandidateProfile candC = activeProfile(3L, "Charlie", LocationType.URBAN);
            when(profiles.findAllByCandidateState(CandidateState.ACTIVE)).thenReturn(List.of(candA, candC));

            Opportunity oppX = activeOpp(10L, "Dev Intern", 1);
            when(opportunities.findAllByStatus(OppStatus.ACTIVE)).thenReturn(List.of(oppX));

            when(suitability.check(eq(candA), any(), eq(oppX), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(true, List.of()));
            when(suitability.check(eq(candC), any(), eq(oppX), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(false, List.of("Ineligible")));

            when(suitability.score(any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(new PairScore(80, 80, 80, 80, 80, 80, 80, 80.0));

            when(ai.optimize(any())).thenReturn(new AiServiceClient.OptimizeResult(
                    "INFEASIBLE", 0, 10, new AiServiceClient.ModelStats(1, 1, 1, 10), List.of(), List.of()));

            invokeExecute(101L);

            ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                    ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
            verify(ai).optimize(captor.capture());

            AiServiceClient.OptimizeRequest captured = captor.getValue();
            assertEquals(List.of(1, 3), captured.candidates(),
                    "All active candidates must be represented even when fullCoverage is false");
            assertFalse(captured.policy().fullCoverage());
        }

        @Test
        @DisplayName("Test C — Withdrawn Candidate: Excluded from effective candidate cohort")
        void testC_withdrawnCandidateExcludedFromPayload() throws Exception {
            AllocationRun run = new AllocationRun();
            run.id = 102L;
            run.runCode = "RUN-TEST-003";
            run.number = 3;
            run.scenario = ScenarioKey.STANDARD_SHOWCASE;
            run.fullCoverage = true;
            run.weightsJson = Weights.defaultBalanced().toJson(json);
            // Operational override withdrawing candidate 2
            run.overridesJson = "{\"withdrawnCandidates\":[2]}";

            when(runs.findById(102L)).thenReturn(Optional.of(run));
            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

            CandidateProfile candA = activeProfile(1L, "Alice", LocationType.URBAN);
            CandidateProfile candB = activeProfile(2L, "Bob", LocationType.RURAL); // explicitly withdrawn
            CandidateProfile candC = activeProfile(3L, "Charlie", LocationType.URBAN);
            when(profiles.findAllByCandidateState(CandidateState.ACTIVE)).thenReturn(List.of(candA, candB, candC));

            Opportunity oppX = activeOpp(10L, "Dev Intern", 1);
            when(opportunities.findAllByStatus(OppStatus.ACTIVE)).thenReturn(List.of(oppX));

            when(suitability.check(any(), any(), any(), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(true, List.of()));
            when(suitability.score(any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(new PairScore(80, 80, 80, 80, 80, 80, 80, 80.0));

            when(ai.optimize(any())).thenReturn(new AiServiceClient.OptimizeResult(
                    "INFEASIBLE", 0, 10, new AiServiceClient.ModelStats(2, 2, 2, 10), List.of(), List.of()));

            invokeExecute(102L);

            ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                    ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
            verify(ai).optimize(captor.capture());

            AiServiceClient.OptimizeRequest captured = captor.getValue();
            assertEquals(List.of(1, 3), captured.candidates(),
                    "Candidate 2 was withdrawn and must not appear in the candidate universe");
            assertFalse(captured.candidates().contains(2));
        }

        @Test
        @DisplayName("Test D — Empty Pairs: Cohort still passed in full to AI microservice")
        void testD_emptyPairsStillPassesCohort() throws Exception {
            AllocationRun run = new AllocationRun();
            run.id = 103L;
            run.runCode = "RUN-TEST-004";
            run.number = 4;
            run.scenario = ScenarioKey.STANDARD_SHOWCASE;
            run.fullCoverage = true;
            run.weightsJson = Weights.defaultBalanced().toJson(json);

            when(runs.findById(103L)).thenReturn(Optional.of(run));
            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

            CandidateProfile candA = activeProfile(1L, "Alice", LocationType.URBAN);
            CandidateProfile candB = activeProfile(2L, "Bob", LocationType.RURAL);
            when(profiles.findAllByCandidateState(CandidateState.ACTIVE)).thenReturn(List.of(candA, candB));

            Opportunity oppX = activeOpp(10L, "Dev Intern", 1);
            when(opportunities.findAllByStatus(OppStatus.ACTIVE)).thenReturn(List.of(oppX));

            // Nobody is eligible
            when(suitability.check(any(), any(), any(), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(false, List.of("No match")));

            when(ai.optimize(any())).thenReturn(new AiServiceClient.OptimizeResult(
                    "INFEASIBLE", 0, 10, new AiServiceClient.ModelStats(0, 0, 0, 10), List.of(), List.of()));

            invokeExecute(103L);

            ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                    ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
            verify(ai).optimize(captor.capture());

            AiServiceClient.OptimizeRequest captured = captor.getValue();
            assertEquals(List.of(1, 2), captured.candidates(),
                    "Complete candidate cohort must be passed even with 0 eligible pairs");
            assertTrue(captured.pairs().isEmpty(), "Pairs list must be empty");
        }
    }

    // ==================================================================
    // PART 3: PolicyService Request Boundary Tests (ArgumentCaptor)
    // ==================================================================

    @Nested
    @DisplayName("3. PolicyService — Real Simulation Request Boundary Tests")
    class PolicyServiceBoundaryTests {

        private AllocationRunRepository runs;
        private DatasetSnapshotRepository snapshots;
        private CandidateProfileRepository profiles;
        private CandidateSkillRepository skills;
        private CandidateInterestRepository interests;
        private CandidatePreferenceRepository preferences;
        private OpportunityRepository opportunities;
        private OpportunitySkillRepository oppSkills;
        private AssignmentRepository assignments;
        private SimulationRunRepository sims;
        private PolicyPresetRepository presets;
        private AiServiceClient ai;
        private SuitabilityService suitability;
        private AuditService audit;
        private ObjectMapper json;
        private PolicyService policyService;

        @BeforeEach
        void setUp() {
            runs = mock(AllocationRunRepository.class);
            snapshots = mock(DatasetSnapshotRepository.class);
            profiles = mock(CandidateProfileRepository.class);
            skills = mock(CandidateSkillRepository.class);
            interests = mock(CandidateInterestRepository.class);
            preferences = mock(CandidatePreferenceRepository.class);
            opportunities = mock(OpportunityRepository.class);
            oppSkills = mock(OpportunitySkillRepository.class);
            assignments = mock(AssignmentRepository.class);
            sims = mock(SimulationRunRepository.class);
            presets = mock(PolicyPresetRepository.class);
            ai = mock(AiServiceClient.class);
            suitability = mock(SuitabilityService.class);
            audit = mock(AuditService.class);
            json = new ObjectMapper();

            policyService = new PolicyService(
                    runs, snapshots, profiles, skills, interests, preferences,
                    opportunities, oppSkills, assignments, sims, presets,
                    ai, suitability, audit, json);
        }

        private void invokeRunSimulation(Long simId, AllocationRun base, Weights w,
                                         boolean fullCoverage, Integer floor, AuthUser actor) throws Exception {
            Method m = PolicyService.class.getDeclaredMethod("runSimulation",
                    Long.class, AllocationRun.class, Weights.class, boolean.class, Integer.class, AuthUser.class);
            m.setAccessible(true);
            m.invoke(policyService, simId, base, w, fullCoverage, floor, actor);
        }

        @Test
        @DisplayName("Test Sim A — Policy Lab Simulation: Unmatchable Candidate C is captured in request payload")
        void testSimA_simulationRequestCapturesUnmatchableCandidate() throws Exception {
            SimulationRun sim = new SimulationRun();
            sim.id = 200L;
            sim.baseRunId = 1L;
            when(sims.findById(200L)).thenReturn(Optional.of(sim));
            when(sims.save(any(SimulationRun.class))).thenAnswer(i -> i.getArgument(0));

            AllocationRun base = new AllocationRun();
            base.id = 1L;
            base.number = 1;

            CandidateProfile candA = activeProfile(1L, "Alice", LocationType.URBAN);
            CandidateProfile candB = activeProfile(2L, "Bob", LocationType.RURAL);
            CandidateProfile candC = activeProfile(3L, "Charlie", LocationType.URBAN); // Ineligible
            when(profiles.findAllByCandidateState(CandidateState.ACTIVE)).thenReturn(List.of(candA, candB, candC));

            Opportunity opp1 = activeOpp(10L, "Dev Intern", 1);
            when(opportunities.findAllByStatus(OppStatus.ACTIVE)).thenReturn(List.of(opp1));

            when(suitability.check(eq(candA), any(), eq(opp1), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(true, List.of()));
            when(suitability.check(eq(candB), any(), eq(opp1), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(true, List.of()));
            when(suitability.check(eq(candC), any(), eq(opp1), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(false, List.of("Unqualified")));

            when(suitability.score(any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(new PairScore(80, 80, 80, 80, 80, 80, 80, 80.0));

            when(ai.optimize(any())).thenReturn(new AiServiceClient.OptimizeResult(
                    "INFEASIBLE", 0, 10, new AiServiceClient.ModelStats(2, 2, 2, 10), List.of(), List.of()));

            Weights w = Weights.defaultBalanced();
            invokeRunSimulation(200L, base, w, true, 0, null);

            ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                    ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
            verify(ai, times(1)).optimize(captor.capture());

            AiServiceClient.OptimizeRequest captured = captor.getValue();
            assertNotNull(captured);

            // Candidates payload must contain all 3 active candidates
            assertEquals(List.of(1, 2, 3), captured.candidates(),
                    "Simulation payload must contain Candidate C (id=3) despite having zero eligible pairs");

            // Pairs must only contain pairs for Alice and Bob
            assertEquals(2, captured.pairs().size());
            assertFalse(captured.pairs().stream().anyMatch(p -> p.c() == 3));

            // Full coverage must be preserved
            assertTrue(captured.policy().fullCoverage());
        }

        @Test
        @DisplayName("Test Sim B — Policy Lab Simulation: Non-full-coverage still passes complete active population")
        void testSimB_simulationNonFullCoverageStillIncludesCohort() throws Exception {
            SimulationRun sim = new SimulationRun();
            sim.id = 201L;
            sim.baseRunId = 1L;
            when(sims.findById(201L)).thenReturn(Optional.of(sim));
            when(sims.save(any(SimulationRun.class))).thenAnswer(i -> i.getArgument(0));

            AllocationRun base = new AllocationRun();
            base.id = 1L;

            CandidateProfile candA = activeProfile(1L, "Alice", LocationType.URBAN);
            CandidateProfile candC = activeProfile(3L, "Charlie", LocationType.URBAN);
            when(profiles.findAllByCandidateState(CandidateState.ACTIVE)).thenReturn(List.of(candA, candC));

            Opportunity opp1 = activeOpp(10L, "Dev Intern", 1);
            when(opportunities.findAllByStatus(OppStatus.ACTIVE)).thenReturn(List.of(opp1));

            when(suitability.check(eq(candA), any(), eq(opp1), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(true, List.of()));
            when(suitability.check(eq(candC), any(), eq(opp1), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(false, List.of("Unqualified")));

            when(suitability.score(any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(new PairScore(80, 80, 80, 80, 80, 80, 80, 80.0));

            when(ai.optimize(any())).thenReturn(new AiServiceClient.OptimizeResult(
                    "INFEASIBLE", 0, 10, new AiServiceClient.ModelStats(1, 1, 1, 10), List.of(), List.of()));

            invokeRunSimulation(201L, base, Weights.defaultBalanced(), false, 0, null);

            ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                    ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
            verify(ai).optimize(captor.capture());

            AiServiceClient.OptimizeRequest captured = captor.getValue();
            assertEquals(List.of(1, 3), captured.candidates(),
                    "Complete candidate cohort must be passed in simulation even when fullCoverage is false");
            assertFalse(captured.policy().fullCoverage());
        }
    }
}
