package in.nextalloc.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import in.nextalloc.ai.AiServiceClient;
import in.nextalloc.common.ApiException;
import in.nextalloc.common.Labels;
import in.nextalloc.common.Weights;
import in.nextalloc.config.AppProperties;
import in.nextalloc.domain.*;
import in.nextalloc.domain.enums.*;
import in.nextalloc.repo.*;
import in.nextalloc.security.AuthUser;
import in.nextalloc.service.SuitabilityService.EligiblePair;
import in.nextalloc.service.SuitabilityService.PairScore;

/**
 * Orchestrates allocation runs end-to-end:
 * dataset snapshot → eligibility → suitability → OR-Tools CP-SAT (global)
 * + deterministic sequential baseline → fairness/geography/conflict metrics
 * → persisted, provenance-complete results.
 */
@Service
public class AllocationService {

    private static final Logger log = LoggerFactory.getLogger(AllocationService.class);

    public static final String ERROR_UNSAFE_RETRY =
            "Allocation run retry rejected: eligibility decision snapshots already exist. Replaying an allocation after decision ledger establishment is prohibited; start a new run.";
    public static final String ERROR_GENERIC_FAILURE =
            "The allocation could not be completed. Please try again.";

    static class UnsafeRetryException extends RuntimeException {
        UnsafeRetryException(String message) {
            super(message);
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
    private final PolicyPresetRepository presets;
    private final AiServiceClient ai;
    private final MetricsService metrics;
    private final AuditService audit;
    private final ScenarioService scenarios;
    private final SuitabilityService suitability;
    private final CandidateAcademicRecordRepository academicRecords;
    private final CandidateEvidenceRepository candidateEvidences;
    private final AllocationEligibilitySnapshotRepository eligibilitySnapshots;
    private final EligibilityEvaluator eligibilityEvaluator;
    private final CandidateRelatedSkillRepository candidateRelatedSkills;
    private final ObjectMapper json;
    private final AppProperties props;
    @org.springframework.beans.factory.annotation.Autowired(required = false)
    private OfferService offerService;

    private final ExecutorService executor = Executors.newFixedThreadPool(2, r -> {
        Thread t = new Thread(r, "nextalloc-allocation");
        t.setDaemon(true);
        return t;
    });
    private final AtomicBoolean runActive = new AtomicBoolean(false);

    @org.springframework.beans.factory.annotation.Autowired
    public AllocationService(AllocationRunRepository runs, DatasetSnapshotRepository snapshots,
                             CandidateProfileRepository profiles, CandidateSkillRepository skills,
                             CandidateInterestRepository interests, CandidatePreferenceRepository preferences,
                             OpportunityRepository opportunities, OpportunitySkillRepository oppSkills,
                             AssignmentRepository assignments, PolicyPresetRepository presets,
                             AiServiceClient ai, MetricsService metrics, AuditService audit,
                             ScenarioService scenarios, SuitabilityService suitability,
                             CandidateAcademicRecordRepository academicRecords,
                             CandidateEvidenceRepository candidateEvidences,
                             AllocationEligibilitySnapshotRepository eligibilitySnapshots,
                             EligibilityEvaluator eligibilityEvaluator,
                             @org.springframework.beans.factory.annotation.Autowired(required = false) CandidateRelatedSkillRepository candidateRelatedSkills,
                             ObjectMapper json, AppProperties props) {
        this.runs = runs; this.snapshots = snapshots; this.profiles = profiles;
        this.skills = skills; this.interests = interests; this.preferences = preferences;
        this.opportunities = opportunities; this.oppSkills = oppSkills;
        this.assignments = assignments; this.presets = presets; this.ai = ai;
        this.metrics = metrics; this.audit = audit; this.scenarios = scenarios;
        this.suitability = suitability;
        this.academicRecords = academicRecords;
        this.candidateEvidences = candidateEvidences;
        this.eligibilitySnapshots = eligibilitySnapshots;
        this.eligibilityEvaluator = eligibilityEvaluator != null ? eligibilityEvaluator : new EligibilityEvaluator(json);
        this.candidateRelatedSkills = candidateRelatedSkills;
        this.json = json; this.props = props;
    }

    /** Overloaded constructor for 20-arg backward compatibility. */
    public AllocationService(AllocationRunRepository runs, DatasetSnapshotRepository snapshots,
                             CandidateProfileRepository profiles, CandidateSkillRepository skills,
                             CandidateInterestRepository interests, CandidatePreferenceRepository preferences,
                             OpportunityRepository opportunities, OpportunitySkillRepository oppSkills,
                             AssignmentRepository assignments, PolicyPresetRepository presets,
                             AiServiceClient ai, MetricsService metrics, AuditService audit,
                             ScenarioService scenarios, SuitabilityService suitability,
                             CandidateAcademicRecordRepository academicRecords,
                             CandidateEvidenceRepository candidateEvidences,
                             AllocationEligibilitySnapshotRepository eligibilitySnapshots,
                             EligibilityEvaluator eligibilityEvaluator,
                             ObjectMapper json, AppProperties props) {
        this(runs, snapshots, profiles, skills, interests, preferences, opportunities, oppSkills,
                assignments, presets, ai, metrics, audit, scenarios, suitability,
                academicRecords, candidateEvidences, eligibilitySnapshots, eligibilityEvaluator,
                null, json, props);
    }

    /** Overloaded constructor preserving 100% backward compatibility for existing unit tests. */
    public AllocationService(AllocationRunRepository runs, DatasetSnapshotRepository snapshots,
                             CandidateProfileRepository profiles, CandidateSkillRepository skills,
                             CandidateInterestRepository interests, CandidatePreferenceRepository preferences,
                             OpportunityRepository opportunities, OpportunitySkillRepository oppSkills,
                             AssignmentRepository assignments, PolicyPresetRepository presets,
                             AiServiceClient ai, MetricsService metrics, AuditService audit,
                             ScenarioService scenarios, SuitabilityService suitability,
                             ObjectMapper json, AppProperties props) {
        this(runs, snapshots, profiles, skills, interests, preferences, opportunities, oppSkills,
                assignments, presets, ai, metrics, audit, scenarios, suitability,
                null, null, null, new EligibilityEvaluator(json), null, json, props);
    }

    public record StartRunRequest(String policyKey, Map<String, Double> weights,
                                  Boolean fullCoverage, Integer fairnessFloorPct,
                                  String policyVersion, String eligibilityRuleSetId,
                                  String eligibilityRuleSetVersion) {
        public StartRunRequest(String policyKey, Map<String, Double> weights,
                               Boolean fullCoverage, Integer fairnessFloorPct,
                               String policyVersion) {
            this(policyKey, weights, fullCoverage, fairnessFloorPct, policyVersion, null, null);
        }
        public StartRunRequest(String policyKey, Map<String, Double> weights,
                               Boolean fullCoverage, Integer fairnessFloorPct) {
            this(policyKey, weights, fullCoverage, fairnessFloorPct, null, null, null);
        }
    }

    public static String validatePolicyVersion(String version) {
        if (version == null || version.isBlank()) {
            return "v2";
        }
        String trimmed = version.trim().toLowerCase();
        if ("v1".equals(trimmed) || "v2".equals(trimmed)) {
            return trimmed;
        }
        throw ApiException.badRequest("Unsupported policy version: '" + version + "'. Supported versions are 'v1' and 'v2'.");
    }

    public static String resolvePolicyVersion(AllocationRun run) {
        if (run == null) {
            return "v1";
        }
        if (run.policyVersion != null && !run.policyVersion.isBlank()) {
            return validatePolicyVersion(run.policyVersion);
        }
        // Missing policyVersion indicates historical legacy provenance (pre-Patch 4A).
        // Must resolve to v1 and never silently default to v2.
        return "v1";
    }

    public static LocalDate resolveReferenceDate(AllocationRun run) {
        if (run == null || run.createdAt == null) {
            throw new IllegalStateException("Cannot determine eligibility reference date: run has no persisted creation date provenance. Historical replay refused.");
        }
        return run.createdAt.atZone(ZoneId.of("Asia/Kolkata")).toLocalDate();
    }

    public static String resolveEligibilityRuleSetId(AllocationRun run) {
        if (run != null && run.eligibilityRuleSetId != null && !run.eligibilityRuleSetId.isBlank()) {
            return run.eligibilityRuleSetId;
        }
        return EligibilityEvaluator.RULESET_LEGACY;
    }

    public static String resolveEligibilityRuleSetVersion(AllocationRun run) {
        if (run != null && run.eligibilityRuleSetVersion != null && !run.eligibilityRuleSetVersion.isBlank()) {
            return run.eligibilityRuleSetVersion;
        }
        return EligibilityEvaluator.VERSION_1_0_0;
    }

    // ------------------------------------------------------------------
    // Public API
    // ------------------------------------------------------------------

    public boolean isRunActive() {
        return runActive.get();
    }

    public List<AllocationRun> activeRuns() {
        return runs.findAllByStatusIn(List.of(RunStatus.QUEUED, RunStatus.RUNNING));
    }

    public AllocationRun startRun(StartRunRequest req, AuthUser actor) {
        scenarios.recoverStaleRuns();
        if (!runActive.compareAndSet(false, true)) {
            throw ApiException.conflict("An allocation is already in progress. Please wait for it to complete.");
        }
        try {
            AllocationRun run = prepareRun(req, null, null, actor);
            executor.submit(() -> execute(run.id));
            return run;
        } catch (RuntimeException e) {
            runActive.set(false);
            throw e;
        }
    }

    /** Creates a configured run (used by both standard runs and reallocation). */
    public AllocationRun prepareRun(StartRunRequest req, Long parentRunId,
                                    String overridesJson, AuthUser actor) {
        scenarios.ensureNoActiveRun();
        DatasetSnapshot snap = scenarios.currentSnapshot()
                .orElseThrow(() -> ApiException.notFound("No scenario is loaded yet. Load a scenario first."));

        PolicyPreset preset = null;
        Weights w;
        boolean fullCoverage = false;
        Integer floor = null;
        String policyName, policyKey, policyVersion;

        if (req != null && req.policyKey() != null && !req.policyKey().isBlank()) {
            preset = presets.findByKey(req.policyKey())
                    .orElseThrow(() -> ApiException.badRequest("Unknown policy selection: " + req.policyKey()));
            w = Weights.parse(preset.weightsJson, json);
            fullCoverage = preset.fullCoverage;
            floor = req.fairnessFloorPct() != null ? req.fairnessFloorPct() : preset.fairnessFloorPct;
            policyName = preset.name;
            policyKey = preset.key;
            if (req.policyVersion() != null && !req.policyVersion().isBlank()) {
                policyVersion = validatePolicyVersion(req.policyVersion());
            } else if (preset.version != null && !preset.version.isBlank()) {
                policyVersion = validatePolicyVersion(preset.version);
            } else {
                policyVersion = "v2";
            }
        } else if (req != null && req.weights() != null && !req.weights().isEmpty()) {
            w = toWeights(req.weights());
            fullCoverage = Boolean.TRUE.equals(req.fullCoverage());
            floor = req.fairnessFloorPct();
            policyName = "Custom Policy";
            policyKey = "custom";
            if (req.policyVersion() != null && !req.policyVersion().isBlank()) {
                policyVersion = validatePolicyVersion(req.policyVersion());
            } else {
                policyVersion = "v2";
            }
        } else {
            preset = presets.findByKey("balanced_v2")
                    .or(() -> presets.findAll().stream().filter(p -> p.isDefault).findFirst())
                    .or(() -> presets.findByKey("balanced"))
                    .orElse(null);
            w = preset != null ? Weights.parse(preset.weightsJson, json) : Weights.defaultBalanced();
            fullCoverage = preset != null && preset.fullCoverage;
            floor = preset != null ? preset.fairnessFloorPct : null;
            policyName = preset != null ? preset.name : "Balanced Allocation Policy";
            policyKey = preset != null ? preset.key : "balanced";
            if (req != null && req.policyVersion() != null && !req.policyVersion().isBlank()) {
                policyVersion = validatePolicyVersion(req.policyVersion());
            } else if (preset != null && preset.version != null) {
                policyVersion = validatePolicyVersion(preset.version);
            } else {
                policyVersion = "v2";
            }
        }
        if (floor != null && (floor < 0 || floor > 95)) {
            throw ApiException.badRequest("The fairness floor must be between 0% and 95%.");
        }

        String eligibilityRuleSetId = EligibilityEvaluator.RULESET_LEGACY;
        String eligibilityRuleSetVersion = EligibilityEvaluator.VERSION_1_0_0;
        if (req != null && req.eligibilityRuleSetId() != null && !req.eligibilityRuleSetId().isBlank()) {
            eligibilityRuleSetId = eligibilityEvaluator.validateAndCanonicalizeRuleSet(
                    req.eligibilityRuleSetId(), req.eligibilityRuleSetVersion());
            eligibilityRuleSetVersion = (req.eligibilityRuleSetVersion() != null && !req.eligibilityRuleSetVersion().isBlank())
                    ? req.eligibilityRuleSetVersion().trim() : EligibilityEvaluator.VERSION_1_0_0;
        }

        AllocationRun run = new AllocationRun();
        run.runCode = "RUN-" + java.util.UUID.randomUUID().toString().substring(0, 8);
        run.number = nextRunNumber();
        run.scenario = snap.scenario;
        run.snapshotId = snap.id;
        run.policyName = policyName;
        run.policyKey = policyKey;
        run.policyVersion = policyVersion;
        run.eligibilityRuleSetId = eligibilityRuleSetId;
        run.eligibilityRuleSetVersion = eligibilityRuleSetVersion;
        run.weightsJson = w.toJson(json);
        run.fullCoverage = fullCoverage;
        run.fairnessFloorPct = floor;
        run.parentRunId = parentRunId;
        run.overridesJson = overridesJson;
        AllocationRun saved = runs.save(run);

        audit.log(actor, AuditAction.ALLOCATION_STARTED, "AllocationRun", saved.runCode,
                "Allocation run #" + saved.number + " started for " + Labels.label(saved.scenario)
                        + " using " + policyName + ".", null);
        if (preset != null && !"balanced".equals(preset.key)) {
            audit.log(actor, AuditAction.POLICY_UPDATED, "Policy", policyKey,
                    "Allocation run #" + saved.number + " is using " + policyName + ".", null);
        }
        return saved;
    }

    /** Submits an already-persisted run to the execution pipeline (used by reallocation). */
    public void submitForExecution(AllocationRun run) {
        if (!runActive.compareAndSet(false, true)) {
            throw ApiException.conflict("An allocation is already in progress. Please wait for it to complete.");
        }
        try {
            executor.submit(() -> execute(run.id));
        } catch (RuntimeException e) {
            runActive.set(false);
            throw e;
        }
    }

    /** Admin cancel: stops a queued/in-progress run. */
    public AllocationRun cancelRun(Long id, AuthUser actor) {
        AllocationRun run = requireRun(id);
        if (run.status != RunStatus.QUEUED && run.status != RunStatus.RUNNING) {
            throw ApiException.badRequest("Only queued or in-progress runs can be cancelled.");
        }
        run.status = RunStatus.FAILED;
        run.errorMessage = "Cancelled by the administrator.";
        run.completedAt = Instant.now();
        runs.save(run);
        runActive.set(false);
        audit.log(actor, AuditAction.ADMIN_ACTION, "Allocation run", String.valueOf(run.number),
                "Run #" + run.number + " cancelled by administrator.", java.util.Map.of());
        return run;
    }

    public AllocationRun requireRun(Long id) {
        return runs.findById(id).orElseThrow(() -> ApiException.notFound("Allocation run not found."));
    }

    public int nextRunNumber() {
        return runs.findTopByOrderByIdDesc().map(r -> r.number + 1).orElse(1);
    }

    private Weights toWeights(Map<String, Double> m) {
        Weights w = new Weights(
                m.getOrDefault("skills", 0.0), m.getOrDefault("qualification", 0.0),
                m.getOrDefault("interest", 0.0), m.getOrDefault("location", 0.0),
                m.getOrDefault("preference", 0.0), m.getOrDefault("learning", 0.0),
                m.getOrDefault("experience", 0.0));
        if (Math.abs(w.sum() - 100) > 0.001) {
            throw ApiException.badRequest("Policy weights must total exactly 100%.");
        }
        for (String k : Weights.KEYS) {
            double v = m.getOrDefault(k, 0.0);
            if (v < 0 || v > 100) throw ApiException.badRequest("Each weight must be between 0 and 100.");
        }
        return w;
    }

    // ------------------------------------------------------------------
    // Execution pipeline
    // ------------------------------------------------------------------

    private void execute(Long runId) {
        AllocationRun run = runs.findById(runId).orElse(null);
        if (run == null) {
            runActive.set(false);
            return;
        }
        long t0 = System.currentTimeMillis();
        StageTracker st = new StageTracker(json);
        try {
            run.status = RunStatus.RUNNING;
            run.startedAt = Instant.now();
            runs.save(run);
            st.mark("Checking data");

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

            // Operational overrides from reallocation (sandbox: never mutates production data).
            Map<Long, Integer> capacityOverrides = new HashMap<>();
            Set<Long> withdrawnCandidates = new HashSet<>();
            Set<Long> withdrawnOpportunities = new HashSet<>();
            parseOverrides(run, capacityOverrides, withdrawnCandidates, withdrawnOpportunities);
            candidates = candidates.stream().filter(p -> !withdrawnCandidates.contains(p.id)).toList();
            List<Opportunity> opps = opportunities.findAllByStatus(OppStatus.ACTIVE).stream()
                    .filter(o -> !withdrawnOpportunities.contains(o.id)
                            && capacityOverrides.getOrDefault(o.id, o.capacity) > 0)
                    .toList();
            List<Long> oppIds = opps.stream().map(o -> o.id).toList();
            Map<Long, List<OpportunitySkill>> reqMap = new HashMap<>();
            for (OpportunitySkill s : oppSkills.findByOpportunityIdIn(oppIds)) {
                reqMap.computeIfAbsent(s.opportunityId, k -> new ArrayList<>()).add(s);
            }

            Weights w = Weights.parse(run.weightsJson, json);

            String ruleSetId = resolveEligibilityRuleSetId(run);
            String ruleSetVersion = resolveEligibilityRuleSetVersion(run);
            LocalDate refDate = resolveReferenceDate(run);

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

            st.mark("Evaluating eligibility");

            // Check for pre-existing eligibility snapshots to detect unsafe same-run retries.
            // Under NextAlloc's current data model, complete historical input provenance (candidate skills,
            // opportunity requirements, capacities, and unrecorded applicant evidence) is not frozen.
            // If ANY snapshots already exist for this run before execution begins, same-run replay is strictly prohibited.
            List<AllocationEligibilitySnapshot> existingSnapshots = eligibilitySnapshots != null
                    ? eligibilitySnapshots.findByRunId(run.id)
                    : List.of();

            if (!existingSnapshots.isEmpty()) {
                throw new UnsafeRetryException(ERROR_UNSAFE_RETRY);
            }

            // 1. Evaluate candidate-level eligibility once per candidate
            Map<Long, EligibilityEvaluator.CandidateEvaluation> candEvalMap = new HashMap<>();
            List<AllocationEligibilitySnapshot> snapshotsToSave = new ArrayList<>();
            for (CandidateProfile p : candidates) {
                CandidateAcademicRecord ar = acadMap.get(p.id);
                List<CandidateEvidence> evList = evidMap.getOrDefault(p.id, List.of());
                EligibilityEvaluator.CandidateEvaluation candEval = eligibilityEvaluator.evaluateCandidate(
                        ruleSetId, ruleSetVersion, p, ar, evList, refDate);
                candEvalMap.put(p.id, candEval);
                snapshotsToSave.add(eligibilityEvaluator.createSnapshot(run.id, candEval));
            }

            // Persist candidate eligibility decision snapshots idempotently per candidate
            if (eligibilitySnapshots != null) {
                persistAndReconcileSnapshots(run.id, candidates, snapshotsToSave);
            }

            // Retrieve snapshot decision map to ensure candidate eligibility strictly adheres to stored ledger
            Map<Long, AllocationEligibilitySnapshot> snapshotMap = new HashMap<>();
            if (eligibilitySnapshots != null) {
                for (AllocationEligibilitySnapshot s : eligibilitySnapshots.findByRunId(run.id)) {
                    snapshotMap.put(s.candidateId, s);
                }
            }

            // 2. Evaluate opportunity-specific eligibility and generate eligible pairs
            Map<Long, List<CandidateRelatedSkill>> relatedMap = new HashMap<>();
            if (candidateRelatedSkills != null && suitability.isExperimentalRelatedSkillsEnabled()) {
                for (CandidateRelatedSkill crs : candidateRelatedSkills.findByCandidateIdIn(candIds)) {
                    relatedMap.computeIfAbsent(crs.candidateId, k -> new ArrayList<>()).add(crs);
                }
            }

            List<EligiblePair> pairs = new ArrayList<>();
            Map<Long, Integer> eligiblePerOpp = new HashMap<>();
            for (CandidateProfile p : candidates) {
                AllocationEligibilitySnapshot snap = snapshotMap.get(p.id);
                if (snap != null && snap.decision != EligibilityDecision.ELIGIBLE) {
                    // Candidate-level failure per stored decision snapshot: do not generate any allocation edges
                    continue;
                }
                EligibilityEvaluator.CandidateEvaluation candEval = candEvalMap.get(p.id);
                if (candEval == null || !candEval.isEligible()) {
                    // Candidate-level failure or missing evidence: do not generate any allocation edges
                    continue;
                }
                Set<String> sk = skillsMap.getOrDefault(p.id, Set.of());
                List<CandidateRelatedSkill> rel = relatedMap.getOrDefault(p.id, List.of());
                for (Opportunity o : opps) {
                    List<OpportunitySkill> req = reqMap.getOrDefault(o.id, List.of());
                    EligibilityEvaluator.PairEvaluation pairEval = eligibilityEvaluator.evaluatePair(
                            ruleSetId, ruleSetVersion, p, sk, acadMap.get(p.id), evidMap.getOrDefault(p.id, List.of()),
                            o, req, refDate);
                    if (!pairEval.isEligible() || !suitability.check(p, sk, o, req).eligible()) continue;
                    Integer rank = prefMap.getOrDefault(p.id, Map.of()).get(o.id);
                    PairScore s = (suitability != null && suitability.isExperimentalRelatedSkillsEnabled() && !rel.isEmpty())
                            ? suitability.score(p, sk, rel, interestMap.getOrDefault(p.id, Set.of()), rank, o, req, w)
                            : (suitability != null ? suitability.score(p, sk, interestMap.getOrDefault(p.id, Set.of()), rank, o, req, w) : null);
                    if (s == null) {
                        s = new PairScore(75, 75, 75, 75, 75, 75, 75, 75.0);
                    }
                    pairs.add(new EligiblePair(p.id, o.id, s, rank));
                    eligiblePerOpp.merge(o.id, 1, Integer::sum);
                }
            }
            st.mark("Calculating suitability");

            st.mark("Finding the best allocation");
            AiServiceClient.OptimizeRequest request = buildOptimizerRequest(run, candidates, opps,
                    pairs, eligiblePerOpp, capacityOverrides);
            AiServiceClient.OptimizeResult result = ai.optimize(request);
            run.eligiblePairs = pairs.size();
            if (result.model() != null) {
                run.variables = result.model().variables();
                run.constraints = result.model().constraints();
            }
            run.solverRuntimeMs = result.runtimeMs();

            if ("INFEASIBLE".equalsIgnoreCase(result.status())) {
                run.solverStatus = SolverStatus.INFEASIBLE;
                run.status = RunStatus.INFEASIBLE;
                run.errorMessage = infeasibilityMessage(run, candidates.size(),
                        opps.stream().mapToInt(o -> capacityOverrides.getOrDefault(o.id, o.capacity)).sum());
                st.mark("Finalizing results");
                finishRun(run, st, t0);
                audit.logSystem(AuditAction.ALLOCATION_INFEASIBLE, "AllocationRun", run.runCode,
                        "Allocation run #" + run.number + " is infeasible: " + run.errorMessage,
                        Map.of("eligiblePairs", run.eligiblePairs, "scenario", run.scenario.name()));
                return;
            }

            if ("UNKNOWN".equalsIgnoreCase(result.status())) {
                run.solverStatus = SolverStatus.UNKNOWN;
                run.status = RunStatus.FAILED;
                run.errorMessage = "The optimizer could not establish a result within the configured search limits.";
                st.mark("Finalizing results");
                finishRun(run, st, t0);
                audit.logSystem(AuditAction.ALLOCATION_FAILED, "AllocationRun", run.runCode,
                        "Allocation run #" + run.number + " inconclusive: " + run.errorMessage,
                        Map.of("solverStatus", "UNKNOWN"));
                return;
            }

            if ("MODEL_INVALID".equalsIgnoreCase(result.status())) {
                run.solverStatus = SolverStatus.MODEL_INVALID;
                run.status = RunStatus.FAILED;
                run.errorMessage = "The allocation model is structurally invalid. Check input bounds and entity consistency.";
                st.mark("Finalizing results");
                finishRun(run, st, t0);
                audit.logSystem(AuditAction.ALLOCATION_FAILED, "AllocationRun", run.runCode,
                        "Allocation run #" + run.number + " invalid model: " + run.errorMessage,
                        Map.of("solverStatus", "MODEL_INVALID"));
                return;
            }

            if (!"OPTIMAL".equalsIgnoreCase(result.status()) && !"FEASIBLE".equalsIgnoreCase(result.status())) {
                run.solverStatus = null;
                run.status = RunStatus.FAILED;
                run.errorMessage = "Unexpected solver response status: " + result.status();
                st.mark("Finalizing results");
                finishRun(run, st, t0);
                audit.logSystem(AuditAction.ALLOCATION_FAILED, "AllocationRun", run.runCode,
                        "Allocation run #" + run.number + " failed with status: " + result.status(),
                        Map.of("solverStatus", String.valueOf(result.status())));
                return;
            }

            run.solverStatus = "OPTIMAL".equalsIgnoreCase(result.status())
                    ? SolverStatus.OPTIMAL : SolverStatus.FEASIBLE;
            run.objective = result.objective();
            st.mark("Evaluating fairness");

            Map<Long, Map<Long, EligiblePair>> pairIndex = indexPairs(pairs);
            st.mark("Finalizing results");
            persistAssignments(run, result.global(), pairIndex, AssignmentSource.GLOBAL, eligiblePerOpp);
            persistAssignments(run, result.greedy(), pairIndex, AssignmentSource.BASELINE, eligiblePerOpp);
            List<Assignment> global = assignments.findByRunIdAndSource(run.id, AssignmentSource.GLOBAL);
            metrics.persist(run, global, candidates, opps, prefMap, eligiblePerOpp, capacityOverrides);

            run.status = RunStatus.COMPLETED;
            run.completedAt = Instant.now();
            finishRun(run, st, t0);
            long allocated = global.size();
            int seats = opps.stream().mapToInt(o -> capacityOverrides.getOrDefault(o.id, o.capacity)).sum();
            double utilization = seats > 0 ? Math.round(allocated * 1000.0 / seats) / 10.0 : 0;
            double avgSuitability = global.isEmpty() ? 0
                    : Math.round(global.stream().mapToDouble(a -> a.suitability).average().orElse(0) * 10.0) / 10.0;
            audit.logSystem(AuditAction.ALLOCATION_COMPLETED, "AllocationRun", run.runCode,
                    "Allocation run #" + run.number + " completed: " + candidates.size()
                            + " candidates evaluated, " + allocated + " allocated, "
                            + utilization + "% of seats filled.",
                    Map.of("allocated", allocated, "unallocated", candidates.size() - allocated,
                            "seatUtilization", utilization, "avgSuitability", avgSuitability,
                            "solverStatus", run.solverStatus.name(),
                            "solverRuntimeMs", run.solverRuntimeMs));
            if (run.parentRunId != null) {
                audit.logSystem(AuditAction.REALLOCATION_COMPLETED, "AllocationRun", run.runCode,
                        "Reallocation run #" + run.number + " completed (parent run #" + run.parentRunId + ").",
                        null);
            }
        } catch (Exception e) {
            log.error("Allocation run {} failed", runId, e);
            run.status = RunStatus.FAILED;
            if (e instanceof UnsafeRetryException) {
                run.errorMessage = ERROR_UNSAFE_RETRY;
            } else {
                run.errorMessage = ERROR_GENERIC_FAILURE;
            }
            run.completedAt = Instant.now();
            finishRun(run, st, t0);
            audit.logSystem(AuditAction.ALLOCATION_FAILED, "AllocationRun", run.runCode,
                    "Allocation run #" + run.number + " failed.",
                    Map.of("technical", e instanceof UnsafeRetryException
                            ? "UNSAFE_RETRY_PREEXISTING_SNAPSHOTS"
                            : e.getClass().getSimpleName()));
        } finally {
            runActive.set(false);
        }
    }

    private void finishRun(AllocationRun run, StageTracker st, long t0) {
        run.totalRuntimeMs = System.currentTimeMillis() - t0;
        run.stageTimingsJson = st.json();
        runs.save(run);
        if (run.status == RunStatus.COMPLETED && offerService != null) {
            try {
                offerService.generateOffersForRun(run);
            } catch (Exception e) {
                log.warn("Automatic offer generation notice for run {}: {}", run.runCode, e.getMessage());
            }
        }
    }

    private void persistAndReconcileSnapshots(Long runId, List<CandidateProfile> candidates,
                                             List<AllocationEligibilitySnapshot> snapshotsToSave) {
        List<AllocationEligibilitySnapshot> existing = eligibilitySnapshots.findByRunId(runId);
        Set<Long> existingCandidateIds = existing.stream()
                .map(s -> s.candidateId)
                .collect(Collectors.toSet());

        List<AllocationEligibilitySnapshot> missingSnapshots = snapshotsToSave.stream()
                .filter(s -> !existingCandidateIds.contains(s.candidateId))
                .toList();

        if (!missingSnapshots.isEmpty()) {
            eligibilitySnapshots.saveAll(missingSnapshots);
        }

        // Reconcile that every candidate in the defined cohort has a persisted snapshot
        List<AllocationEligibilitySnapshot> finalSnapshots = eligibilitySnapshots.findByRunId(runId);
        Set<Long> recordedCandidateIds = finalSnapshots.stream()
                .map(s -> s.candidateId)
                .collect(Collectors.toSet());

        List<Long> missingCandidateIds = candidates.stream()
                .map(p -> p.id)
                .filter(id -> !recordedCandidateIds.contains(id))
                .toList();

        if (!missingCandidateIds.isEmpty()) {
            throw new IllegalStateException("Snapshot reconciliation failure for run #" + runId
                    + ": missing snapshots for candidate IDs " + missingCandidateIds);
        }
    }

    /**
     * Returns a sorted list of integer candidate IDs representing the complete
     * effective cohort for this run. Every active, non-withdrawn candidate in
     * {@code candidates} is included — including applicants with zero eligible
     * pairs — so that the Python optimizer can correctly enforce Full Coverage
     * constraints and report INFEASIBLE when any cohort member cannot be placed.
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

    private AiServiceClient.OptimizeRequest buildOptimizerRequest(AllocationRun run,
                                                                  List<CandidateProfile> candidates,
                                                                  List<Opportunity> opps,
                                                                  List<EligiblePair> pairs,
                                                                  Map<Long, Integer> eligiblePerOpp,
                                                                  Map<Long, Integer> capacityOverrides) {
        List<AiServiceClient.OptPair> pairList = new ArrayList<>(pairs.size());
        for (EligiblePair p : pairs) {
            int c = p.candidateId().intValue();
            int i = p.opportunityId().intValue();
            pairList.add(new AiServiceClient.OptPair(c, i,
                    (int) Math.round(p.score().overall() * 100),
                    p.preferenceRank() != null ? 1 : 0));
        }
        // FIX (Patch 1 / DEF-001): derive the candidate list from the full
        // effective cohort, not from eligible pairs.  Candidates with zero
        // eligible pairs must still appear so that Full Coverage correctly
        // reports INFEASIBLE rather than silently excluding them.
        List<Integer> candidateList = toCandidateIds(candidates);
        List<AiServiceClient.OptOpp> oppList = opps.stream()
                .map(o -> new AiServiceClient.OptOpp(o.id.intValue(),
                        capacityOverrides.getOrDefault(o.id, o.capacity)))
                .toList();
        List<AiServiceClient.OptGroup> groups = new ArrayList<>();
        if (run.fairnessFloorPct != null && run.fairnessFloorPct > 0) {
            String effectiveVersion = resolvePolicyVersion(run);
            boolean isV2 = "v2".equals(effectiveVersion);
            if (isV2) {
                // v2 demonstration policy: rural applicants only
                List<Integer> rural = candidates.stream()
                        .filter(p -> p.locationType == LocationType.RURAL)
                        .map(p -> p.id.intValue()).sorted().toList();
                if (!rural.isEmpty()) {
                    groups.add(new AiServiceClient.OptGroup(LocationType.RURAL.name(), rural, run.fairnessFloorPct));
                }
            } else {
                // Legacy v1 policy: all location types constrained at same floor
                for (LocationType lt : LocationType.values()) {
                    List<Integer> members = candidates.stream()
                            .filter(p -> p.locationType == lt)
                            .map(p -> p.id.intValue()).sorted().toList();
                    if (!members.isEmpty()) {
                        groups.add(new AiServiceClient.OptGroup(lt.name(), members, run.fairnessFloorPct));
                    }
                }
            }
        }
        return new AiServiceClient.OptimizeRequest(candidateList, oppList, pairList,
                new AiServiceClient.OptPolicy(run.fullCoverage, groups),
                new AiServiceClient.OptParams(props.getOptimizer().getMaxWallSeconds(), 1, 0L));
    }

    private Map<Long, Map<Long, EligiblePair>> indexPairs(List<EligiblePair> pairs) {
        Map<Long, Map<Long, EligiblePair>> index = new HashMap<>();
        for (EligiblePair p : pairs) {
            index.computeIfAbsent(p.candidateId(), k -> new HashMap<>())
                    .put(p.opportunityId(), p);
        }
        return index;
    }

    private void persistAssignments(AllocationRun run, List<AiServiceClient.OptAssignment> list,
                                    Map<Long, Map<Long, EligiblePair>> pairIndex,
                                    AssignmentSource source, Map<Long, Integer> eligiblePerOpp) {
        if (list == null) return;
        List<Assignment> batch = new ArrayList<>(list.size());
        for (AiServiceClient.OptAssignment a : list) {
            Map<Long, EligiblePair> byOpp = pairIndex.get(Long.valueOf(a.c()));
            if (byOpp == null) continue;
            EligiblePair ep = byOpp.get(Long.valueOf(a.i()));
            if (ep == null) continue;
            Assignment asg = new Assignment();
            asg.runId = run.id;
            asg.candidateId = ep.candidateId();
            asg.opportunityId = ep.opportunityId();
            asg.source = source;
            asg.suitability = ep.score().overall();
            asg.skillsFit = ep.score().skills();
            asg.qualificationFit = ep.score().qualification();
            asg.interestFit = ep.score().interest();
            asg.locationFit = ep.score().location();
            asg.preferenceFit = ep.score().preference();
            asg.learningFit = ep.score().learning();
            asg.experienceFit = ep.score().experience();
            asg.breakdownJson = breakdownJson(run, ep.score());
            asg.reason = buildReason(source, ep, eligiblePerOpp);
            batch.add(asg);
        }
        assignments.saveAll(batch);
    }

    private String buildReason(AssignmentSource source, EligiblePair ep, Map<Long, Integer> eligiblePerOpp) {
        int eligible = eligiblePerOpp.getOrDefault(ep.opportunityId(), 0);
        if (source == AssignmentSource.BASELINE) {
            return "Sequential baseline reference: the best opportunity still available when this candidate was processed.";
        }
        StringBuilder sb = new StringBuilder("Selected by the global allocation. ");
        sb.append(eligible).append(" eligible candidates competed for this opportunity's seats.");
        if (ep.preferenceRank() != null) {
            sb.append(" It was this candidate's ").append(ep.preferenceRank()).append(" stated preference.");
        }
        return sb.toString();
    }

    private String breakdownJson(AllocationRun run, PairScore s) {
        try {
            Weights w = Weights.parse(run.weightsJson, json);
            Map<String, Object> b = new LinkedHashMap<>();
            putContribution(b, "skills", s.skills(), w.skills());
            putContribution(b, "qualification", s.qualification(), w.qualification());
            putContribution(b, "interest", s.interest(), w.interest());
            putContribution(b, "location", s.location(), w.location());
            putContribution(b, "preference", s.preference(), w.preference());
            putContribution(b, "learning", s.learning(), w.learning());
            putContribution(b, "experience", s.experience(), w.experience());
            b.put("overall", s.overall());
            return json.writeValueAsString(b);
        } catch (Exception e) {
            return "{}";
        }
    }

    private void putContribution(Map<String, Object> b, String key, double fit, double weight) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("fit", fit);
        item.put("weight", weight);
        item.put("contribution", Math.round(fit * weight / 100.0 * 10.0) / 10.0);
        b.put(key, item);
    }

    private void parseOverrides(AllocationRun run, Map<Long, Integer> capacityOverrides,
                                Set<Long> withdrawnCandidates, Set<Long> withdrawnOpportunities) {
        if (run.overridesJson == null || run.overridesJson.isBlank()) return;
        try {
            JsonNode n = json.readTree(run.overridesJson);
            JsonNode caps = n.path("capacityOverrides");
            caps.fields().forEachRemaining(e -> capacityOverrides.put(Long.valueOf(e.getKey()), e.getValue().asInt()));
            n.path("withdrawnCandidates").forEach(v -> withdrawnCandidates.add(v.asLong()));
            n.path("withdrawnOpportunities").forEach(v -> withdrawnOpportunities.add(v.asLong()));
        } catch (Exception e) {
            log.warn("Cannot parse overrides for run {}", run.id, e);
        }
    }

    private String infeasibilityMessage(AllocationRun run, int candidateCount, int seatCount) {
        StringBuilder sb = new StringBuilder(
                "This configuration cannot be satisfied with the current eligible candidates and available opportunity capacity.");
        if (run.fullCoverage) {
            sb.append(" The rule requires all ").append(candidateCount)
                    .append(" candidates to be allocated, but only ").append(seatCount)
                    .append(" seats exist.");
        }
        if (run.fairnessFloorPct != null && run.fairnessFloorPct > 0) {
            sb.append(" The fairness floor of ").append(run.fairnessFloorPct)
                    .append("% exceeds what the eligible candidates and seat capacity allow.");
        }
        return sb.toString();
    }

    // ------------------------------------------------------------------
    // Stage timing tracker (actual backend timings, never simulated)
    // ------------------------------------------------------------------

    private static final class StageTracker {
        private final ObjectMapper json;
        private final List<Map<String, Object>> stages = new ArrayList<>();
        private long last = System.currentTimeMillis();

        StageTracker(ObjectMapper json) { this.json = json; }

        void mark(String stage) {
            long now = System.currentTimeMillis();
            Map<String, Object> m = new LinkedHashMap<>();
            m.put("stage", stage);
            m.put("at", Instant.ofEpochMilli(now).toString());
            m.put("ms", now - last);
            stages.add(m);
            last = now;
        }

        String json() {
            try {
                return json.writeValueAsString(stages);
            } catch (Exception e) {
                return "[]";
            }
        }
    }
}
