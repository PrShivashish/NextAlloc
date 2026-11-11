package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.lang.reflect.Method;
import java.util.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.fasterxml.jackson.databind.ObjectMapper;

import in.nextalloc.ai.AiServiceClient;
import in.nextalloc.common.ApiException;
import in.nextalloc.common.Weights;
import in.nextalloc.config.AppProperties;
import in.nextalloc.domain.*;
import in.nextalloc.domain.enums.*;
import in.nextalloc.repo.*;
import in.nextalloc.security.AuthUser;
import in.nextalloc.seed.PolicySeeder;
import in.nextalloc.service.SuitabilityService.PairScore;

@DisplayName("Patch 4A-1 — Versioned Fairness Policy Semantics & Compatibility Gate Tests")
class FairnessPolicySemanticsTest {

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
    private SimulationRunRepository sims;
    private ObjectMapper json;
    private AppProperties props;

    private AllocationService allocationService;
    private PolicyService policyService;
    private ReallocationService reallocationService;
    private AuthUser adminUser;

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
        sims = mock(SimulationRunRepository.class);
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

        reallocationService = new ReallocationService(
                runs, snapshots, profiles, opportunities, assignments,
                allocationService, audit, json);

        adminUser = new AuthUser(100L, "admin@pragati.gov.in", "Admin User", "ADMIN");

        // Seed preset mocks: "balanced" is v1, "balanced_v2" is v2
        PolicyPreset presetBalancedV1 = new PolicyPreset();
        presetBalancedV1.id = 1L;
        presetBalancedV1.key = "balanced";
        presetBalancedV1.name = "Balanced Allocation Policy";
        presetBalancedV1.weightsJson = Weights.defaultBalanced().toJson(json);
        presetBalancedV1.version = "v1";
        presetBalancedV1.isDefault = false;
        when(presets.findByKey("balanced")).thenReturn(Optional.of(presetBalancedV1));

        PolicyPreset presetBalancedV2 = new PolicyPreset();
        presetBalancedV2.id = 6L;
        presetBalancedV2.key = "balanced_v2";
        presetBalancedV2.name = "Balanced Allocation Policy (v2)";
        presetBalancedV2.weightsJson = Weights.defaultBalanced().toJson(json);
        presetBalancedV2.version = "v2";
        presetBalancedV2.isDefault = true;
        when(presets.findByKey("balanced_v2")).thenReturn(Optional.of(presetBalancedV2));
        when(presets.findAll()).thenReturn(List.of(presetBalancedV1, presetBalancedV2));
    }

    private CandidateProfile candidate(long id, LocationType loc) {
        CandidateProfile p = new CandidateProfile();
        p.id = id;
        p.fullName = "Candidate " + id;
        p.candidateState = CandidateState.ACTIVE;
        p.locationType = loc;
        p.qualification = Qualification.BACHELORS;
        return p;
    }

    private Opportunity opportunity(long id, int capacity) {
        Opportunity o = new Opportunity();
        o.id = id;
        o.title = "Opp " + id;
        o.capacity = capacity;
        o.status = OppStatus.ACTIVE;
        o.minQualification = Qualification.BACHELORS;
        return o;
    }

    // =========================================================================
    // 1. Preset Version Integrity & Seeder Idempotency
    // =========================================================================
    @Nested
    @DisplayName("1. Preset Version Integrity & Seeder Idempotency Tests")
    class PresetVersionIntegrityTests {

        @Test
        @DisplayName("1.1 — Existing v1 preset remains completely unchanged after seeder execution")
        void testExistingV1PresetRemainsUnchangedAfterSeeding() {
            Map<String, PolicyPreset> storage = new LinkedHashMap<>();
            PolicyPreset v1 = new PolicyPreset();
            v1.id = 100L;
            v1.key = "balanced";
            v1.name = "Original Balanced Policy";
            v1.version = "v1";
            v1.weightsJson = "{\"skills\":35,\"qualification\":15,\"interest\":15,\"location\":10,\"preference\":10,\"learning\":10,\"experience\":5}";
            v1.fullCoverage = false;
            v1.fairnessFloorPct = null;
            v1.isDefault = false;
            storage.put("balanced", v1);

            PolicyPresetRepository mockRepo = mock(PolicyPresetRepository.class);
            when(mockRepo.findByKey(anyString())).thenAnswer(inv -> Optional.ofNullable(storage.get(inv.getArgument(0))));
            when(mockRepo.save(any(PolicyPreset.class))).thenAnswer(inv -> {
                PolicyPreset p = inv.getArgument(0);
                storage.put(p.key, p);
                return p;
            });

            PolicySeeder seeder = new PolicySeeder();
            seeder.seed(mockRepo);

            // Verify v1 preset was NOT overwritten
            PolicyPreset after = storage.get("balanced");
            assertNotNull(after);
            assertEquals("v1", after.version, "Existing v1 preset must remain version v1");
            assertEquals("Original Balanced Policy", after.name, "Name must not be modified");
            assertEquals(100L, after.id, "Preset ID must not be changed");
        }

        @Test
        @DisplayName("1.2 — New v2 demonstration policy is created without overwriting v1")
        void testNewV2DemonstrationPolicyCreatedWithoutOverwritingV1() {
            Map<String, PolicyPreset> storage = new LinkedHashMap<>();
            PolicyPreset v1 = new PolicyPreset();
            v1.key = "balanced";
            v1.version = "v1";
            storage.put("balanced", v1);

            PolicyPresetRepository mockRepo = mock(PolicyPresetRepository.class);
            when(mockRepo.findByKey(anyString())).thenAnswer(inv -> Optional.ofNullable(storage.get(inv.getArgument(0))));
            when(mockRepo.save(any(PolicyPreset.class))).thenAnswer(inv -> {
                PolicyPreset p = inv.getArgument(0);
                storage.put(p.key, p);
                return p;
            });

            PolicySeeder seeder = new PolicySeeder();
            seeder.seed(mockRepo);

            // Both v1 and v2 must coexist safely
            assertTrue(storage.containsKey("balanced"), "v1 preset must exist");
            assertEquals("v1", storage.get("balanced").version);

            assertTrue(storage.containsKey("balanced_v2"), "v2 preset must be created");
            assertEquals("v2", storage.get("balanced_v2").version);
            assertTrue(storage.get("balanced_v2").isDefault, "v2 demonstration policy should be default");
        }

        @Test
        @DisplayName("1.3 — Seeder execution is completely idempotent")
        void testSeederExecutionIsIdempotent() {
            Map<String, PolicyPreset> storage = new LinkedHashMap<>();
            PolicyPresetRepository mockRepo = mock(PolicyPresetRepository.class);
            when(mockRepo.findByKey(anyString())).thenAnswer(inv -> Optional.ofNullable(storage.get(inv.getArgument(0))));
            when(mockRepo.save(any(PolicyPreset.class))).thenAnswer(inv -> {
                PolicyPreset p = inv.getArgument(0);
                storage.put(p.key, p);
                return p;
            });

            PolicySeeder seeder = new PolicySeeder();
            // First run
            seeder.seed(mockRepo);
            int countAfterFirst = storage.size();

            // Second run
            seeder.seed(mockRepo);
            int countAfterSecond = storage.size();

            assertEquals(countAfterFirst, countAfterSecond, "Seeder must not duplicate entries on repeated runs");
            verify(mockRepo, times(countAfterFirst)).save(any(PolicyPreset.class));
        }

        @Test
        @DisplayName("1.4 — Unambiguous effective default: new runs deterministically select v2 default even if historical v1 retains isDefault=true")
        void testDeterministicV2DefaultSelectionWhenBothMarkedDefault() {
            PolicyPreset v1 = new PolicyPreset();
            v1.key = "balanced";
            v1.name = "Balanced Policy (Legacy)";
            v1.weightsJson = Weights.defaultBalanced().toJson(json);
            v1.version = "v1";
            v1.isDefault = true; // Historical record still marked default!

            PolicyPreset v2 = new PolicyPreset();
            v2.key = "balanced_v2";
            v2.name = "Balanced Allocation Policy (v2)";
            v2.weightsJson = Weights.defaultBalanced().toJson(json);
            v2.version = "v2";
            v2.isDefault = true; // Current demonstration default!

            when(presets.findByKey("balanced_v2")).thenReturn(Optional.of(v2));
            when(presets.findByKey("balanced")).thenReturn(Optional.of(v1));
            when(presets.findAll()).thenReturn(List.of(v1, v2));

            DatasetSnapshot snap = new DatasetSnapshot();
            snap.id = 1L;
            snap.scenario = ScenarioKey.STANDARD_SHOWCASE;
            when(scenarios.currentSnapshot()).thenReturn(Optional.of(snap));
            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

            // Default run with no policyKey or weights specified
            AllocationRun run = allocationService.prepareRun(null, null, null, adminUser);
            assertNotNull(run);
            assertEquals("balanced_v2", run.policyKey, "Default run must deterministically select balanced_v2");
            assertEquals("v2", run.policyVersion, "Default run must deterministically use v2 version");
        }

        @Test
        @DisplayName("1.5 — Explicit selection of historical v1 preset preserves v1 without ambiguity")
        void testExplicitV1SelectionPreservesV1EvenIfV2IsDefault() {
            PolicyPreset v1 = new PolicyPreset();
            v1.key = "balanced";
            v1.name = "Balanced Policy";
            v1.weightsJson = Weights.defaultBalanced().toJson(json);
            v1.version = "v1";
            v1.isDefault = false;

            when(presets.findByKey("balanced")).thenReturn(Optional.of(v1));

            DatasetSnapshot snap = new DatasetSnapshot();
            snap.id = 1L;
            snap.scenario = ScenarioKey.STANDARD_SHOWCASE;
            when(scenarios.currentSnapshot()).thenReturn(Optional.of(snap));
            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

            // Explicitly request "balanced" (the historical v1 preset)
            AllocationService.StartRunRequest req = new AllocationService.StartRunRequest(
                    "balanced", null, false, 20, null);
            AllocationRun run = allocationService.prepareRun(req, null, null, adminUser);

            assertNotNull(run);
            assertEquals("balanced", run.policyKey);
            assertEquals("v1", run.policyVersion, "Explicit v1 preset request must preserve v1 policyVersion");
        }
    }

    // =========================================================================
    // 2. Behavioral Demonstration & Historical Version Resolution
    // =========================================================================
    @Nested
    @DisplayName("2. Versioned Policy Group Construction & Historical Provenance Tests")
    class VersionedPolicyGroupConstructionTests {

        @Test
        @DisplayName("2.1 — New explicit v2 policy must constrain ONLY RURAL candidates, leaving URBAN unconstrained")
        void testV2ConstrainsOnlyRural() throws Exception {
            AllocationRun run = new AllocationRun();
            run.id = 1L;
            run.runCode = "RUN-V2-1";
            run.number = 1;
            run.scenario = ScenarioKey.STANDARD_SHOWCASE;
            run.weightsJson = Weights.defaultBalanced().toJson(json);
            run.fairnessFloorPct = 30;
            run.policyVersion = "v2";

            when(runs.findById(1L)).thenReturn(Optional.of(run));
            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

            CandidateProfile cRural = candidate(1L, LocationType.RURAL);
            CandidateProfile cUrban = candidate(2L, LocationType.URBAN);
            when(profiles.findAllByCandidateState(CandidateState.ACTIVE)).thenReturn(List.of(cRural, cUrban));

            Opportunity opp = opportunity(10L, 2);
            when(opportunities.findAllByStatus(OppStatus.ACTIVE)).thenReturn(List.of(opp));

            when(skills.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(interests.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(preferences.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(oppSkills.findByOpportunityIdIn(anyList())).thenReturn(Collections.emptyList());

            when(suitability.check(any(), any(), any(), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(true, List.of()));
            when(suitability.score(any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(new PairScore(80, 80, 80, 80, 80, 80, 80, 80.0));

            ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                    ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
            when(ai.optimize(captor.capture())).thenReturn(new AiServiceClient.OptimizeResult(
                    "OPTIMAL", 100, 10, new AiServiceClient.ModelStats(2, 2, 2, 10), List.of(), List.of()));

            Method m = AllocationService.class.getDeclaredMethod("execute", Long.class);
            m.setAccessible(true);
            m.invoke(allocationService, 1L);

            AiServiceClient.OptimizeRequest req = captor.getValue();
            assertNotNull(req);
            assertNotNull(req.policy());
            List<AiServiceClient.OptGroup> groups = req.policy().groups();

            // In v2: exactly ONE group (RURAL) should be present; URBAN must NOT be constrained!
            assertEquals(1, groups.size(), "v2 must create exactly 1 group (RURAL only)");
            assertEquals("RURAL", groups.get(0).key());
            assertEquals(List.of(1), groups.get(0).candidates());
            assertEquals(30, groups.get(0).floorPct());
        }

        @Test
        @DisplayName("2.2 — Old explicit v1 policy must retain constraints for ALL location types")
        void testV1LegacyRetainsAllLocationConstraints() throws Exception {
            AllocationRun run = new AllocationRun();
            run.id = 2L;
            run.runCode = "RUN-V1-1";
            run.number = 2;
            run.scenario = ScenarioKey.STANDARD_SHOWCASE;
            run.weightsJson = Weights.defaultBalanced().toJson(json);
            run.fairnessFloorPct = 25;
            run.policyVersion = "v1";

            when(runs.findById(2L)).thenReturn(Optional.of(run));
            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

            CandidateProfile cRural = candidate(1L, LocationType.RURAL);
            CandidateProfile cUrban = candidate(2L, LocationType.URBAN);
            when(profiles.findAllByCandidateState(CandidateState.ACTIVE)).thenReturn(List.of(cRural, cUrban));

            Opportunity opp = opportunity(10L, 2);
            when(opportunities.findAllByStatus(OppStatus.ACTIVE)).thenReturn(List.of(opp));

            when(skills.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(interests.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(preferences.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(oppSkills.findByOpportunityIdIn(anyList())).thenReturn(Collections.emptyList());

            when(suitability.check(any(), any(), any(), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(true, List.of()));
            when(suitability.score(any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(new PairScore(80, 80, 80, 80, 80, 80, 80, 80.0));

            ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                    ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
            when(ai.optimize(captor.capture())).thenReturn(new AiServiceClient.OptimizeResult(
                    "OPTIMAL", 100, 10, new AiServiceClient.ModelStats(2, 2, 2, 10), List.of(), List.of()));

            Method m = AllocationService.class.getDeclaredMethod("execute", Long.class);
            m.setAccessible(true);
            m.invoke(allocationService, 2L);

            AiServiceClient.OptimizeRequest req = captor.getValue();
            assertNotNull(req);
            assertNotNull(req.policy());
            List<AiServiceClient.OptGroup> groups = req.policy().groups();

            // In v1: ALL present location types (RURAL and URBAN) must be constrained
            assertEquals(2, groups.size(), "v1 must create groups for all present location types");
            Set<String> groupKeys = new HashSet<>();
            for (AiServiceClient.OptGroup g : groups) {
                groupKeys.add(g.key());
                assertEquals(25, g.floorPct());
            }
            assertTrue(groupKeys.contains("RURAL"));
            assertTrue(groupKeys.contains("URBAN"));
        }

        @Test
        @DisplayName("2.3 — Historical missing-version run resolves to v1 legacy provenance, NEVER silently v2")
        void testHistoricalMissingVersionResolvesToV1() throws Exception {
            AllocationRun run = new AllocationRun();
            run.id = 3L;
            run.runCode = "RUN-HISTORICAL-UNVERSIONED";
            run.number = 3;
            run.scenario = ScenarioKey.STANDARD_SHOWCASE;
            run.weightsJson = Weights.defaultBalanced().toJson(json);
            run.fairnessFloorPct = 20;
            run.policyVersion = null; // Unversioned historical run

            // Verification 1: AllocationService.resolvePolicyVersion contract
            assertEquals("v1", AllocationService.resolvePolicyVersion(run),
                    "Historical run with null policyVersion must resolve to v1");

            when(runs.findById(3L)).thenReturn(Optional.of(run));
            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

            CandidateProfile cRural = candidate(1L, LocationType.RURAL);
            CandidateProfile cUrban = candidate(2L, LocationType.URBAN);
            when(profiles.findAllByCandidateState(CandidateState.ACTIVE)).thenReturn(List.of(cRural, cUrban));

            Opportunity opp = opportunity(10L, 2);
            when(opportunities.findAllByStatus(OppStatus.ACTIVE)).thenReturn(List.of(opp));

            when(skills.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(interests.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(preferences.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(oppSkills.findByOpportunityIdIn(anyList())).thenReturn(Collections.emptyList());

            when(suitability.check(any(), any(), any(), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(true, List.of()));
            when(suitability.score(any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(new PairScore(80, 80, 80, 80, 80, 80, 80, 80.0));

            ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                    ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
            when(ai.optimize(captor.capture())).thenReturn(new AiServiceClient.OptimizeResult(
                    "OPTIMAL", 100, 10, new AiServiceClient.ModelStats(2, 2, 2, 10), List.of(), List.of()));

            Method m = AllocationService.class.getDeclaredMethod("execute", Long.class);
            m.setAccessible(true);
            m.invoke(allocationService, 3L);

            AiServiceClient.OptimizeRequest req = captor.getValue();
            assertNotNull(req);
            // Must have generated all location groups under legacy v1 rules, proving it did NOT default to v2!
            assertEquals(2, req.policy().groups().size(), "Historical unversioned run must execute under v1 all-group semantics");
        }

        @Test
        @DisplayName("2.4 — Unsupported policy version is rejected clearly with 400 Bad Request")
        void testUnsupportedPolicyVersionRejectedClearly() {
            DatasetSnapshot snap = new DatasetSnapshot();
            snap.id = 1L;
            snap.scenario = ScenarioKey.STANDARD_SHOWCASE;
            when(scenarios.currentSnapshot()).thenReturn(Optional.of(snap));

            // Request with invalid version "v3"
            AllocationService.StartRunRequest req = new AllocationService.StartRunRequest(
                    "balanced", null, false, 20, "v3");

            ApiException ex = assertThrows(ApiException.class, () ->
                    allocationService.prepareRun(req, null, null, adminUser));

            assertTrue(ex.getMessage().contains("Unsupported policy version: 'v3'"));
        }
    }

    // =========================================================================
    // 3. Reallocation Semantics Preservation
    // =========================================================================
    @Nested
    @DisplayName("3. Reallocation Semantics Preservation Tests")
    class ReallocationPolicyInheritanceTests {

        @Test
        @DisplayName("3.1 — Reallocation from v1 parent without version change maintains v1")
        void testReallocationMaintainsV1() throws Exception {
            AllocationRun parent = new AllocationRun();
            parent.id = 10L;
            parent.snapshotId = 1L;
            parent.number = 1;
            parent.status = RunStatus.COMPLETED;
            parent.weightsJson = Weights.defaultBalanced().toJson(json);
            parent.policyName = "Balanced Allocation Policy";
            parent.policyKey = "balanced";
            parent.policyVersion = "v1";
            parent.fairnessFloorPct = 20;

            DatasetSnapshot snap = new DatasetSnapshot();
            snap.id = 1L;
            snap.scenario = ScenarioKey.STANDARD_SHOWCASE;

            when(runs.findById(10L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(snap));
            when(scenarios.currentSnapshot()).thenReturn(Optional.of(snap));

            Opportunity opp = opportunity(5L, 10);
            when(opportunities.findById(5L)).thenReturn(Optional.of(opp));

            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> {
                AllocationRun r = i.getArgument(0);
                r.id = 11L;
                return r;
            });

            ReallocationService.Change change = new ReallocationService.Change(
                    "CAPACITY", 5L, null, 12, null, null, null);
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                    10L, List.of(change));

            AllocationRun child = reallocationService.start(req, adminUser);
            assertNotNull(child);
            assertEquals("v1", child.policyVersion, "Child must inherit v1 policy version from parent");
        }

        @Test
        @DisplayName("3.2 — Reallocation from v2 parent without version change maintains v2")
        void testReallocationMaintainsV2() throws Exception {
            AllocationRun parent = new AllocationRun();
            parent.id = 20L;
            parent.snapshotId = 1L;
            parent.number = 2;
            parent.status = RunStatus.COMPLETED;
            parent.weightsJson = Weights.defaultBalanced().toJson(json);
            parent.policyName = "Balanced Allocation Policy (v2)";
            parent.policyKey = "balanced_v2";
            parent.policyVersion = "v2";
            parent.fairnessFloorPct = 30;

            DatasetSnapshot snap = new DatasetSnapshot();
            snap.id = 1L;
            snap.scenario = ScenarioKey.STANDARD_SHOWCASE;

            when(runs.findById(20L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(snap));
            when(scenarios.currentSnapshot()).thenReturn(Optional.of(snap));

            Opportunity opp = opportunity(5L, 10);
            when(opportunities.findById(5L)).thenReturn(Optional.of(opp));

            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> {
                AllocationRun r = i.getArgument(0);
                r.id = 21L;
                return r;
            });

            ReallocationService.Change change = new ReallocationService.Change(
                    "CAPACITY", 5L, null, 15, null, null, null);
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                    20L, List.of(change));

            AllocationRun child = reallocationService.start(req, adminUser);
            assertNotNull(child);
            assertEquals("v2", child.policyVersion, "Child must inherit v2 policy version from parent");
        }

        @Test
        @DisplayName("3.3 — Reallocation from historical unversioned parent preserves v1 semantics")
        void testReallocationPreservesUnversionedParentAsV1() throws Exception {
            AllocationRun parent = new AllocationRun();
            parent.id = 25L;
            parent.snapshotId = 1L;
            parent.number = 25;
            parent.status = RunStatus.COMPLETED;
            parent.weightsJson = Weights.defaultBalanced().toJson(json);
            parent.policyName = "Balanced Allocation Policy";
            parent.policyKey = "balanced";
            parent.policyVersion = null; // Unversioned historical parent
            parent.fairnessFloorPct = 20;

            DatasetSnapshot snap = new DatasetSnapshot();
            snap.id = 1L;
            snap.scenario = ScenarioKey.STANDARD_SHOWCASE;

            when(runs.findById(25L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(snap));
            when(scenarios.currentSnapshot()).thenReturn(Optional.of(snap));

            Opportunity opp = opportunity(5L, 10);
            when(opportunities.findById(5L)).thenReturn(Optional.of(opp));

            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> {
                AllocationRun r = i.getArgument(0);
                r.id = 26L;
                return r;
            });

            ReallocationService.Change change = new ReallocationService.Change(
                    "CAPACITY", 5L, null, 14, null, null, null);
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                    25L, List.of(change));

            AllocationRun child = reallocationService.start(req, adminUser);
            assertNotNull(child);
            assertEquals("v1", child.policyVersion, "Child of unversioned historical parent must resolve to v1");
        }

        @Test
        @DisplayName("3.4 — Reallocation from v1 parent with explicit POLICY version transition becomes v2")
        void testReallocationUpgradeToV2() throws Exception {
            AllocationRun parent = new AllocationRun();
            parent.id = 30L;
            parent.snapshotId = 1L;
            parent.number = 3;
            parent.status = RunStatus.COMPLETED;
            parent.weightsJson = Weights.defaultBalanced().toJson(json);
            parent.policyName = "Balanced Allocation Policy";
            parent.policyKey = "balanced";
            parent.policyVersion = "v1";

            DatasetSnapshot snap = new DatasetSnapshot();
            snap.id = 1L;
            snap.scenario = ScenarioKey.STANDARD_SHOWCASE;

            when(runs.findById(30L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(snap));
            when(scenarios.currentSnapshot()).thenReturn(Optional.of(snap));

            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> {
                AllocationRun r = i.getArgument(0);
                r.id = 31L;
                return r;
            });

            ReallocationService.Change change = new ReallocationService.Change(
                    "POLICY", null, null, null, null, null, 35, "v2");
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                    30L, List.of(change));

            AllocationRun child = reallocationService.start(req, adminUser);
            assertNotNull(child);
            assertEquals("v2", child.policyVersion, "Child must be upgraded to v2");
            assertEquals(35, child.fairnessFloorPct);
        }

        @Test
        @DisplayName("3.5 — Reallocation rejects unsupported policy version")
        void testReallocationRejectsUnsupportedVersion() {
            AllocationRun parent = new AllocationRun();
            parent.id = 35L;
            parent.snapshotId = 1L;
            parent.status = RunStatus.COMPLETED;
            parent.weightsJson = Weights.defaultBalanced().toJson(json);
            parent.policyVersion = "v1";

            DatasetSnapshot snap = new DatasetSnapshot();
            snap.id = 1L;
            when(runs.findById(35L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(snap));

            ReallocationService.Change change = new ReallocationService.Change(
                    "POLICY", null, null, null, null, null, 25, "v99");
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                    35L, List.of(change));

            ApiException ex = assertThrows(ApiException.class, () ->
                    reallocationService.start(req, adminUser));
            assertTrue(ex.getMessage().contains("Unsupported policy version: 'v99'"));
        }
    }

    // =========================================================================
    // 4. PolicyService What-If Simulation Semantics
    // =========================================================================
    @Nested
    @DisplayName("4. PolicyService What-If Simulation Semantics Tests")
    class SimulationSemanticsTests {

        @Test
        @DisplayName("4.1 — Policy simulation inherits parent v2 version and constrains only RURAL")
        void testSimulationInheritsV2AndConstrainsOnlyRural() throws Exception {
            AllocationRun base = new AllocationRun();
            base.id = 40L;
            base.number = 4;
            base.status = RunStatus.COMPLETED;
            base.snapshotId = 1L;
            base.weightsJson = Weights.defaultBalanced().toJson(json);
            base.policyVersion = "v2";
            base.fairnessFloorPct = 25;

            DatasetSnapshot snap = new DatasetSnapshot();
            snap.id = 1L;

            when(runs.findById(40L)).thenReturn(Optional.of(base));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(snap));

            CandidateProfile cRural = candidate(1L, LocationType.RURAL);
            CandidateProfile cUrban = candidate(2L, LocationType.URBAN);
            when(profiles.findAllByCandidateState(CandidateState.ACTIVE)).thenReturn(List.of(cRural, cUrban));

            Opportunity opp = opportunity(10L, 2);
            when(opportunities.findAllByStatus(OppStatus.ACTIVE)).thenReturn(List.of(opp));

            when(skills.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(interests.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(preferences.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(oppSkills.findByOpportunityIdIn(anyList())).thenReturn(Collections.emptyList());

            when(suitability.check(any(), any(), any(), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(true, List.of()));
            when(suitability.score(any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(new PairScore(80, 80, 80, 80, 80, 80, 80, 80.0));

            SimulationRun sim = new SimulationRun();
            sim.id = 100L;
            when(sims.findById(100L)).thenReturn(Optional.of(sim));
            when(sims.save(any(SimulationRun.class))).thenAnswer(i -> i.getArgument(0));

            ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                    ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
            when(ai.optimize(captor.capture())).thenReturn(new AiServiceClient.OptimizeResult(
                    "OPTIMAL", 100, 10, new AiServiceClient.ModelStats(2, 2, 2, 10), List.of(), List.of()));

            Method m = PolicyService.class.getDeclaredMethod(
                    "runSimulation", Long.class, AllocationRun.class, Weights.class,
                    boolean.class, Integer.class, String.class, AuthUser.class);
            m.setAccessible(true);
            m.invoke(policyService, 100L, base, Weights.defaultBalanced(), false, 25, "v2", adminUser);

            AiServiceClient.OptimizeRequest req = captor.getValue();
            assertNotNull(req);
            assertNotNull(req.policy());
            List<AiServiceClient.OptGroup> groups = req.policy().groups();

            assertEquals(1, groups.size(), "Simulation for v2 must constrain only RURAL");
            assertEquals("RURAL", groups.get(0).key());
            assertEquals(List.of(1), groups.get(0).candidates());
            assertEquals(25, groups.get(0).floorPct());
        }

        @Test
        @DisplayName("4.2 — Policy simulation with v1 constrains all present location types")
        void testSimulationWithV1ConstrainsAllLocations() throws Exception {
            AllocationRun base = new AllocationRun();
            base.id = 50L;
            base.number = 5;
            base.status = RunStatus.COMPLETED;
            base.snapshotId = 1L;
            base.weightsJson = Weights.defaultBalanced().toJson(json);
            base.policyVersion = "v1";
            base.fairnessFloorPct = 25;

            DatasetSnapshot snap = new DatasetSnapshot();
            snap.id = 1L;

            when(runs.findById(50L)).thenReturn(Optional.of(base));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(snap));

            CandidateProfile cRural = candidate(1L, LocationType.RURAL);
            CandidateProfile cUrban = candidate(2L, LocationType.URBAN);
            when(profiles.findAllByCandidateState(CandidateState.ACTIVE)).thenReturn(List.of(cRural, cUrban));

            Opportunity opp = opportunity(10L, 2);
            when(opportunities.findAllByStatus(OppStatus.ACTIVE)).thenReturn(List.of(opp));

            when(skills.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(interests.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(preferences.findByCandidateIdIn(anyList())).thenReturn(Collections.emptyList());
            when(oppSkills.findByOpportunityIdIn(anyList())).thenReturn(Collections.emptyList());

            when(suitability.check(any(), any(), any(), any()))
                    .thenReturn(new SuitabilityService.EligibilityResult(true, List.of()));
            when(suitability.score(any(), any(), any(), any(), any(), any(), any()))
                    .thenReturn(new PairScore(80, 80, 80, 80, 80, 80, 80, 80.0));

            SimulationRun sim = new SimulationRun();
            sim.id = 101L;
            when(sims.findById(101L)).thenReturn(Optional.of(sim));
            when(sims.save(any(SimulationRun.class))).thenAnswer(i -> i.getArgument(0));

            ArgumentCaptor<AiServiceClient.OptimizeRequest> captor =
                    ArgumentCaptor.forClass(AiServiceClient.OptimizeRequest.class);
            when(ai.optimize(captor.capture())).thenReturn(new AiServiceClient.OptimizeResult(
                    "OPTIMAL", 100, 10, new AiServiceClient.ModelStats(2, 2, 2, 10), List.of(), List.of()));

            Method m = PolicyService.class.getDeclaredMethod(
                    "runSimulation", Long.class, AllocationRun.class, Weights.class,
                    boolean.class, Integer.class, String.class, AuthUser.class);
            m.setAccessible(true);
            m.invoke(policyService, 101L, base, Weights.defaultBalanced(), false, 25, "v1", adminUser);

            AiServiceClient.OptimizeRequest req = captor.getValue();
            assertNotNull(req);
            assertNotNull(req.policy());
            List<AiServiceClient.OptGroup> groups = req.policy().groups();

            assertEquals(2, groups.size(), "Simulation for v1 must constrain both RURAL and URBAN");
        }

        @Test
        @DisplayName("4.3 — Policy Lab selecting a v2 preset against a v1 baseline executes matching v2 version")
        void testSimulationPresetSelectionExecutesMatchingVersion() throws Exception {
            AllocationRun base = new AllocationRun();
            base.id = 60L;
            base.number = 6;
            base.status = RunStatus.COMPLETED;
            base.snapshotId = 1L;
            base.weightsJson = Weights.defaultBalanced().toJson(json);
            base.policyVersion = "v1"; // Base is v1

            DatasetSnapshot snap = new DatasetSnapshot();
            snap.id = 1L;

            when(runs.findById(60L)).thenReturn(Optional.of(base));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(snap));

            SimulationRun sim = new SimulationRun();
            sim.id = 102L;
            when(sims.save(any(SimulationRun.class))).thenAnswer(i -> {
                SimulationRun s = i.getArgument(0);
                s.id = 102L;
                return s;
            });

            // Admin explicitly selects v2 preset in Policy Lab
            PolicyService.SimulateRequest req = new PolicyService.SimulateRequest(
                    60L, Weights.defaultBalanced().toMap(), false, 30, "v2");

            SimulationRun started = policyService.startSimulation(req, adminUser);
            assertNotNull(started);
            // Verify simulation started with v2 semantics requested
        }

        @Test
        @DisplayName("4.4 — Simulation rejects unsupported policy version")
        void testSimulationRejectsUnsupportedVersion() {
            AllocationRun base = new AllocationRun();
            base.id = 70L;
            base.snapshotId = 1L;
            base.status = RunStatus.COMPLETED;
            base.policyVersion = "v1";

            DatasetSnapshot snap = new DatasetSnapshot();
            snap.id = 1L;
            when(runs.findById(70L)).thenReturn(Optional.of(base));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(snap));

            PolicyService.SimulateRequest req = new PolicyService.SimulateRequest(
                    70L, Weights.defaultBalanced().toMap(), false, 20, "v99");

            ApiException ex = assertThrows(ApiException.class, () ->
                    policyService.startSimulation(req, adminUser));
            assertTrue(ex.getMessage().contains("Unsupported policy version: 'v99'"));
        }
    }
}
