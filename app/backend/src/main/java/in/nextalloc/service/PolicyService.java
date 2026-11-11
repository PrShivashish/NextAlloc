package in.nextalloc.service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.ObjectMapper;

import in.nextalloc.ai.AiServiceClient;
import in.nextalloc.common.ApiException;
import in.nextalloc.common.Weights;
import in.nextalloc.domain.*;
import in.nextalloc.domain.enums.*;
import in.nextalloc.repo.*;
import in.nextalloc.security.AuthUser;
import in.nextalloc.service.SuitabilityService.EligiblePair;
import in.nextalloc.service.SuitabilityService.PairScore;

/**
 * What-if policy simulation. Runs the real optimizer in a sandbox against
 * the same dataset snapshot as the selected completed run; never mutates
 * the production allocation or the dataset.
 */
@Service
public class PolicyService {

    private static final Logger log = LoggerFactory.getLogger(PolicyService.class);

    public record SimulateRequest(Long baseRunId, Map<String, Double> weights,
                                  Boolean fullCoverage, Integer fairnessFloorPct,
                                  String policyVersion) {
        public SimulateRequest(Long baseRunId, Map<String, Double> weights,
                               Boolean fullCoverage, Integer fairnessFloorPct) {
            this(baseRunId, weights, fullCoverage, fairnessFloorPct, null);
        }
    }

    private final AllocationRunRepository runs;
    private final DatasetSnapshotRepository snapshots;
    private final CandidateProfileRepository profiles;
    private final CandidateSkillRepository skills;
    private final CandidateInterestRepository interests;
    private final CandidatePreferenceRepository preferences;
    private final OpportunityRepository opportunities;
    private final OpportunitySkillRepository oppSkills;
    private final AssignmentRepository assignments;
    private final SimulationRunRepository sims;
    private final PolicyPresetRepository presets;
    private final AiServiceClient ai;
    private final SuitabilityService suitability;
    private final CandidateAcademicRecordRepository academicRecords;
    private final CandidateEvidenceRepository candidateEvidences;
    private final AllocationEligibilitySnapshotRepository eligibilitySnapshots;
    private final EligibilityEvaluator eligibilityEvaluator;
    private final AuditService audit;
    private final ObjectMapper json;

    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "pragati-simulation");
        t.setDaemon(true);
        return t;
    });
    private final AtomicBoolean simActive = new AtomicBoolean(false);

    @org.springframework.beans.factory.annotation.Autowired
    public PolicyService(AllocationRunRepository runs, DatasetSnapshotRepository snapshots,
                         CandidateProfileRepository profiles, CandidateSkillRepository skills,
                         CandidateInterestRepository interests, CandidatePreferenceRepository preferences,
                         OpportunityRepository opportunities, OpportunitySkillRepository oppSkills,
                         AssignmentRepository assignments, SimulationRunRepository sims,
                         PolicyPresetRepository presets, AiServiceClient ai,
                         SuitabilityService suitability,
                         CandidateAcademicRecordRepository academicRecords,
                         CandidateEvidenceRepository candidateEvidences,
                         AllocationEligibilitySnapshotRepository eligibilitySnapshots,
                         EligibilityEvaluator eligibilityEvaluator,
                         AuditService audit, ObjectMapper json) {
        this.runs = runs; this.snapshots = snapshots; this.profiles = profiles;
        this.skills = skills; this.interests = interests; this.preferences = preferences;
        this.opportunities = opportunities; this.oppSkills = oppSkills;
        this.assignments = assignments; this.sims = sims; this.presets = presets;
        this.ai = ai; this.suitability = suitability;
        this.academicRecords = academicRecords;
        this.candidateEvidences = candidateEvidences;
        this.eligibilitySnapshots = eligibilitySnapshots;
        this.eligibilityEvaluator = eligibilityEvaluator != null ? eligibilityEvaluator : new EligibilityEvaluator(json);
        this.audit = audit; this.json = json;
    }

    /** Overloaded constructor preserving 100% backward compatibility for existing unit tests. */
    public PolicyService(AllocationRunRepository runs, DatasetSnapshotRepository snapshots,
                         CandidateProfileRepository profiles, CandidateSkillRepository skills,
                         CandidateInterestRepository interests, CandidatePreferenceRepository preferences,
                         OpportunityRepository opportunities, OpportunitySkillRepository oppSkills,
                         AssignmentRepository assignments, SimulationRunRepository sims,
                         PolicyPresetRepository presets, AiServiceClient ai,
                         SuitabilityService suitability, AuditService audit, ObjectMapper json) {
        this(runs, snapshots, profiles, skills, interests, preferences, opportunities, oppSkills,
                assignments, sims, presets, ai, suitability, null, null, null, new EligibilityEvaluator(json), audit, json);
    }

    public boolean isSimulationActive() { return simActive.get(); }

    public List<PolicyPreset> presets() {
        return presets.findAll();
    }

    public SimulationRun startSimulation(SimulateRequest req, AuthUser actor) {
        if (!simActive.compareAndSet(false, true)) {
            throw ApiException.conflict("A simulation is already in progress. Please wait for it to complete.");
        }
        if (req.baseRunId() == null) {
            runActiveOff();
            throw ApiException.badRequest("Please select the allocation run to simulate against.");
        }
        AllocationRun base = runs.findById(req.baseRunId())
                .orElseThrow(() -> {
                    runActiveOff();
                    return ApiException.notFound("The selected allocation run was not found.");
                });
        if (base.status != RunStatus.COMPLETED) {
            runActiveOff();
            throw ApiException.badRequest("Simulations are available for completed allocation runs only.");
        }
        DatasetSnapshot current = snapshots.findTopByOrderByIdDesc().orElseThrow();
        if (!current.id.equals(base.snapshotId)) {
            runActiveOff();
            throw ApiException.conflict("The dataset changed after this run completed. Run a fresh allocation first, then simulate.");
        }

        Weights w;
        String policyName;
        if (req.weights() != null && !req.weights().isEmpty()) {
            w = new Weights(
                    req.weights().getOrDefault("skills", 0.0), req.weights().getOrDefault("qualification", 0.0),
                    req.weights().getOrDefault("interest", 0.0), req.weights().getOrDefault("location", 0.0),
                    req.weights().getOrDefault("preference", 0.0), req.weights().getOrDefault("learning", 0.0),
                    req.weights().getOrDefault("experience", 0.0));
            if (Math.abs(w.sum() - 100) > 0.001) {
                runActiveOff();
                throw ApiException.badRequest("Policy weights must total exactly 100%.");
            }
            policyName = "Custom Simulation Policy";
        } else {
            w = Weights.parse(base.weightsJson, json);
            policyName = "Current Policy (unchanged)";
        }
        boolean fullCoverage = Boolean.TRUE.equals(req.fullCoverage());
        Integer floor = req.fairnessFloorPct();
        if (floor != null && (floor < 0 || floor > 95)) {
            runActiveOff();
            throw ApiException.badRequest("The fairness floor must be between 0% and 95%.");
        }

        String baseVersion = AllocationService.resolvePolicyVersion(base);
        String effectivePolicyVersion;
        if (req.policyVersion() != null && !req.policyVersion().isBlank()) {
            effectivePolicyVersion = AllocationService.validatePolicyVersion(req.policyVersion());
        } else {
            effectivePolicyVersion = baseVersion;
        }

        SimulationRun sim = new SimulationRun();
        sim.baseRunId = base.id;
        sim.policyName = policyName;
        sim.weightsJson = w.toJson(json);
        sim.fullCoverage = fullCoverage;
        sim.fairnessFloorPct = floor;
        sim.status = RunStatus.RUNNING;
        SimulationRun saved = sims.save(sim);
        executor.submit(() -> runSimulation(saved.id, base, w, fullCoverage, floor, effectivePolicyVersion, actor));
        return saved;
    }

    private void runActiveOff() { simActive.set(false); }

    /**
     * Returns a sorted list of integer candidate IDs representing the complete
     * active population for this simulation. Mirrors
     * {@link AllocationService#toCandidateIds} so that simulation results are
     * directly comparable to allocation results.
     *
     * <p>Package-private to allow direct unit testing at this boundary without
     * requiring a Spring context or database.
     */
    static List<Integer> toCandidateIds(List<CandidateProfile> candidates) {
        return candidates.stream()
                .map(p -> p.id.intValue())
                .sorted()
                .toList();
    }

    private void runSimulation(Long simId, AllocationRun base, Weights w,
                               boolean fullCoverage, Integer floor, AuthUser actor) {
        runSimulation(simId, base, w, fullCoverage, floor, AllocationService.resolvePolicyVersion(base), actor);
    }

    private void runSimulation(Long simId, AllocationRun base, Weights w,
                               boolean fullCoverage, Integer floor, String policyVersion, AuthUser actor) {
        long t0 = System.currentTimeMillis();
        SimulationRun sim = sims.findById(simId).orElseThrow();
        try {
            String effectiveVersion = policyVersion != null && !policyVersion.isBlank()
                    ? AllocationService.validatePolicyVersion(policyVersion)
                    : AllocationService.resolvePolicyVersion(base);
            List<CandidateProfile> candidates = profiles.findAllByCandidateState(CandidateState.ACTIVE);
            List<Long> candIds = candidates.stream().map(p -> p.id).toList();
            Map<Long, Set<String>> skillsMap = new HashMap<>();
            for (CandidateSkill s : skills.findByCandidateIdIn(candIds)) {
                if (s.validated) skillsMap.computeIfAbsent(s.candidateId, k -> new HashSet<>()).add(s.canonical);
            }
            Map<Long, Set<Sector>> interestMap = new HashMap<>();
            for (CandidateInterest i : interests.findByCandidateIdIn(candIds)) {
                interestMap.computeIfAbsent(i.candidateId, k -> new HashSet<>()).add(i.sector);
            }
            Map<Long, Map<Long, Integer>> prefMap = new HashMap<>();
            for (CandidatePreference p : preferences.findByCandidateIdIn(candIds)) {
                prefMap.computeIfAbsent(p.candidateId, k -> new HashMap<>()).put(p.opportunityId, p.rank);
            }
            List<Opportunity> opps = opportunities.findAllByStatus(OppStatus.ACTIVE);
            List<Long> oppIds = opps.stream().map(o -> o.id).toList();
            Map<Long, List<OpportunitySkill>> reqMap = new HashMap<>();
            for (OpportunitySkill s : oppSkills.findByOpportunityIdIn(oppIds)) {
                reqMap.computeIfAbsent(s.opportunityId, k -> new ArrayList<>()).add(s);
            }

            String ruleSetId = AllocationService.resolveEligibilityRuleSetId(base);
            String ruleSetVersion = AllocationService.resolveEligibilityRuleSetVersion(base);
            java.time.LocalDate refDate = AllocationService.resolveReferenceDate(base);

            Map<Long, CandidateAcademicRecord> acadMap = new HashMap<>();
            if (academicRecords != null) {
                for (CandidateAcademicRecord ar : academicRecords.findByCandidateIdIn(candIds)) {
                    acadMap.put(ar.candidateId, ar);
                }
            }
            Map<Long, List<CandidateEvidence>> evidMap = new HashMap<>();
            if (candidateEvidences != null) {
                for (CandidateEvidence ev : candidateEvidences.findByCandidateIdIn(candIds)) {
                    evidMap.computeIfAbsent(ev.candidateId, k -> new ArrayList<>()).add(ev);
                }
            }

            Map<Long, AllocationEligibilitySnapshot> snapMap = new HashMap<>();
            if (eligibilitySnapshots != null) {
                for (AllocationEligibilitySnapshot snap : eligibilitySnapshots.findByRunId(base.id)) {
                    snapMap.put(snap.candidateId, snap);
                }
            }

            Map<Long, Boolean> candEligibleMap = new HashMap<>();
            if (!snapMap.isEmpty()) {
                // Point-in-time preservation: reconstruct candidate eligibility from verified frozen baseline snapshots.
                // This ensures Policy Lab counterfactuals evaluate alternative weights on the exact same eligible cohort,
                // without silently incorporating subsequently mutated evidence.
                for (CandidateProfile p : candidates) {
                    AllocationEligibilitySnapshot snap = snapMap.get(p.id);
                    candEligibleMap.put(p.id, snap != null && snap.decision == EligibilityDecision.ELIGIBLE);
                }
            } else {
                // Fallback for historical baseline runs without snapshots
                for (CandidateProfile p : candidates) {
                    CandidateAcademicRecord ar = acadMap.get(p.id);
                    List<CandidateEvidence> evList = evidMap.getOrDefault(p.id, List.of());
                    EligibilityEvaluator.CandidateEvaluation candEval = eligibilityEvaluator.evaluateCandidate(
                            ruleSetId, ruleSetVersion, p, ar, evList, refDate);
                    candEligibleMap.put(p.id, candEval.isEligible());
                }
            }

            List<EligiblePair> pairs = new ArrayList<>();
            Map<Long, Integer> eligiblePerOpp = new HashMap<>();
            for (CandidateProfile p : candidates) {
                Boolean isCandEligible = candEligibleMap.get(p.id);
                if (isCandEligible == null || !isCandEligible) continue;
                Set<String> sk = skillsMap.getOrDefault(p.id, Set.of());
                for (Opportunity o : opps) {
                    List<OpportunitySkill> req = reqMap.getOrDefault(o.id, List.of());
                    if (!suitability.check(p, sk, o, req).eligible()) continue;
                    Integer rank = prefMap.getOrDefault(p.id, Map.of()).get(o.id);
                    PairScore s = suitability.score(p, sk, interestMap.getOrDefault(p.id, Set.of()), rank, o, req, w);
                    pairs.add(new EligiblePair(p.id, o.id, s, rank));
                    eligiblePerOpp.merge(o.id, 1, Integer::sum);
                }
            }

            List<AiServiceClient.OptPair> pairList = new ArrayList<>();
            for (EligiblePair p : pairs) {
                pairList.add(new AiServiceClient.OptPair(p.candidateId().intValue(),
                        p.opportunityId().intValue(), (int) Math.round(p.score().overall() * 100),
                        p.preferenceRank() != null ? 1 : 0));
            }
            List<AiServiceClient.OptOpp> oppList = opps.stream()
                    .map(o -> new AiServiceClient.OptOpp(o.id.intValue(), o.capacity)).toList();
            List<AiServiceClient.OptGroup> groups = new ArrayList<>();
            if (floor != null && floor > 0) {
                boolean isV2 = "v2".equals(effectiveVersion);
                if (isV2) {
                    List<Integer> rural = candidates.stream().filter(p -> p.locationType == LocationType.RURAL)
                            .map(p -> p.id.intValue()).sorted().toList();
                    if (!rural.isEmpty()) groups.add(new AiServiceClient.OptGroup(LocationType.RURAL.name(), rural, floor));
                } else {
                    for (LocationType lt : LocationType.values()) {
                        List<Integer> members = candidates.stream().filter(p -> p.locationType == lt)
                                .map(p -> p.id.intValue()).sorted().toList();
                        if (!members.isEmpty()) groups.add(new AiServiceClient.OptGroup(lt.name(), members, floor));
                    }
                }
            }
            // FIX (Patch 1 / DEF-001): derive the candidate list from the full
            // active population, not from eligible pairs. Candidates with zero
            // eligible pairs must appear so Full Coverage can correctly report
            // INFEASIBLE instead of silently excluding them from the simulation.
            AiServiceClient.OptimizeResult result = ai.optimize(new AiServiceClient.OptimizeRequest(
                    toCandidateIds(candidates), oppList, pairList,
                    new AiServiceClient.OptPolicy(fullCoverage, groups),
                    new AiServiceClient.OptParams(90, 1, 0L)));

            if ("INFEASIBLE".equalsIgnoreCase(result.status())) {
                sim.solverStatus = SolverStatus.INFEASIBLE;
                sim.status = RunStatus.INFEASIBLE;
                sim.metricsJson = json.writeValueAsString(Map.of(
                        "note", "This configuration cannot be satisfied with the current eligible candidates and available opportunity capacity."));
            } else if ("UNKNOWN".equalsIgnoreCase(result.status())) {
                sim.solverStatus = SolverStatus.UNKNOWN;
                sim.status = RunStatus.FAILED;
                sim.metricsJson = json.writeValueAsString(Map.of(
                        "note", "The optimizer could not establish a result within the configured search limits."));
            } else if ("MODEL_INVALID".equalsIgnoreCase(result.status())) {
                sim.solverStatus = SolverStatus.MODEL_INVALID;
                sim.status = RunStatus.FAILED;
                sim.metricsJson = json.writeValueAsString(Map.of(
                        "note", "The allocation model is structurally invalid. Check input bounds and entity consistency."));
            } else if ("OPTIMAL".equalsIgnoreCase(result.status()) || "FEASIBLE".equalsIgnoreCase(result.status())) {
                sim.solverStatus = "OPTIMAL".equalsIgnoreCase(result.status())
                        ? SolverStatus.OPTIMAL : SolverStatus.FEASIBLE;
                sim.status = RunStatus.COMPLETED;
                Map<String, Object> metrics = computeMetrics(base, candidates, opps, prefMap, result, effectiveVersion);
                sim.metricsJson = json.writeValueAsString(metrics);
                sim.affectedCount = ((Number) metrics.getOrDefault("affected", 0)).intValue();
                sim.stability = ((Number) metrics.getOrDefault("stability", 0.0)).doubleValue();
            } else {
                sim.solverStatus = null;
                sim.status = RunStatus.FAILED;
                sim.metricsJson = json.writeValueAsString(Map.of(
                        "note", "Simulation failed due to an unexpected solver status: " + result.status()));
            }
            sim.runtimeMs = System.currentTimeMillis() - t0;
            sims.save(sim);
            audit.log(actor, AuditAction.SIMULATION_COMPLETED, "SimulationRun", String.valueOf(sim.id),
                    "Policy simulation " + (sim.status == RunStatus.INFEASIBLE ? "was infeasible" : "completed")
                            + " (" + sim.policyName + ").", Map.of("baseRun", base.number));
        } catch (Exception e) {
            log.error("Simulation {} failed", simId, e);
            sim.status = RunStatus.FAILED;
            sim.runtimeMs = System.currentTimeMillis() - t0;
            sims.save(sim);
        } finally {
            simActive.set(false);
        }
    }

    private Map<String, Object> computeMetrics(AllocationRun base, List<CandidateProfile> candidates,
                                               List<Opportunity> opps,
                                               Map<Long, Map<Long, Integer>> prefMap,
                                               AiServiceClient.OptimizeResult result,
                                               String policyVersion) {
        List<Assignment> baseGlobal = assignments.findByRunIdAndSource(base.id, AssignmentSource.GLOBAL);
        Map<Long, Assignment> baseByCand = new HashMap<>();
        for (Assignment a : baseGlobal) baseByCand.put(a.candidateId, a);
        int totalSeats = opps.stream().mapToInt(o -> o.capacity).sum();

        Map<String, Object> current = runMetrics(baseGlobal, baseByCand, prefMap, candidates.size(), totalSeats);

        Map<Long, Long> newByCand = new HashMap<>();
        for (AiServiceClient.OptAssignment a : result.global()) {
            newByCand.put(Long.valueOf(a.c()), Long.valueOf(a.i()));
        }
        int affected = 0;
        int unchanged = 0;
        double sumSuit = 0;
        int prefSat = 0;
        for (Map.Entry<Long, Long> e : newByCand.entrySet()) {
            Assignment prev = baseByCand.get(e.getKey());
            if (prev == null || !prev.opportunityId.equals(e.getValue())) affected++;
            else unchanged++;
            long score = result.global().stream()
                    .filter(a -> a.c() == e.getKey().intValue())
                    .mapToLong(a -> a.score()).findFirst().orElse(0);
            sumSuit += score / 100.0;
            Map<Long, Integer> prefs = prefMap.getOrDefault(e.getKey(), Map.of());
            if (prefs.containsKey(e.getValue())) prefSat++;
        }
        // Candidates who were allocated before but are not allocated anymore are affected too.
        for (Long cand : baseByCand.keySet()) {
            if (!newByCand.containsKey(cand)) affected++;
        }
        int newAllocated = newByCand.size();
        Map<String, Object> scenario = new java.util.LinkedHashMap<>();
        scenario.put("allocated", newAllocated);
        scenario.put("unallocated", candidates.size() - newAllocated);
        scenario.put("suitability", newAllocated > 0 ? r1(sumSuit / newAllocated) : 0);
        scenario.put("preferenceSatisfaction", newAllocated > 0 ? r1(prefSat * 100.0 / newAllocated) : 0);
        scenario.put("seatUtilization", totalSeats > 0 ? r1(newAllocated * 100.0 / totalSeats) : 0);

        Map<String, Object> out = new java.util.LinkedHashMap<>();
        out.put("current", current);
        out.put("scenario", scenario);
        out.put("affected", affected);
        out.put("stability", baseGlobal.isEmpty() ? 100.0 : r1((double) unchanged / baseGlobal.size() * 100));
        out.put("objective", result.objective());
        out.put("policyVersion", policyVersion);
        return out;
    }

    private Map<String, Object> runMetrics(List<Assignment> list, Map<Long, Assignment> byCand,
                                           Map<Long, Map<Long, Integer>> prefMap,
                                           int candidateCount, int totalSeats) {
        double sumSuit = list.stream().mapToDouble(a -> a.suitability).sum();
        int prefSat = 0;
        for (Assignment a : list) {
            if (prefMap.getOrDefault(a.candidateId, Map.of()).containsKey(a.opportunityId)) prefSat++;
        }
        Map<String, Object> m = new java.util.LinkedHashMap<>();
        m.put("allocated", list.size());
        m.put("unallocated", candidateCount - list.size());
        m.put("suitability", list.isEmpty() ? 0 : r1(sumSuit / list.size()));
        m.put("preferenceSatisfaction", list.isEmpty() ? 0 : r1(prefSat * 100.0 / list.size()));
        m.put("seatUtilization", totalSeats > 0 ? r1(list.size() * 100.0 / totalSeats) : 0);
        return m;
    }

    private double r1(double v) { return Math.round(v * 10.0) / 10.0; }
}
