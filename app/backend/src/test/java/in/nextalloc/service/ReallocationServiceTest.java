package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.time.Instant;
import java.util.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import in.nextalloc.common.ApiException;
import in.nextalloc.common.Weights;
import in.nextalloc.domain.*;
import in.nextalloc.domain.enums.*;
import in.nextalloc.repo.*;
import in.nextalloc.security.AuthUser;

@DisplayName("Patch 3 — Reallocation Integrity & Contract Tests")
class ReallocationServiceTest {

    private AllocationRunRepository runs;
    private DatasetSnapshotRepository snapshots;
    private CandidateProfileRepository profiles;
    private OpportunityRepository opportunities;
    private AssignmentRepository assignments;
    private AllocationService allocation;
    private AuditService audit;
    private ObjectMapper json;

    private ReallocationService reallocationService;
    private AuthUser adminUser;

    @BeforeEach
    void setUp() {
        runs = mock(AllocationRunRepository.class);
        snapshots = mock(DatasetSnapshotRepository.class);
        profiles = mock(CandidateProfileRepository.class);
        opportunities = mock(OpportunityRepository.class);
        assignments = mock(AssignmentRepository.class);
        allocation = mock(AllocationService.class);
        audit = mock(AuditService.class);
        json = new ObjectMapper();

        reallocationService = new ReallocationService(
                runs, snapshots, profiles, opportunities, assignments, allocation, audit, json);

        adminUser = new AuthUser(100L, "admin@pragati.gov.in", "Admin User", "ADMIN");
    }

    private AllocationRun createCompletedParentRun(Long id, Long snapshotId, String policyKey,
                                                   String policyName, String policyVersion,
                                                   String weightsJson, boolean fullCoverage,
                                                   Integer fairnessFloorPct) {
        AllocationRun run = new AllocationRun();
        run.id = id;
        run.runCode = "RUN-PARENT-" + id;
        run.number = id.intValue();
        run.scenario = ScenarioKey.STANDARD_SHOWCASE;
        run.snapshotId = snapshotId;
        run.policyKey = policyKey;
        run.policyName = policyName;
        run.policyVersion = policyVersion;
        run.weightsJson = weightsJson;
        run.fullCoverage = fullCoverage;
        run.fairnessFloorPct = fairnessFloorPct;
        run.status = RunStatus.COMPLETED;
        return run;
    }

    private DatasetSnapshot createSnapshot(Long id) {
        DatasetSnapshot snap = new DatasetSnapshot();
        snap.id = id;
        snap.scenario = ScenarioKey.STANDARD_SHOWCASE;
        snap.candidateCount = 10;
        snap.opportunityCount = 5;
        snap.seatCount = 10;
        return snap;
    }

    private Opportunity createOpportunity(Long id, String title, int capacity) {
        Opportunity o = new Opportunity();
        o.id = id;
        o.title = title;
        o.capacity = capacity;
        o.status = OppStatus.ACTIVE;
        return o;
    }

    private CandidateProfile createProfile(Long id, String fullName) {
        CandidateProfile p = new CandidateProfile();
        p.id = id;
        p.fullName = fullName;
        p.candidateState = CandidateState.ACTIVE;
        return p;
    }

    // ==================================================================
    // 1. POLICY Change Validation & Defect Fix
    // ==================================================================
    @Nested
    @DisplayName("1. Policy Change Handling & Validation")
    class PolicyChangeTests {

        @Test
        @DisplayName("1.1 — Valid POLICY change is accepted and creates child run with custom policy")
        void testValidPolicyChangeAccepted() {
            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "balanced", "Balanced Policy", "v1",
                    Weights.defaultBalanced().toJson(json), false, 10);
            DatasetSnapshot currentSnap = createSnapshot(10L);

            when(runs.findById(1L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(currentSnap));

            Map<String, Double> newWeights = Map.of(
                    "skills", 50.0, "qualification", 10.0, "interest", 10.0,
                    "location", 10.0, "preference", 10.0, "learning", 5.0, "experience", 5.0);

            ReallocationService.Change policyChange = new ReallocationService.Change(
                    "POLICY", null, null, null, newWeights, true, 25);
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                    1L, List.of(policyChange));

            AllocationRun mockChild = new AllocationRun();
            mockChild.id = 2L;
            mockChild.runCode = "RUN-CHILD-2";
            when(allocation.prepareRun(any(), eq(1L), any(), eq(adminUser))).thenReturn(mockChild);
            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

            AllocationRun result = reallocationService.start(req, adminUser);

            assertNotNull(result);
            assertEquals("Custom Reallocation Policy", result.policyName);
            assertEquals("custom", result.policyKey);
            assertEquals("v1", result.policyVersion);
            assertTrue(result.fullCoverage);
            assertEquals(25, result.fairnessFloorPct);
            assertTrue(result.changesJson.contains("custom weights applied"));
            assertTrue(result.changesJson.contains("full coverage enabled"));
            assertTrue(result.changesJson.contains("fairness floor set to 25%"));
            verify(allocation).submitForExecution(result);
        }

        @Test
        @DisplayName("1.2 — Multiple POLICY changes in a single reallocation request are rejected")
        void testMultiplePolicyChangesRejected() {
            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "balanced", "Balanced Policy", "v1",
                    Weights.defaultBalanced().toJson(json), false, 10);
            when(runs.findById(1L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(createSnapshot(10L)));

            ReallocationService.Change p1 = new ReallocationService.Change(
                    "POLICY", null, null, null, null, true, null);
            ReallocationService.Change p2 = new ReallocationService.Change(
                    "POLICY", null, null, null, null, false, null);
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                    1L, List.of(p1, p2));

            ApiException ex = assertThrows(ApiException.class, () -> reallocationService.start(req, adminUser));
            assertTrue(ex.getMessage().contains("Only one policy change"));
        }

        @Test
        @DisplayName("1.3 — Empty POLICY change (no fields provided) is rejected")
        void testEmptyPolicyChangeRejected() {
            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "balanced", "Balanced Policy", "v1",
                    Weights.defaultBalanced().toJson(json), false, 10);
            when(runs.findById(1L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(createSnapshot(10L)));

            ReallocationService.Change emptyP = new ReallocationService.Change(
                    "POLICY", null, null, null, null, null, null);
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                    1L, List.of(emptyP));

            ApiException ex = assertThrows(ApiException.class, () -> reallocationService.start(req, adminUser));
            assertTrue(ex.getMessage().contains("must specify at least one of"));
        }

        @Test
        @DisplayName("1.4 — POLICY change with weights not totaling 100% is rejected")
        void testInvalidWeightSumRejected() {
            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "balanced", "Balanced Policy", "v1",
                    Weights.defaultBalanced().toJson(json), false, 10);
            when(runs.findById(1L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(createSnapshot(10L)));

            Map<String, Double> invalidWeights = Map.of(
                    "skills", 50.0, "qualification", 10.0, "interest", 10.0,
                    "location", 10.0, "preference", 10.0, "learning", 5.0, "experience", 0.0); // sum = 95%

            ReallocationService.Change p = new ReallocationService.Change(
                    "POLICY", null, null, null, invalidWeights, null, null);
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                    1L, List.of(p));

            ApiException ex = assertThrows(ApiException.class, () -> reallocationService.start(req, adminUser));
            assertTrue(ex.getMessage().contains("total exactly 100%"));
        }

        @Test
        @DisplayName("1.5 — POLICY change with invalid fairness floor is rejected")
        void testInvalidFloorRejected() {
            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "balanced", "Balanced Policy", "v1",
                    Weights.defaultBalanced().toJson(json), false, 10);
            when(runs.findById(1L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(createSnapshot(10L)));

            ReallocationService.Change p = new ReallocationService.Change(
                    "POLICY", null, null, null, null, null, 105); // > 95%
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                    1L, List.of(p));

            ApiException ex = assertThrows(ApiException.class, () -> reallocationService.start(req, adminUser));
            assertTrue(ex.getMessage().contains("between 0% and 95%"));
        }
    }

    // ==================================================================
    // 2. Parent Policy Exact Inheritance
    // ==================================================================
    @Nested
    @DisplayName("2. Parent Policy Exact Inheritance")
    class ParentPolicyInheritanceTests {

        @Test
        @DisplayName("2.1 — Operational change without POLICY change preserves exact parent weights, fullCoverage, and floor")
        void testOperationalChangeInheritsParentPolicyExactly() {
            String parentWeightsJson = Weights.defaultBalanced().toJson(json);
            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "rural_priority", "Rural Priority Policy", "v2",
                    parentWeightsJson, true, 30);
            when(runs.findById(1L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(createSnapshot(10L)));

            Opportunity opp = createOpportunity(101L, "Backend Intern", 3);
            when(opportunities.findById(101L)).thenReturn(Optional.of(opp));

            ReallocationService.Change capChange = new ReallocationService.Change(
                    "CAPACITY", 101L, null, 5, null, null, null);
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                    1L, List.of(capChange));

            AllocationRun mockChild = new AllocationRun();
            mockChild.id = 2L;
            when(allocation.prepareRun(any(), eq(1L), any(), eq(adminUser))).thenReturn(mockChild);
            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

            AllocationRun result = reallocationService.start(req, adminUser);

            // Verifies zero drift from parent
            assertEquals("Rural Priority Policy", result.policyName);
            assertEquals("rural_priority", result.policyKey);
            assertEquals("v2", result.policyVersion);
            assertEquals(parentWeightsJson, result.weightsJson);
            assertTrue(result.fullCoverage);
            assertEquals(30, result.fairnessFloorPct);
        }

        @Test
        @DisplayName("2.2 — Custom parent policy is preserved exactly when child reallocates")
        void testCustomParentPolicyInheritedExactly() {
            Map<String, Double> customW = Map.of(
                    "skills", 40.0, "qualification", 20.0, "interest", 10.0,
                    "location", 10.0, "preference", 10.0, "learning", 5.0, "experience", 5.0);
            String customWeightsJson;
            try {
                customWeightsJson = json.writeValueAsString(customW);
            } catch (Exception e) {
                throw new RuntimeException(e);
            }

            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "custom", "My Custom Policy", "v1",
                    customWeightsJson, false, 15);
            when(runs.findById(1L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(createSnapshot(10L)));

            CandidateProfile cand = createProfile(201L, "Rahul Sharma");
            when(profiles.findById(201L)).thenReturn(Optional.of(cand));

            ReallocationService.Change withdraw = new ReallocationService.Change(
                    "WITHDRAW_CANDIDATE", null, 201L, null, null, null, null);
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                    1L, List.of(withdraw));

            AllocationRun mockChild = new AllocationRun();
            mockChild.id = 3L;
            when(allocation.prepareRun(any(), eq(1L), any(), eq(adminUser))).thenReturn(mockChild);
            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

            AllocationRun result = reallocationService.start(req, adminUser);

            assertEquals("My Custom Policy", result.policyName);
            assertEquals("custom", result.policyKey);
            assertEquals(customWeightsJson, result.weightsJson);
            assertFalse(result.fullCoverage);
            assertEquals(15, result.fairnessFloorPct);
        }

        @Test
        @DisplayName("2.3 — Partial policy override: explicit fullCoverage=false overrides parent true while keeping weights and floor")
        void testPartialPolicyOverrideFullCoverageFalse() {
            String parentWeightsJson = Weights.defaultBalanced().toJson(json);
            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "rural_priority", "Rural Priority Policy", "v2",
                    parentWeightsJson, true, 20); // parent had fullCoverage=true
            when(runs.findById(1L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(createSnapshot(10L)));

            ReallocationService.Change policyChange = new ReallocationService.Change(
                    "POLICY", null, null, null, null, false, null); // explicit fullCoverage=false
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                    1L, List.of(policyChange));

            AllocationRun mockChild = new AllocationRun();
            mockChild.id = 4L;
            when(allocation.prepareRun(any(), eq(1L), any(), eq(adminUser))).thenReturn(mockChild);
            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

            AllocationRun result = reallocationService.start(req, adminUser);

            assertFalse(result.fullCoverage, "fullCoverage must be overridden to false");
            assertEquals(parentWeightsJson, result.weightsJson, "weights must be inherited from parent");
            assertEquals(20, result.fairnessFloorPct, "fairness floor must be inherited from parent");
            assertTrue(result.policyName.contains("(Modified)"));
        }

        @Test
        @DisplayName("2.4 — Partial policy override: explicit fairnessFloorPct=0 overrides parent floor while keeping weights and coverage")
        void testPartialPolicyOverrideFloorZero() {
            String parentWeightsJson = Weights.defaultBalanced().toJson(json);
            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "rural_priority", "Rural Priority Policy", "v2",
                    parentWeightsJson, true, 25); // parent had floor=25
            when(runs.findById(1L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(createSnapshot(10L)));

            ReallocationService.Change policyChange = new ReallocationService.Change(
                    "POLICY", null, null, null, null, null, 0); // explicit floor=0
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                    1L, List.of(policyChange));

            AllocationRun mockChild = new AllocationRun();
            mockChild.id = 5L;
            when(allocation.prepareRun(any(), eq(1L), any(), eq(adminUser))).thenReturn(mockChild);
            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

            AllocationRun result = reallocationService.start(req, adminUser);

            assertEquals(0, result.fairnessFloorPct, "fairnessFloorPct must be overridden to 0");
            assertEquals(parentWeightsJson, result.weightsJson, "weights must be inherited from parent");
            assertTrue(result.fullCoverage, "fullCoverage must be inherited from parent");
            assertTrue(result.policyName.contains("(Modified)"));
        }

        @Test
        @DisplayName("2.5 — Audit record is written for POLICY modification during reallocation")
        void testAuditConsistencyOnPolicyChange() {
            String parentWeightsJson = Weights.defaultBalanced().toJson(json);
            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "balanced", "Balanced Policy", "v1",
                    parentWeightsJson, false, null);
            when(runs.findById(1L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(createSnapshot(10L)));

            ReallocationService.Change policyChange = new ReallocationService.Change(
                    "POLICY", null, null, null, null, true, 10);
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                    1L, List.of(policyChange));

            AllocationRun mockChild = new AllocationRun();
            mockChild.id = 6L;
            mockChild.number = 6;
            mockChild.policyKey = "balanced";
            when(allocation.prepareRun(any(), eq(1L), any(), eq(adminUser))).thenReturn(mockChild);
            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

            reallocationService.start(req, adminUser);

            // Verifies explicit audit record logged for policy update
            verify(audit).log(eq(adminUser), eq(AuditAction.POLICY_UPDATED), eq("Policy"),
                    eq("balanced"), contains("policy updated"), isNull());
        }
    }

    // ==================================================================
    // 3. Operational Changes: Capacity & Withdrawals
    // ==================================================================
    @Nested
    @DisplayName("3. Operational Changes Validation")
    class OperationalChangesTests {

        @Test
        @DisplayName("3.1 — Capacity change: increase, decrease, reduce to 0 reach overridesJson correctly")
        void testCapacityOverrides() throws Exception {
            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "balanced", "Balanced Policy", "v1",
                    Weights.defaultBalanced().toJson(json), false, null);
            when(runs.findById(1L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(createSnapshot(10L)));

            Opportunity o1 = createOpportunity(101L, "Opp 1", 2);
            Opportunity o2 = createOpportunity(102L, "Opp 2", 5);
            Opportunity o3 = createOpportunity(103L, "Opp 3", 1);
            when(opportunities.findById(101L)).thenReturn(Optional.of(o1));
            when(opportunities.findById(102L)).thenReturn(Optional.of(o2));
            when(opportunities.findById(103L)).thenReturn(Optional.of(o3));

            List<ReallocationService.Change> changes = List.of(
                    new ReallocationService.Change("CAPACITY", 101L, null, 4, null, null, null), // increase
                    new ReallocationService.Change("CAPACITY", 102L, null, 1, null, null, null), // decrease
                    new ReallocationService.Change("CAPACITY", 103L, null, 0, null, null, null)  // reduce to 0
            );
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(1L, changes);

            ArgumentCaptor<String> overridesCaptor = ArgumentCaptor.forClass(String.class);
            AllocationRun mockChild = new AllocationRun();
            mockChild.id = 2L;
            when(allocation.prepareRun(any(), eq(1L), overridesCaptor.capture(), eq(adminUser))).thenReturn(mockChild);
            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

            reallocationService.start(req, adminUser);

            String overridesJson = overridesCaptor.getValue();
            assertNotNull(overridesJson);
            JsonNode tree = json.readTree(overridesJson);
            JsonNode caps = tree.path("capacityOverrides");
            assertEquals(4, caps.path("101").asInt());
            assertEquals(1, caps.path("102").asInt());
            assertEquals(0, caps.path("103").asInt());
        }

        @Test
        @DisplayName("3.2 — Candidate and Opportunity withdrawals reach overridesJson correctly")
        void testWithdrawals() throws Exception {
            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "balanced", "Balanced Policy", "v1",
                    Weights.defaultBalanced().toJson(json), false, null);
            when(runs.findById(1L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(createSnapshot(10L)));

            CandidateProfile c1 = createProfile(501L, "Candidate 1");
            CandidateProfile c2 = createProfile(502L, "Candidate 2");
            Opportunity o1 = createOpportunity(301L, "Opp 1", 2);
            when(profiles.findById(501L)).thenReturn(Optional.of(c1));
            when(profiles.findById(502L)).thenReturn(Optional.of(c2));
            when(opportunities.findById(301L)).thenReturn(Optional.of(o1));

            List<ReallocationService.Change> changes = List.of(
                    new ReallocationService.Change("WITHDRAW_CANDIDATE", null, 501L, null, null, null, null),
                    new ReallocationService.Change("WITHDRAW_CANDIDATE", null, 502L, null, null, null, null),
                    new ReallocationService.Change("WITHDRAW_OPPORTUNITY", 301L, null, null, null, null, null)
            );
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(1L, changes);

            ArgumentCaptor<String> overridesCaptor = ArgumentCaptor.forClass(String.class);
            AllocationRun mockChild = new AllocationRun();
            mockChild.id = 2L;
            when(allocation.prepareRun(any(), eq(1L), overridesCaptor.capture(), eq(adminUser))).thenReturn(mockChild);
            when(runs.save(any(AllocationRun.class))).thenAnswer(i -> i.getArgument(0));

            reallocationService.start(req, adminUser);

            String overridesJson = overridesCaptor.getValue();
            assertNotNull(overridesJson);
            JsonNode tree = json.readTree(overridesJson);
            JsonNode wc = tree.path("withdrawnCandidates");
            JsonNode wo = tree.path("withdrawnOpportunities");
            assertEquals(2, wc.size());
            assertEquals(501L, wc.get(0).asLong());
            assertEquals(502L, wc.get(1).asLong());
            assertEquals(1, wo.size());
            assertEquals(301L, wo.get(0).asLong());
        }

        @Test
        @DisplayName("3.3 — Duplicate capacity changes on the same opportunity are rejected")
        void testDuplicateCapacityRejected() {
            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "balanced", "Balanced Policy", "v1",
                    Weights.defaultBalanced().toJson(json), false, null);
            when(runs.findById(1L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(createSnapshot(10L)));
            when(opportunities.findById(101L)).thenReturn(Optional.of(createOpportunity(101L, "Opp 101", 5)));

            List<ReallocationService.Change> changes = List.of(
                    new ReallocationService.Change("CAPACITY", 101L, null, 2, null, null, null),
                    new ReallocationService.Change("CAPACITY", 101L, null, 3, null, null, null)
            );
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(1L, changes);

            ApiException ex = assertThrows(ApiException.class, () -> reallocationService.start(req, adminUser));
            assertTrue(ex.getMessage().contains("Duplicate capacity change"));
        }

        @Test
        @DisplayName("3.4 — Contradictory changes (capacity change AND withdrawal of same opportunity) are rejected")
        void testContradictoryOppChangesRejected() {
            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "balanced", "Balanced Policy", "v1",
                    Weights.defaultBalanced().toJson(json), false, null);
            when(runs.findById(1L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(createSnapshot(10L)));
            when(opportunities.findById(101L)).thenReturn(Optional.of(createOpportunity(101L, "Opp 101", 5)));

            List<ReallocationService.Change> changes = List.of(
                    new ReallocationService.Change("CAPACITY", 101L, null, 2, null, null, null),
                    new ReallocationService.Change("WITHDRAW_OPPORTUNITY", 101L, null, null, null, null, null)
            );
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(1L, changes);

            ApiException ex = assertThrows(ApiException.class, () -> reallocationService.start(req, adminUser));
            assertTrue(ex.getMessage().contains("Contradictory changes"));
        }

        @Test
        @DisplayName("3.5 — Duplicate candidate withdrawal is rejected")
        void testDuplicateCandidateWithdrawalRejected() {
            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "balanced", "Balanced Policy", "v1",
                    Weights.defaultBalanced().toJson(json), false, null);
            when(runs.findById(1L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(createSnapshot(10L)));
            when(profiles.findById(201L)).thenReturn(Optional.of(createProfile(201L, "Candidate 201")));

            List<ReallocationService.Change> changes = List.of(
                    new ReallocationService.Change("WITHDRAW_CANDIDATE", null, 201L, null, null, null, null),
                    new ReallocationService.Change("WITHDRAW_CANDIDATE", null, 201L, null, null, null, null)
            );
            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(1L, changes);

            ApiException ex = assertThrows(ApiException.class, () -> reallocationService.start(req, adminUser));
            assertTrue(ex.getMessage().contains("Duplicate withdrawal"));
        }

        @Test
        @DisplayName("3.6 — Unknown candidate or unknown opportunity is rejected cleanly")
        void testUnknownEntitiesRejected() {
            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "balanced", "Balanced Policy", "v1",
                    Weights.defaultBalanced().toJson(json), false, null);
            when(runs.findById(1L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(createSnapshot(10L)));

            when(opportunities.findById(999L)).thenReturn(Optional.empty());
            when(profiles.findById(888L)).thenReturn(Optional.empty());

            ReallocationService.ReallocationRequest req1 = new ReallocationService.ReallocationRequest(
                    1L, List.of(new ReallocationService.Change("CAPACITY", 999L, null, 2, null, null, null)));
            ApiException ex1 = assertThrows(ApiException.class, () -> reallocationService.start(req1, adminUser));
            assertTrue(ex1.getMessage().contains("Unknown opportunity"));

            ReallocationService.ReallocationRequest req2 = new ReallocationService.ReallocationRequest(
                    1L, List.of(new ReallocationService.Change("WITHDRAW_CANDIDATE", null, 888L, null, null, null, null)));
            ApiException ex2 = assertThrows(ApiException.class, () -> reallocationService.start(req2, adminUser));
            assertTrue(ex2.getMessage().contains("Unknown candidate"));
        }
    }

    // ==================================================================
    // 4. State & Precondition Guard Tests
    // ==================================================================
    @Nested
    @DisplayName("4. Precondition Guards & Snapshot Integrity")
    class PreconditionTests {

        @Test
        @DisplayName("4.1 — Attempted reallocation from an incomplete parent run is rejected")
        void testIncompleteParentRejected() {
            AllocationRun runningParent = createCompletedParentRun(
                    1L, 10L, "balanced", "Balanced Policy", "v1",
                    Weights.defaultBalanced().toJson(json), false, null);
            runningParent.status = RunStatus.RUNNING; // not COMPLETED

            when(runs.findById(1L)).thenReturn(Optional.of(runningParent));

            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                    1L, List.of(new ReallocationService.Change("POLICY", null, null, null, null, true, null)));

            ApiException ex = assertThrows(ApiException.class, () -> reallocationService.start(req, adminUser));
            assertTrue(ex.getMessage().contains("completed allocation run"));
        }

        @Test
        @DisplayName("4.2 — Attempted reallocation after dataset snapshot changed is rejected with Conflict")
        void testSnapshotMismatchRejected() {
            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "balanced", "Balanced Policy", "v1",
                    Weights.defaultBalanced().toJson(json), false, null); // snapshot 10
            DatasetSnapshot newSnap = createSnapshot(11L); // snapshot 11 (new scenario loaded)

            when(runs.findById(1L)).thenReturn(Optional.of(parent));
            when(snapshots.findTopByOrderByIdDesc()).thenReturn(Optional.of(newSnap));

            ReallocationService.ReallocationRequest req = new ReallocationService.ReallocationRequest(
                    1L, List.of(new ReallocationService.Change("POLICY", null, null, null, null, true, null)));

            ApiException ex = assertThrows(ApiException.class, () -> reallocationService.start(req, adminUser));
            assertEquals(409, ex.getStatus().value());
            assertTrue(ex.getMessage().contains("dataset changed"));
        }
    }

    // ==================================================================
    // 5. Diff Reconciliations & Categorization
    // ==================================================================
    @Nested
    @DisplayName("5. Diff Reconciliation Tests")
    class DiffTests {

        @Test
        @DisplayName("5.1 — Diff correctly categorizes ADDED, REMOVED, MOVED, and UNCHANGED assignments")
        void testDiffCategorization() {
            AllocationRun parent = createCompletedParentRun(
                    1L, 10L, "balanced", "Balanced Policy", "v1",
                    Weights.defaultBalanced().toJson(json), false, null);
            AllocationRun child = new AllocationRun();
            child.id = 2L;
            child.number = 2;
            child.parentRunId = 1L;
            child.status = RunStatus.COMPLETED;

            when(runs.findById(2L)).thenReturn(Optional.of(child));
            when(runs.findById(1L)).thenReturn(Optional.of(parent));

            // Candidate 1: 101 -> 101 (UNCHANGED)
            // Candidate 2: 101 -> 102 (MOVED)
            // Candidate 3: 102 -> null (REMOVED)
            // Candidate 4: null -> 101 (ADDED)
            Assignment p1 = createAssignment(1L, 1L, 101L, 85.0);
            Assignment p2 = createAssignment(1L, 2L, 101L, 80.0);
            Assignment p3 = createAssignment(1L, 3L, 102L, 75.0);
            when(assignments.findByRunIdAndSource(1L, AssignmentSource.GLOBAL)).thenReturn(List.of(p1, p2, p3));

            Assignment c1 = createAssignment(2L, 1L, 101L, 85.0);
            Assignment c2 = createAssignment(2L, 2L, 102L, 90.0);
            Assignment c4 = createAssignment(2L, 4L, 101L, 70.0);
            when(assignments.findByRunIdAndSource(2L, AssignmentSource.GLOBAL)).thenReturn(List.of(c1, c2, c4));

            when(profiles.findById(anyLong())).thenAnswer(i -> {
                Long cid = i.getArgument(0);
                return Optional.of(createProfile(cid, "Candidate " + cid));
            });
            when(opportunities.findById(anyLong())).thenAnswer(i -> {
                Long oid = i.getArgument(0);
                return Optional.of(createOpportunity(oid, "Opportunity " + oid, 2));
            });

            ReallocationService.DiffDto diff = reallocationService.diff(2L);

            assertNotNull(diff);
            assertEquals(1, diff.unchanged());
            assertEquals(1, diff.moved());
            assertEquals(1, diff.removed());
            assertEquals(1, diff.added());
            assertEquals(4, diff.entries().size());
            assertEquals(diff.entries().size(), diff.unchanged() + diff.moved() + diff.removed() + diff.added());
        }

        @Test
        @DisplayName("5.2 — Diff rejects incomplete child runs (QUEUED, RUNNING) to avoid false REMOVED counts")
        void testDiffRejectsInProgressChildRun() {
            AllocationRun childQueued = new AllocationRun();
            childQueued.id = 10L;
            childQueued.parentRunId = 1L;
            childQueued.status = RunStatus.QUEUED;

            when(runs.findById(10L)).thenReturn(Optional.of(childQueued));

            ApiException exQueued = assertThrows(ApiException.class, () -> reallocationService.diff(10L));
            assertTrue(exQueued.getMessage().contains("still in progress"));

            AllocationRun childRunning = new AllocationRun();
            childRunning.id = 11L;
            childRunning.parentRunId = 1L;
            childRunning.status = RunStatus.RUNNING;

            when(runs.findById(11L)).thenReturn(Optional.of(childRunning));

            ApiException exRunning = assertThrows(ApiException.class, () -> reallocationService.diff(11L));
            assertTrue(exRunning.getMessage().contains("still in progress"));
        }

        @Test
        @DisplayName("5.3 — Diff rejects terminal non-completed child runs (INFEASIBLE, FAILED)")
        void testDiffRejectsInfeasibleOrFailedChildRun() {
            AllocationRun childInfeasible = new AllocationRun();
            childInfeasible.id = 20L;
            childInfeasible.parentRunId = 1L;
            childInfeasible.status = RunStatus.INFEASIBLE;

            when(runs.findById(20L)).thenReturn(Optional.of(childInfeasible));

            ApiException exInfeasible = assertThrows(ApiException.class, () -> reallocationService.diff(20L));
            assertTrue(exInfeasible.getMessage().contains("infeasible"));

            AllocationRun childFailed = new AllocationRun();
            childFailed.id = 21L;
            childFailed.parentRunId = 1L;
            childFailed.status = RunStatus.FAILED;

            when(runs.findById(21L)).thenReturn(Optional.of(childFailed));

            ApiException exFailed = assertThrows(ApiException.class, () -> reallocationService.diff(21L));
            assertTrue(exFailed.getMessage().contains("failed"));
        }

        @Test
        @DisplayName("5.4 — Diff rejects reallocation when parent run is not completed")
        void testDiffRejectsIncompleteParentRun() {
            AllocationRun child = new AllocationRun();
            child.id = 30L;
            child.parentRunId = 5L;
            child.status = RunStatus.COMPLETED;

            AllocationRun incompleteParent = new AllocationRun();
            incompleteParent.id = 5L;
            incompleteParent.status = RunStatus.FAILED;

            when(runs.findById(30L)).thenReturn(Optional.of(child));
            when(runs.findById(5L)).thenReturn(Optional.of(incompleteParent));

            ApiException ex = assertThrows(ApiException.class, () -> reallocationService.diff(30L));
            assertTrue(ex.getMessage().contains("Parent allocation run is not completed"));
        }

        private Assignment createAssignment(Long runId, Long candId, Long oppId, double suitability) {
            Assignment a = new Assignment();
            a.runId = runId;
            a.candidateId = candId;
            a.opportunityId = oppId;
            a.source = AssignmentSource.GLOBAL;
            a.suitability = suitability;
            return a;
        }
    }
}
