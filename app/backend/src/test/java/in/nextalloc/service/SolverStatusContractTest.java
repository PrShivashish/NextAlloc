package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.lang.reflect.Method;
import java.util.Collections;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

import in.nextalloc.ai.AiServiceClient;
import in.nextalloc.common.Labels;
import in.nextalloc.common.Weights;
import in.nextalloc.config.AppProperties;
import in.nextalloc.domain.AllocationRun;
import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.Opportunity;
import in.nextalloc.domain.SimulationRun;
import in.nextalloc.domain.enums.*;
import in.nextalloc.repo.*;
import in.nextalloc.security.AuthUser;
import in.nextalloc.service.SuitabilityService.PairScore;

/**
 * Quality Gate tests for Patch 2: Solver Status Integrity & Contract Verification.
 *
 * <p>Verifies that all 5 native solver statuses (OPTIMAL, FEASIBLE, INFEASIBLE, UNKNOWN, MODEL_INVALID)
 * propagate truthfully through Java services, domain enums, and presentation layers without
 * mislabeling timeouts or model errors as mathematical infeasibility.
 */
@DisplayName("Patch 2 — Solver Status Integrity Contract Tests")
class SolverStatusContractTest {

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
    private MetricsService metrics;
    private AuditService audit;
    private ScenarioService scenarios;
    private SuitabilityService suitability;
    private ObjectMapper json;
    private AppProperties props;

    private AllocationService allocationService;
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

        policyService = new PolicyService(
                runs, snapshots, profiles, skills, interests, preferences,
                opportunities, oppSkills, assignments, sims, presets,
                ai, suitability, audit, json);
    }

    private void invokeExecute(Long runId) throws Exception {
        Method m = AllocationService.class.getDeclaredMethod("execute", Long.class);
        m.setAccessible(true);
        m.invoke(allocationService, runId);
    }

    private void invokeRunSimulation(Long simId, AllocationRun base, Weights w,
                                     boolean fullCoverage, Integer floor, AuthUser actor) throws Exception {
        Method m = PolicyService.class.getDeclaredMethod("runSimulation",
                Long.class, AllocationRun.class, Weights.class, boolean.class, Integer.class, AuthUser.class);
        m.setAccessible(true);
        m.invoke(policyService, simId, base, w, fullCoverage, floor, actor);
    }

    // ==================================================================
    // 1. Enum & Labels Contract Tests
    // ==================================================================

    @Test
    @DisplayName("1.1 — SolverStatus enum contains all five native statuses")
    void testSolverStatusEnumValues() {
        assertEquals(5, SolverStatus.values().length);
        assertNotNull(SolverStatus.valueOf("OPTIMAL"));
        assertNotNull(SolverStatus.valueOf("FEASIBLE"));
        assertNotNull(SolverStatus.valueOf("INFEASIBLE"));
        assertNotNull(SolverStatus.valueOf("UNKNOWN"));
        assertNotNull(SolverStatus.valueOf("MODEL_INVALID"));
    }

    @Test
    @DisplayName("1.2 — Labels maps all five statuses to human-readable strings")
    void testLabelsMapping() {
        assertEquals("Optimal allocation", Labels.label(SolverStatus.OPTIMAL));
        assertEquals("Feasible allocation", Labels.label(SolverStatus.FEASIBLE));
        assertEquals("Infeasible allocation", Labels.label(SolverStatus.INFEASIBLE));
        assertEquals("Inconclusive — no proven result", Labels.label(SolverStatus.UNKNOWN));
        assertEquals("Invalid model structure", Labels.label(SolverStatus.MODEL_INVALID));
    }

    // ==================================================================
    // 2. AllocationService Status Handling
    // ==================================================================

    @Test
    @DisplayName("2.1 — AllocationService: UNKNOWN status routes to RunStatus.FAILED with search limit explanation")
    void testAllocationServiceUnknownHandling() throws Exception {
        AllocationRun run = new AllocationRun();
        run.id = 1L;
        run.runCode = "RUN-UNKNOWN-1";
        run.number = 1;
        run.scenario = ScenarioKey.STANDARD_SHOWCASE;
        run.weightsJson = Weights.defaultBalanced().toJson(json);

        when(runs.findById(1L)).thenReturn(Optional.of(run));
        when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

        CandidateProfile cand = new CandidateProfile();
        cand.id = 1L;
        cand.candidateState = CandidateState.ACTIVE;
        when(profiles.findAllByCandidateState(CandidateState.ACTIVE)).thenReturn(List.of(cand));

        Opportunity opp = new Opportunity();
        opp.id = 10L;
        opp.status = OppStatus.ACTIVE;
        opp.capacity = 1;
        when(opportunities.findAllByStatus(OppStatus.ACTIVE)).thenReturn(List.of(opp));

        when(skills.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
        when(interests.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
        when(preferences.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
        when(oppSkills.findByOpportunityIdIn(anyList())).thenReturn(Collections.emptyList());

        when(suitability.check(any(), any(), any(), any()))
                .thenReturn(new SuitabilityService.EligibilityResult(true, List.of()));
        when(suitability.score(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PairScore(80, 80, 80, 80, 80, 80, 80, 80.0));

        // Mock AI optimizer returning native UNKNOWN
        when(ai.optimize(any())).thenReturn(new AiServiceClient.OptimizeResult(
                "UNKNOWN", 0, 50, new AiServiceClient.ModelStats(1, 1, 1, 50), List.of(), List.of()));

        invokeExecute(1L);

        // Verification: Must be FAILED, NOT INFEASIBLE or COMPLETED
        assertEquals(RunStatus.FAILED, run.status, "Run status must be FAILED for UNKNOWN");
        assertEquals(SolverStatus.UNKNOWN, run.solverStatus, "SolverStatus must be UNKNOWN");
        assertTrue(run.errorMessage.contains("search limits"), "Error message must cite search limits");
        verify(assignments, never()).saveAll(anyList());
    }

    @Test
    @DisplayName("2.2 — AllocationService: MODEL_INVALID routes to RunStatus.FAILED with model validation explanation")
    void testAllocationServiceModelInvalidHandling() throws Exception {
        AllocationRun run = new AllocationRun();
        run.id = 2L;
        run.runCode = "RUN-INVALID-1";
        run.number = 2;
        run.scenario = ScenarioKey.STANDARD_SHOWCASE;
        run.weightsJson = Weights.defaultBalanced().toJson(json);

        when(runs.findById(2L)).thenReturn(Optional.of(run));
        when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

        CandidateProfile cand = new CandidateProfile();
        cand.id = 1L;
        cand.candidateState = CandidateState.ACTIVE;
        when(profiles.findAllByCandidateState(CandidateState.ACTIVE)).thenReturn(List.of(cand));

        Opportunity opp = new Opportunity();
        opp.id = 10L;
        opp.status = OppStatus.ACTIVE;
        opp.capacity = 1;
        when(opportunities.findAllByStatus(OppStatus.ACTIVE)).thenReturn(List.of(opp));

        when(skills.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
        when(interests.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
        when(preferences.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
        when(oppSkills.findByOpportunityIdIn(anyList())).thenReturn(Collections.emptyList());

        when(suitability.check(any(), any(), any(), any()))
                .thenReturn(new SuitabilityService.EligibilityResult(true, List.of()));
        when(suitability.score(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PairScore(80, 80, 80, 80, 80, 80, 80, 80.0));

        // Mock AI optimizer returning MODEL_INVALID
        when(ai.optimize(any())).thenReturn(new AiServiceClient.OptimizeResult(
                "MODEL_INVALID", 0, 5, new AiServiceClient.ModelStats(0, 0, 0, 5), List.of(), List.of()));

        invokeExecute(2L);

        assertEquals(RunStatus.FAILED, run.status, "Run status must be FAILED for MODEL_INVALID");
        assertEquals(SolverStatus.MODEL_INVALID, run.solverStatus, "SolverStatus must be MODEL_INVALID");
        assertTrue(run.errorMessage.contains("invalid"), "Error message must explain model invalidity");
        verify(assignments, never()).saveAll(anyList());
    }

    // ==================================================================
    // 3. PolicyService Status Handling
    // ==================================================================

    @Test
    @DisplayName("3.1 — PolicyService: UNKNOWN simulation routes to RunStatus.FAILED with descriptive note")
    void testPolicyServiceUnknownHandling() throws Exception {
        SimulationRun sim = new SimulationRun();
        sim.id = 10L;
        sim.baseRunId = 1L;
        when(sims.findById(10L)).thenReturn(Optional.of(sim));
        when(sims.save(any(SimulationRun.class))).thenAnswer(i -> i.getArgument(0));

        AllocationRun base = new AllocationRun();
        base.id = 1L;

        CandidateProfile cand = new CandidateProfile();
        cand.id = 1L;
        cand.candidateState = CandidateState.ACTIVE;
        when(profiles.findAllByCandidateState(CandidateState.ACTIVE)).thenReturn(List.of(cand));

        Opportunity opp = new Opportunity();
        opp.id = 10L;
        opp.status = OppStatus.ACTIVE;
        opp.capacity = 1;
        when(opportunities.findAllByStatus(OppStatus.ACTIVE)).thenReturn(List.of(opp));

        when(suitability.check(any(), any(), any(), any()))
                .thenReturn(new SuitabilityService.EligibilityResult(true, List.of()));
        when(suitability.score(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PairScore(80, 80, 80, 80, 80, 80, 80, 80.0));

        when(ai.optimize(any())).thenReturn(new AiServiceClient.OptimizeResult(
                "UNKNOWN", 0, 20, new AiServiceClient.ModelStats(1, 1, 1, 20), List.of(), List.of()));

        invokeRunSimulation(10L, base, Weights.defaultBalanced(), false, 0, null);

        assertEquals(RunStatus.FAILED, sim.status, "Simulation status must be FAILED for UNKNOWN");
        assertEquals(SolverStatus.UNKNOWN, sim.solverStatus, "SolverStatus must be UNKNOWN");
        assertTrue(sim.metricsJson.contains("search limits"), "metricsJson must explain search limits");
    }

    @Test
    @DisplayName("3.2 — PolicyService: MODEL_INVALID simulation routes to RunStatus.FAILED with model invalid note")
    void testPolicyServiceModelInvalidHandling() throws Exception {
        SimulationRun sim = new SimulationRun();
        sim.id = 11L;
        sim.baseRunId = 1L;
        when(sims.findById(11L)).thenReturn(Optional.of(sim));
        when(sims.save(any(SimulationRun.class))).thenAnswer(i -> i.getArgument(0));

        AllocationRun base = new AllocationRun();
        base.id = 1L;

        CandidateProfile cand = new CandidateProfile();
        cand.id = 1L;
        cand.candidateState = CandidateState.ACTIVE;
        when(profiles.findAllByCandidateState(CandidateState.ACTIVE)).thenReturn(List.of(cand));

        Opportunity opp = new Opportunity();
        opp.id = 10L;
        opp.status = OppStatus.ACTIVE;
        opp.capacity = 1;
        when(opportunities.findAllByStatus(OppStatus.ACTIVE)).thenReturn(List.of(opp));

        when(suitability.check(any(), any(), any(), any()))
                .thenReturn(new SuitabilityService.EligibilityResult(true, List.of()));
        when(suitability.score(any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(new PairScore(80, 80, 80, 80, 80, 80, 80, 80.0));

        when(ai.optimize(any())).thenReturn(new AiServiceClient.OptimizeResult(
                "MODEL_INVALID", 0, 5, new AiServiceClient.ModelStats(0, 0, 0, 5), List.of(), List.of()));

        invokeRunSimulation(11L, base, Weights.defaultBalanced(), false, 0, null);

        assertEquals(RunStatus.FAILED, sim.status, "Simulation status must be FAILED for MODEL_INVALID");
        assertEquals(SolverStatus.MODEL_INVALID, sim.solverStatus, "SolverStatus must be MODEL_INVALID");
        assertTrue(sim.metricsJson.contains("structurally invalid"), "metricsJson must explain structural invalidity");
    }
}
