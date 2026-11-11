package in.nextalloc.service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;

import in.nextalloc.common.ApiException;
import in.nextalloc.common.Weights;
import in.nextalloc.domain.*;
import in.nextalloc.domain.enums.AssignmentSource;
import in.nextalloc.domain.enums.AuditAction;
import in.nextalloc.domain.enums.RunStatus;
import in.nextalloc.repo.*;
import in.nextalloc.security.AuthUser;

/**
 * Reallocation: previous optimized allocation + operational change
 * (capacity, withdrawals, policy) → new optimized allocation.
 * Sandbox by design: changes are run-scoped inputs; production data is
 * never mutated. The diff always compares parent allocation vs child
 * allocation (never the greedy baseline).
 */
@Service
public class ReallocationService {

    public record Change(String type, Long opportunityId, Long candidateId,
                         Integer newCapacity, Map<String, Double> weights,
                         Boolean fullCoverage, Integer fairnessFloorPct,
                         String policyVersion, String eligibilityRuleSetId,
                         String eligibilityRuleSetVersion) {
        public Change(String type, Long opportunityId, Long candidateId,
                      Integer newCapacity, Map<String, Double> weights,
                      Boolean fullCoverage, Integer fairnessFloorPct,
                      String policyVersion) {
            this(type, opportunityId, candidateId, newCapacity, weights, fullCoverage, fairnessFloorPct, policyVersion, null, null);
        }
        public Change(String type, Long opportunityId, Long candidateId,
                      Integer newCapacity, Map<String, Double> weights,
                      Boolean fullCoverage, Integer fairnessFloorPct) {
            this(type, opportunityId, candidateId, newCapacity, weights, fullCoverage, fairnessFloorPct, null, null, null);
        }
    }

    public record ReallocationRequest(Long baseRunId, List<Change> changes) { }

    public record DiffEntry(Long candidateId, String candidateName, String before, String after,
                            double beforeScore, double afterScore, String status, String reason) { }

    public record DiffDto(Long runId, int runNumber, Long parentRunId, int parentRunNumber,
                          String changes, int moved, int added, int removed, int unchanged,
                          List<DiffEntry> entries) { }

    private final AllocationRunRepository runs;
    private final DatasetSnapshotRepository snapshots;
    private final CandidateProfileRepository profiles;
    private final OpportunityRepository opportunities;
    private final AssignmentRepository assignments;
    private final AllocationService allocation;
    private final AuditService audit;
    private final ObjectMapper json;

    public ReallocationService(AllocationRunRepository runs, DatasetSnapshotRepository snapshots,
                               CandidateProfileRepository profiles, OpportunityRepository opportunities,
                               AssignmentRepository assignments, AllocationService allocation,
                               AuditService audit, ObjectMapper json) {
        this.runs = runs; this.snapshots = snapshots; this.profiles = profiles;
        this.opportunities = opportunities; this.assignments = assignments;
        this.allocation = allocation; this.audit = audit; this.json = json;
    }

    public AllocationRun start(ReallocationRequest req, AuthUser actor) {
        if (req == null || req.baseRunId() == null) {
            throw ApiException.badRequest("The base allocation run ID is required.");
        }
        AllocationRun base = runs.findById(req.baseRunId())
                .orElseThrow(() -> ApiException.notFound("The selected allocation run was not found."));
        if (base.status != RunStatus.COMPLETED) {
            throw ApiException.badRequest("Reallocation requires a completed allocation run.");
        }
        DatasetSnapshot current = snapshots.findTopByOrderByIdDesc().orElseThrow();
        if (!current.id.equals(base.snapshotId)) {
            throw ApiException.conflict("The dataset changed after this run completed. Run a fresh allocation first, then reallocate.");
        }
        if (req.changes() == null || req.changes().isEmpty()) {
            throw ApiException.badRequest("Select at least one operational change.");
        }

        Map<Integer, Integer> caps = new LinkedHashMap<>();
        List<Long> wc = new ArrayList<>();
        List<Long> wo = new ArrayList<>();
        Change policyChange = null;
        List<String> changeDescriptions = new ArrayList<>();

        for (Change c : req.changes()) {
            if (c == null || c.type() == null || c.type().isBlank()) {
                throw ApiException.badRequest("Change type is required.");
            }
            switch (c.type()) {
                case "CAPACITY" -> {
                    if (c.opportunityId() == null) {
                        throw ApiException.badRequest("Opportunity ID is required for capacity change.");
                    }
                    if (caps.containsKey(c.opportunityId().intValue())) {
                        throw ApiException.badRequest("Duplicate capacity change for opportunity: " + c.opportunityId());
                    }
                    if (wo.contains(c.opportunityId())) {
                        throw ApiException.badRequest("Contradictory changes for opportunity " + c.opportunityId()
                                + ": cannot both modify capacity and withdraw.");
                    }
                    Opportunity o = opportunities.findById(c.opportunityId())
                            .orElseThrow(() -> ApiException.badRequest("Unknown opportunity in change."));
                    if (c.newCapacity() == null || c.newCapacity() < 0 || c.newCapacity() > 500) {
                        throw ApiException.badRequest("Capacity must be between 0 and 500.");
                    }
                    caps.put(o.id.intValue(), c.newCapacity());
                    changeDescriptions.add(o.title + ": seats changed from " + o.capacity + " to " + c.newCapacity());
                }
                case "WITHDRAW_CANDIDATE" -> {
                    if (c.candidateId() == null) {
                        throw ApiException.badRequest("Candidate ID is required for candidate withdrawal.");
                    }
                    if (wc.contains(c.candidateId())) {
                        throw ApiException.badRequest("Duplicate withdrawal for candidate: " + c.candidateId());
                    }
                    CandidateProfile p = profiles.findById(c.candidateId())
                            .orElseThrow(() -> ApiException.badRequest("Unknown candidate in change."));
                    wc.add(p.id);
                    changeDescriptions.add(p.fullName + " withdrew from the allocation.");
                }
                case "WITHDRAW_OPPORTUNITY" -> {
                    if (c.opportunityId() == null) {
                        throw ApiException.badRequest("Opportunity ID is required for opportunity withdrawal.");
                    }
                    if (wo.contains(c.opportunityId())) {
                        throw ApiException.badRequest("Duplicate withdrawal for opportunity: " + c.opportunityId());
                    }
                    if (caps.containsKey(c.opportunityId().intValue())) {
                        throw ApiException.badRequest("Contradictory changes for opportunity " + c.opportunityId()
                                + ": cannot both modify capacity and withdraw.");
                    }
                    Opportunity o = opportunities.findById(c.opportunityId())
                            .orElseThrow(() -> ApiException.badRequest("Unknown opportunity in change."));
                    wo.add(o.id);
                    changeDescriptions.add(o.title + " was withdrawn.");
                }
                case "POLICY" -> {
                    if (policyChange != null) {
                        throw ApiException.badRequest("Only one policy change may be specified per reallocation.");
                    }
                    if (c.weights() == null && c.fullCoverage() == null && c.fairnessFloorPct() == null && c.policyVersion() == null && c.eligibilityRuleSetId() == null) {
                        throw ApiException.badRequest("Policy change must specify at least one of: weights, full coverage, fairness floor, policy version, or eligibility rule set.");
                    }
                    if (c.weights() != null) {
                        if (c.weights().isEmpty()) {
                            throw ApiException.badRequest("Policy weights must not be empty.");
                        }
                        double sum = 0.0;
                        for (String k : Weights.KEYS) {
                            double v = c.weights().getOrDefault(k, 0.0);
                            if (v < 0 || v > 100) {
                                throw ApiException.badRequest("Each weight must be between 0 and 100.");
                            }
                            sum += v;
                        }
                        if (Math.abs(sum - 100.0) > 0.001) {
                            throw ApiException.badRequest("Policy weights must total exactly 100%.");
                        }
                    }
                    if (c.fairnessFloorPct() != null && (c.fairnessFloorPct() < 0 || c.fairnessFloorPct() > 95)) {
                        throw ApiException.badRequest("The fairness floor must be between 0% and 95%.");
                    }
                    List<String> descParts = new ArrayList<>();
                    if (c.weights() != null) {
                        descParts.add("custom weights applied");
                    }
                    if (c.fullCoverage() != null) {
                        descParts.add("full coverage " + (c.fullCoverage() ? "enabled" : "disabled"));
                    }
                    if (c.fairnessFloorPct() != null) {
                        descParts.add("fairness floor set to " + c.fairnessFloorPct() + "%");
                    }
                    if (c.policyVersion() != null && !c.policyVersion().isBlank()) {
                        descParts.add("policy version set to " + c.policyVersion());
                    }
                    if (c.eligibilityRuleSetId() != null && !c.eligibilityRuleSetId().isBlank()) {
                        descParts.add("eligibility rule set changed to " + c.eligibilityRuleSetId());
                    }
                    changeDescriptions.add("Policy modified: " + String.join(", ", descParts) + ".");
                    policyChange = c;
                }
                default -> throw ApiException.badRequest("Unknown change type: " + c.type());
            }
        }

        try {
            Map<String, Object> overrides = new LinkedHashMap<>();
            if (!caps.isEmpty()) overrides.put("capacityOverrides", caps);
            if (!wc.isEmpty()) overrides.put("withdrawnCandidates", wc);
            if (!wo.isEmpty()) overrides.put("withdrawnOpportunities", wo);

            String overridesJson = overrides.isEmpty() ? null : json.writeValueAsString(overrides);
            String changesJson = json.writeValueAsString(changeDescriptions);
            AllocationRun parent = base;

            Map<String, Double> effectiveWeights;
            String effectivePolicyName;
            String effectivePolicyKey;
            String effectivePolicyVersion;

            if (policyChange != null && policyChange.policyVersion() != null && !policyChange.policyVersion().isBlank()) {
                effectivePolicyVersion = AllocationService.validatePolicyVersion(policyChange.policyVersion());
            } else {
                effectivePolicyVersion = AllocationService.resolvePolicyVersion(parent);
            }

            if (policyChange != null && policyChange.weights() != null && !policyChange.weights().isEmpty()) {
                effectiveWeights = policyChange.weights();
                effectivePolicyName = "Custom Reallocation Policy";
                effectivePolicyKey = "custom";
            } else {
                Weights parentW = Weights.parse(parent.weightsJson, json);
                effectiveWeights = parentW.toMap();
                effectivePolicyName = policyChange != null ? parent.policyName + " (Modified)" : parent.policyName;
                effectivePolicyKey = parent.policyKey;
            }

            boolean effectiveFullCoverage = policyChange != null && policyChange.fullCoverage() != null
                    ? policyChange.fullCoverage()
                    : parent.fullCoverage;

            Integer effectiveFloor = policyChange != null && policyChange.fairnessFloorPct() != null
                    ? policyChange.fairnessFloorPct()
                    : parent.fairnessFloorPct;

            String effectiveEligibilityRuleSetId = parent.eligibilityRuleSetId != null
                    ? parent.eligibilityRuleSetId : EligibilityEvaluator.RULESET_LEGACY;
            String effectiveEligibilityRuleSetVersion = parent.eligibilityRuleSetVersion != null
                    ? parent.eligibilityRuleSetVersion : EligibilityEvaluator.VERSION_1_0_0;
            if (policyChange != null && policyChange.eligibilityRuleSetId() != null && !policyChange.eligibilityRuleSetId().isBlank()) {
                effectiveEligibilityRuleSetId = policyChange.eligibilityRuleSetId();
                effectiveEligibilityRuleSetVersion = policyChange.eligibilityRuleSetVersion() != null
                        ? policyChange.eligibilityRuleSetVersion() : EligibilityEvaluator.VERSION_1_0_0;
            }

            AllocationService.StartRunRequest startReq;
            if (policyChange != null && policyChange.weights() != null && !policyChange.weights().isEmpty()) {
                startReq = new AllocationService.StartRunRequest(
                        null, effectiveWeights, effectiveFullCoverage, effectiveFloor, effectivePolicyVersion,
                        effectiveEligibilityRuleSetId, effectiveEligibilityRuleSetVersion);
            } else if (policyChange == null && !"custom".equals(parent.policyKey)) {
                // Parent used a standard preset and policy wasn't changed:
                // Pass parent.policyKey so prepareRun() logs the matching preset name in its audit trail.
                startReq = new AllocationService.StartRunRequest(
                        parent.policyKey, null, effectiveFullCoverage, effectiveFloor, effectivePolicyVersion,
                        effectiveEligibilityRuleSetId, effectiveEligibilityRuleSetVersion);
            } else {
                startReq = new AllocationService.StartRunRequest(
                        null, effectiveWeights, effectiveFullCoverage, effectiveFloor, effectivePolicyVersion,
                        effectiveEligibilityRuleSetId, effectiveEligibilityRuleSetVersion);
            }
            AllocationRun run = allocation.prepareRun(startReq, parent.id, overridesJson, actor);

            // Enforce exact policy metadata and full provenance preservation
            run.policyName = effectivePolicyName;
            run.policyKey = effectivePolicyKey;
            run.policyVersion = effectivePolicyVersion;
            run.eligibilityRuleSetId = effectiveEligibilityRuleSetId;
            run.eligibilityRuleSetVersion = effectiveEligibilityRuleSetVersion;
            if (policyChange == null || policyChange.weights() == null) {
                run.weightsJson = parent.weightsJson;
            }
            run.fullCoverage = effectiveFullCoverage;
            run.fairnessFloorPct = effectiveFloor;
            run.changesJson = changesJson;

            runs.save(run);

            if (policyChange != null) {
                audit.log(actor, AuditAction.POLICY_UPDATED, "Policy", run.policyKey,
                        "Reallocation run #" + run.number + " policy updated: " + changesJson, null);
            }

            allocation.submitForExecution(run);
            return run;
        } catch (ApiException e) {
            throw e;
        } catch (Exception e) {
            throw ApiException.badRequest("The reallocation could not be prepared. Please check the selected changes.");
        }
    }

    public Page<AllocationRun> reallocationRuns(int page, int size) {
        return runs.findAllByOrderByCreatedAtDesc(PageRequest.of(page, size));
    }

    public DiffDto diff(Long runId) {
        AllocationRun child = runs.findById(runId)
                .orElseThrow(() -> ApiException.notFound("Allocation run not found."));
        if (child.parentRunId == null) {
            throw ApiException.badRequest("This run is not a reallocation, so there is no parent allocation to compare.");
        }
        if (child.status != RunStatus.COMPLETED) {
            String msg = switch (child.status) {
                case QUEUED, RUNNING -> "The reallocation is still in progress. Diff is available once completed.";
                case INFEASIBLE -> "The reallocation was infeasible. No new assignments were generated.";
                case FAILED -> "The reallocation failed. Diff is not available for failed runs.";
                default -> "Diff is available for completed reallocation runs only.";
            };
            throw ApiException.badRequest(msg);
        }
        AllocationRun parent = runs.findById(child.parentRunId)
                .orElseThrow(() -> ApiException.notFound("Parent allocation run not found."));
        if (parent.status != RunStatus.COMPLETED) {
            throw ApiException.badRequest("Parent allocation run is not completed.");
        }
        List<Assignment> pList = assignments.findByRunIdAndSource(parent.id, AssignmentSource.GLOBAL);
        List<Assignment> cList = assignments.findByRunIdAndSource(child.id, AssignmentSource.GLOBAL);
        Map<Long, Assignment> p = new java.util.HashMap<>();
        for (Assignment a : pList) p.put(a.candidateId, a);
        Map<Long, Assignment> c = new java.util.HashMap<>();
        for (Assignment a : cList) c.put(a.candidateId, a);
        java.util.Set<Long> allCands = new java.util.TreeSet<>();
        allCands.addAll(p.keySet());
        allCands.addAll(c.keySet());

        int moved = 0, added = 0, removed = 0, unchanged = 0;
        List<DiffEntry> entries = new ArrayList<>();
        Map<Long, String> oppNames = new java.util.HashMap<>();
        for (Long cand : allCands) {
            Assignment pa = p.get(cand);
            Assignment ca = c.get(cand);
            String status;
            if (pa == null && ca != null) { status = "ADDED"; added++; }
            else if (pa != null && ca == null) { status = "REMOVED"; removed++; }
            else if (!pa.opportunityId.equals(ca.opportunityId)) { status = "MOVED"; moved++; }
            else { status = "UNCHANGED"; unchanged++; }
            String before = pa == null ? "Not allocated" : oppName(pa.opportunityId, oppNames);
            String after = ca == null ? "Not allocated" : oppName(ca.opportunityId, oppNames);
            String name = profiles.findById(cand).map(x -> x.fullName).orElse("Candidate");
            String reason = switch (status) {
                case "MOVED" -> "The operational change altered capacity or eligibility, so the global re-optimization moved this candidate.";
                case "ADDED" -> "Previously unallocated; the new allocation found a seat for this candidate.";
                case "REMOVED" -> "No longer allocated after the operational change.";
                default -> "Unaffected by the change.";
            };
            entries.add(new DiffEntry(cand, name, before, after,
                    pa != null ? pa.suitability : 0, ca != null ? ca.suitability : 0, status, reason));
        }
        String changes;
        try {
            changes = child.changesJson == null ? "No change description." : json.readTree(child.changesJson).toString();
        } catch (Exception e) {
            changes = "No change description.";
        }
        return new DiffDto(child.id, child.number, parent.id, parent.number,
                changes, moved, added, removed, unchanged, entries);
    }

    private String oppName(Long id, Map<Long, String> cache) {
        return cache.computeIfAbsent(id, x -> opportunities.findById(x).map(o -> o.title).orElse("Opportunity"));
    }

    public void auditReallocationCompletion(AllocationRun run) {
        if (run.parentRunId != null && run.status == RunStatus.COMPLETED) {
            audit.logSystem(AuditAction.REALLOCATION_COMPLETED, "AllocationRun", run.runCode,
                    "Reallocation run #" + run.number + " completed (parent run #" + run.parentRunId + ").", null);
        }
    }
}
