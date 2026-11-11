package in.nextalloc.service;

import java.time.Instant;
import java.time.LocalDate;
import java.time.Period;
import java.util.*;

import org.springframework.stereotype.Service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;

import in.nextalloc.common.ApiException;
import in.nextalloc.common.Labels;
import in.nextalloc.domain.*;
import in.nextalloc.domain.enums.*;

/**
 * Deterministic, version-aware hard eligibility evaluator.
 *
 * Supported Rule-Sets:
 * 1. "prototype-legacy-v1" (version "1.0.0"):
 *    Historical prototype behavior. Checks candidate active state, opportunity active state,
 *    minimum qualification rank, and mandatory skills. Does not check academic enrollment,
 *    institutional NOC, or statutory exclusions.
 *
 * 2. "pmis-2026-expansion-demo-v1" (version "1.0.0") [alias: "pmis-2026-expansion-v1"]:
 *    PARTIAL DEMONSTRATION RULE-SET reflecting a subset of official MCA Guidelines
 *    (12 March 2026), Addendum (8 April 2026), and PIB announcement (22 April 2026, PRID 2254498).
 *    NOTICE: This rule-set is strictly for simulation, research, and policy demonstration.
 *    It does NOT implement family income limits (₹12 lakh threshold), prior government scheme
 *    exclusions, or automated AISHE registry verification. Passing these checks must NOT be
 *    represented as an authoritative statutory PMIS approval for published live allocations.
 *
 * Architecture Invariant:
 * Eligibility rule-set versions and fairness policy versions (v1 vs v2) are completely orthogonal.
 * This evaluator does not depend on, inspect, or dictate fairness representation floors.
 */
@Service
public class EligibilityEvaluator {

    public static final String RULESET_LEGACY = "prototype-legacy-v1";
    public static final String RULESET_PMIS_2026_DEMO = "pmis-2026-expansion-demo-v1";
    public static final String RULESET_PMIS_2026_ALIAS = "pmis-2026-expansion-v1";
    public static final String VERSION_1_0_0 = "1.0.0";

    public static final int MIN_AGE_YEARS = 18;
    public static final int MAX_AGE_YEARS = 25;

    /**
     * Authorized institutional NOC signatories under MCA April 2026 guidance:
     * - Head of Department (HOD)
     * - Dean
     * - Principal
     * - Training and Placement Officer (TPO)
     *
     * Note: REGISTRAR is intentionally excluded from automatic authorization in this
     * demonstration rule-set as it is not an independently established category in the
     * MCA April 2026 release.
     */
    public static final Set<SignatoryRole> AUTHORIZED_NOC_SIGNATORIES = Set.of(
            SignatoryRole.HEAD_OF_DEPARTMENT,
            SignatoryRole.DEAN,
            SignatoryRole.PRINCIPAL,
            SignatoryRole.TRAINING_AND_PLACEMENT_OFFICER
    );

    /**
     * Point-in-time evaluation result for a candidate.
     */
    public record CandidateEvaluation(
            String ruleSetId,
            String ruleSetVersion,
            Long candidateId,
            EligibilityDecision decision,
            List<EligibilityReasonCode> reasonCodes,
            List<String> humanReadableReasons,
            Long evidenceIdRef,
            String evidenceStatusSnapshot,
            Instant evaluatedAt,
            boolean missingEvidence,
            boolean isDemonstrationOnly
    ) {
        public boolean isEligible() {
            return decision == EligibilityDecision.ELIGIBLE;
        }
    }

    /**
     * Point-in-time evaluation result for a candidate-opportunity pair.
     */
    public record PairEvaluation(
            String ruleSetId,
            String ruleSetVersion,
            Long candidateId,
            Long opportunityId,
            EligibilityDecision decision,
            List<EligibilityReasonCode> reasonCodes,
            List<String> humanReadableReasons,
            Long evidenceIdRef,
            String evidenceStatusSnapshot,
            Instant evaluatedAt,
            boolean missingEvidence,
            boolean isDemonstrationOnly
    ) {
        public boolean isEligible() {
            return decision == EligibilityDecision.ELIGIBLE;
        }
    }

    private final ObjectMapper json;

    public EligibilityEvaluator(ObjectMapper json) {
        this.json = json;
    }

    /**
     * Validates that the requested rule-set and version are supported.
     * Fails safely by throwing an exception on unknown configurations.
     */
    public String validateAndCanonicalizeRuleSet(String ruleSetId, String ruleSetVersion) {
        if (ruleSetId == null || ruleSetId.isBlank()) {
            throw ApiException.badRequest("Eligibility rule-set ID must not be blank.");
        }
        String id = ruleSetId.trim().toLowerCase();
        String canonicalId;
        if (RULESET_LEGACY.equals(id)) {
            canonicalId = RULESET_LEGACY;
        } else if (RULESET_PMIS_2026_DEMO.equals(id) || RULESET_PMIS_2026_ALIAS.equals(id)) {
            canonicalId = RULESET_PMIS_2026_DEMO;
        } else {
            throw ApiException.badRequest("Unsupported eligibility rule-set: '" + ruleSetId
                    + "'. Supported rule-sets are '" + RULESET_LEGACY + "' and '" + RULESET_PMIS_2026_DEMO + "'.");
        }

        if (ruleSetVersion != null && !ruleSetVersion.isBlank()) {
            String v = ruleSetVersion.trim();
            if (!"1.0.0".equals(v) && !"1.0".equals(v) && !"v1".equals(v)) {
                throw ApiException.badRequest("Unsupported eligibility rule-set version: '" + ruleSetVersion
                        + "'. Supported versions for '" + ruleSetId + "' are '1.0.0' or '1.0'.");
            }
        }
        return canonicalId;
    }

    /**
     * Evaluates a candidate under the specified rule-set using an explicit reference date.
     * Deterministic: never falls back to LocalDate.now() to ensure reproducible historical replays.
     */
    public CandidateEvaluation evaluateCandidate(
            String ruleSetId,
            String ruleSetVersion,
            CandidateProfile candidate,
            CandidateAcademicRecord academicRecord,
            List<CandidateEvidence> evidences,
            LocalDate referenceDate
    ) {
        if (referenceDate == null) {
            throw ApiException.badRequest("Evaluation reference date is required for deterministic and reproducible evaluation.");
        }
        String canonicalId = validateAndCanonicalizeRuleSet(ruleSetId, ruleSetVersion);
        String canonicalVersion = (ruleSetVersion == null || ruleSetVersion.isBlank()) ? VERSION_1_0_0 : ruleSetVersion.trim();
        Instant now = Instant.now();

        if (candidate == null) {
            return new CandidateEvaluation(canonicalId, canonicalVersion, null,
                    EligibilityDecision.INELIGIBLE,
                    List.of(EligibilityReasonCode.ACADEMIC_STANDING_UNVERIFIED),
                    List.of("Candidate profile is missing."),
                    null, null, now, false, isDemoRuleSet(canonicalId));
        }

        if (RULESET_LEGACY.equals(canonicalId)) {
            return evaluateCandidateLegacy(canonicalId, canonicalVersion, candidate, now);
        } else {
            return evaluateCandidate2026Demo(canonicalId, canonicalVersion, candidate, academicRecord, evidences, referenceDate, now);
        }
    }

    /**
     * Evaluates a candidate-opportunity pair under the specified rule-set using an explicit reference date.
     */
    public PairEvaluation evaluatePair(
            String ruleSetId,
            String ruleSetVersion,
            CandidateProfile candidate,
            Set<String> candidateSkills,
            CandidateAcademicRecord academicRecord,
            List<CandidateEvidence> evidences,
            Opportunity opportunity,
            List<OpportunitySkill> requirements,
            LocalDate referenceDate
    ) {
        CandidateEvaluation candEval = evaluateCandidate(
                ruleSetId, ruleSetVersion, candidate, academicRecord, evidences, referenceDate);

        Instant now = candEval.evaluatedAt();
        String canonicalId = candEval.ruleSetId();
        String canonicalVersion = candEval.ruleSetVersion();

        if (opportunity == null) {
            return new PairEvaluation(canonicalId, canonicalVersion,
                    candidate != null ? candidate.id : null, null,
                    EligibilityDecision.INELIGIBLE,
                    List.of(EligibilityReasonCode.OPPORTUNITY_INACTIVE),
                    List.of("Opportunity is missing."),
                    candEval.evidenceIdRef(), candEval.evidenceStatusSnapshot(),
                    now, false, candEval.isDemonstrationOnly());
        }

        List<EligibilityReasonCode> codes = new ArrayList<>();
        List<String> humanReasons = new ArrayList<>();
        boolean missingEvidence = candEval.missingEvidence();

        // If candidate-level evaluation failed, inherit candidate failure reasons
        if (!candEval.isEligible()) {
            codes.addAll(candEval.reasonCodes());
            humanReasons.addAll(candEval.humanReadableReasons());
        }

        // Opportunity status check
        if (opportunity.status != OppStatus.ACTIVE) {
            codes.add(EligibilityReasonCode.OPPORTUNITY_INACTIVE);
            humanReasons.add("This opportunity is not currently open.");
        }

        // Qualification check
        if (candidate == null || candidate.qualification == null
                || (opportunity.minQualification != null && opportunity.minQualification.rank > candidate.qualification.rank)) {
            codes.add(EligibilityReasonCode.QUALIFICATION_BELOW_MINIMUM);
            String requiredLabel = opportunity.minQualification != null ? Labels.label(opportunity.minQualification) : "Required";
            humanReasons.add("Qualification below the required level (" + requiredLabel + " required).");
        }

        // Mandatory skill requirements
        if (requirements != null) {
            Set<String> sk = candidateSkills != null ? candidateSkills : Set.of();
            for (OpportunitySkill s : requirements) {
                if (s.mandatory && !sk.contains(s.skill)) {
                    codes.add(EligibilityReasonCode.MANDATORY_SKILL_MISSING);
                    humanReasons.add("Required " + s.skill + " skill is missing.");
                }
            }
        }

        EligibilityDecision decision = codes.isEmpty() ? EligibilityDecision.ELIGIBLE : EligibilityDecision.INELIGIBLE;
        if (decision == EligibilityDecision.ELIGIBLE) {
            codes.add(EligibilityReasonCode.ELIGIBLE);
        }

        return new PairEvaluation(canonicalId, canonicalVersion,
                candidate != null ? candidate.id : null,
                opportunity.id,
                decision,
                Collections.unmodifiableList(codes),
                Collections.unmodifiableList(humanReasons),
                candEval.evidenceIdRef(),
                candEval.evidenceStatusSnapshot(),
                now,
                missingEvidence,
                candEval.isDemonstrationOnly());
    }

    /**
     * Builds an AllocationEligibilitySnapshot from a candidate evaluation.
     * Ready for database persistence; does not by itself establish ledger immutability until persisted.
     */
    public AllocationEligibilitySnapshot createSnapshot(Long runId, CandidateEvaluation eval) {
        if (runId == null || eval == null) {
            throw ApiException.badRequest("Run ID and CandidateEvaluation are required to create a snapshot.");
        }
        AllocationEligibilitySnapshot snapshot = new AllocationEligibilitySnapshot();
        snapshot.runId = runId;
        snapshot.candidateId = eval.candidateId();
        snapshot.decision = eval.decision();
        try {
            snapshot.reasonCodesJson = json.writeValueAsString(eval.reasonCodes().stream().map(Enum::name).toList());
        } catch (JsonProcessingException e) {
            snapshot.reasonCodesJson = "[\"" + eval.decision().name() + "\"]";
        }
        snapshot.evidenceIdRef = eval.evidenceIdRef();
        snapshot.evidenceStatusSnapshot = eval.evidenceStatusSnapshot();
        snapshot.evaluatedAt = eval.evaluatedAt();
        return snapshot;
    }

    public static boolean isDemoRuleSet(String ruleSetId) {
        if (ruleSetId == null) return false;
        String id = ruleSetId.trim().toLowerCase();
        return RULESET_PMIS_2026_DEMO.equals(id) || RULESET_PMIS_2026_ALIAS.equals(id);
    }

    // ------------------------------------------------------------------
    // Internal Rule-Set Implementations
    // ------------------------------------------------------------------

    private CandidateEvaluation evaluateCandidateLegacy(
            String ruleSetId, String version, CandidateProfile candidate, Instant now) {
        List<EligibilityReasonCode> codes = new ArrayList<>();
        List<String> human = new ArrayList<>();

        if (candidate.candidateState != CandidateState.ACTIVE) {
            codes.add(EligibilityReasonCode.CANDIDATE_WITHDRAWN);
            human.add("Your participation has been withdrawn.");
        }

        EligibilityDecision decision = codes.isEmpty() ? EligibilityDecision.ELIGIBLE : EligibilityDecision.INELIGIBLE;
        if (decision == EligibilityDecision.ELIGIBLE) {
            codes.add(EligibilityReasonCode.ELIGIBLE);
        }

        return new CandidateEvaluation(ruleSetId, version, candidate.id, decision,
                Collections.unmodifiableList(codes),
                Collections.unmodifiableList(human),
                null, null, now, false, false);
    }

    private CandidateEvaluation evaluateCandidate2026Demo(
            String ruleSetId,
            String version,
            CandidateProfile candidate,
            CandidateAcademicRecord academicRecord,
            List<CandidateEvidence> evidences,
            LocalDate refDate,
            Instant now
    ) {
        List<EligibilityReasonCode> codes = new ArrayList<>();
        List<String> human = new ArrayList<>();
        boolean missingEvidence = false;
        Long evidenceIdRef = null;
        String evidenceStatusSnapshot = null;

        // 1. Candidate Active State
        if (candidate.candidateState != CandidateState.ACTIVE) {
            codes.add(EligibilityReasonCode.CANDIDATE_WITHDRAWN);
            human.add("Your participation has been withdrawn.");
        }

        // 2. Age Check (MCA 12 March 2026 guidelines: ages 18 to 25 as of reference date)
        if (candidate.dob == null) {
            codes.add(EligibilityReasonCode.ACADEMIC_STANDING_UNVERIFIED);
            human.add("Date of birth is missing; cannot verify age eligibility (18-25).");
            missingEvidence = true;
        } else {
            int age = Period.between(candidate.dob, refDate).getYears();
            if (age < MIN_AGE_YEARS) {
                codes.add(EligibilityReasonCode.AGE_BELOW_MINIMUM);
                human.add("Candidate age (" + age + ") is below minimum required age of " + MIN_AGE_YEARS + " years.");
            } else if (age > MAX_AGE_YEARS) {
                codes.add(EligibilityReasonCode.AGE_EXCEEDS_MAXIMUM);
                human.add("Candidate age (" + age + ") exceeds maximum allowed age of " + MAX_AGE_YEARS + " years.");
            }
        }

        // 3. Employment Check (MCA exclusion: full-time employment prohibited)
        if (candidate.employmentType == EmploymentType.FULL_TIME) {
            codes.add(EligibilityReasonCode.FULL_TIME_EMPLOYED);
            human.add("Candidate is employed full-time, which is excluded under PMIS regulations.");
        }

        // 4. Academic Standing & Institutional NOC (April 2026 Expansion)
        EnrollmentStatus enrollment = (academicRecord != null && academicRecord.enrollmentStatus != null)
                ? academicRecord.enrollmentStatus
                : EnrollmentStatus.UNKNOWN;

        switch (enrollment) {
            case NOT_ENROLLED -> {
                // Completed education / graduate pathway. No institutional NOC required.
                if (candidate.qualification == null) {
                    codes.add(EligibilityReasonCode.QUALIFICATION_BELOW_MINIMUM);
                    human.add("Candidate has no recorded qualification.");
                }
            }
            case ENROLLED_DISTANCE_PART_TIME -> {
                // Distance/part-time enrollment is permitted under PMIS guidelines without full-time college attendance conflicts.
            }
            case UNKNOWN -> {
                // Unknown enrollment state fails safely
                codes.add(EligibilityReasonCode.ACADEMIC_STANDING_UNVERIFIED);
                human.add("Academic enrollment standing is unknown or unverified.");
                missingEvidence = true;
            }
            case ENROLLED_FULL_TIME -> {
                // Enrolled full-time: eligible only under the April 2026 Final-Year Expansion with Institutional NOC
                FinalYearStatus finalYear = academicRecord.finalYearStatus != null
                        ? academicRecord.finalYearStatus
                        : FinalYearStatus.UNKNOWN;

                switch (finalYear) {
                    case VERIFIED_FINAL_YEAR -> {
                        // Enrolled in final year: requires verified Institutional NOC
                        CandidateEvidence noc = findInstitutionalNoc(evidences);
                        if (noc == null || noc.verificationStatus == null
                                || noc.verificationStatus == EvidenceStatus.NOT_SUBMITTED) {
                            codes.add(EligibilityReasonCode.INSTITUTIONAL_NOC_MISSING);
                            human.add("Institutional NOC has not been submitted.");
                            missingEvidence = true;
                        } else {
                            evidenceIdRef = noc.id;
                            evidenceStatusSnapshot = noc.verificationStatus.name();

                            switch (noc.verificationStatus) {
                                case SUBMITTED, PENDING_ADDITIONAL_INFO -> {
                                    codes.add(EligibilityReasonCode.INSTITUTIONAL_NOC_UNVERIFIED);
                                    human.add("Institutional NOC is pending administrative verification.");
                                    missingEvidence = true;
                                }
                                case REJECTED -> {
                                    codes.add(EligibilityReasonCode.INSTITUTIONAL_NOC_REJECTED);
                                    human.add("Institutional NOC was rejected during verification: "
                                            + (noc.rejectionNotes != null ? noc.rejectionNotes : "Criteria not met."));
                                }
                                case EXPIRED -> {
                                    codes.add(EligibilityReasonCode.INSTITUTIONAL_NOC_EXPIRED);
                                    human.add("Institutional NOC validity has expired.");
                                }
                                case VERIFIED -> {
                                    // Check effective dates against reference date
                                    if (noc.validFrom != null && noc.validFrom.isAfter(refDate)) {
                                        codes.add(EligibilityReasonCode.INSTITUTIONAL_NOC_EXPIRED);
                                        human.add("Institutional NOC is not yet effective as of reference date " + refDate + " (valid from " + noc.validFrom + ").");
                                    }
                                    if (noc.validUntil != null && noc.validUntil.isBefore(refDate)) {
                                        codes.add(EligibilityReasonCode.INSTITUTIONAL_NOC_EXPIRED);
                                        human.add("Institutional NOC validity expired on " + noc.validUntil + ".");
                                    }
                                    // Check signatory authorization: HOD, Dean, Principal, TPO
                                    if (noc.signatoryRole == null || !AUTHORIZED_NOC_SIGNATORIES.contains(noc.signatoryRole)) {
                                        codes.add(EligibilityReasonCode.UNAUTHORIZED_NOC_SIGNATORY);
                                        human.add("Institutional NOC was signed by an unauthorized or unverified signatory role: "
                                                + (noc.signatoryRole != null ? noc.signatoryRole.name() : "None")
                                                + ". Accepted signatories under April 2026 PMIS guidelines are Head of Department, Dean, Principal, or Training & Placement Officer.");
                                    }
                                    // Check institutional conflict certification
                                    if (!noc.declaresNoAcademicConflict) {
                                        codes.add(EligibilityReasonCode.NOC_ACADEMIC_CONFLICT_DECLARED);
                                        human.add("Institutional NOC does not certify the absence of academic schedule conflicts.");
                                    }
                                }
                                default -> {
                                    codes.add(EligibilityReasonCode.INSTITUTIONAL_NOC_UNVERIFIED);
                                    human.add("Institutional NOC status is unrecognized: " + noc.verificationStatus);
                                    missingEvidence = true;
                                }
                            }
                        }
                    }
                    case VERIFIED_NOT_FINAL_YEAR -> {
                        codes.add(EligibilityReasonCode.NOT_IN_FINAL_YEAR);
                        codes.add(EligibilityReasonCode.FULL_TIME_EDUCATION_DISQUALIFIED);
                        human.add("Candidate is verified not to be in the final year of degree program.");
                        human.add("Full-time students not in final year are disqualified under PMIS regulations.");
                    }
                    case CLAIMED_FINAL_YEAR -> {
                        codes.add(EligibilityReasonCode.ACADEMIC_STANDING_UNVERIFIED);
                        human.add("Candidate claims final-year standing, but it has not been verified by the institution.");
                        missingEvidence = true;
                    }
                    case UNKNOWN -> {
                        codes.add(EligibilityReasonCode.ACADEMIC_STANDING_UNVERIFIED);
                        human.add("Final-year academic standing is unknown or unverified.");
                        missingEvidence = true;
                    }
                }
            }
        }

        EligibilityDecision decision = codes.isEmpty() ? EligibilityDecision.ELIGIBLE : EligibilityDecision.INELIGIBLE;
        if (decision == EligibilityDecision.ELIGIBLE) {
            codes.add(EligibilityReasonCode.ELIGIBLE);
        }

        return new CandidateEvaluation(ruleSetId, version, candidate.id, decision,
                Collections.unmodifiableList(codes),
                Collections.unmodifiableList(human),
                evidenceIdRef, evidenceStatusSnapshot, now, missingEvidence, true);
    }

    private CandidateEvidence findInstitutionalNoc(List<CandidateEvidence> evidences) {
        if (evidences == null || evidences.isEmpty()) return null;
        for (CandidateEvidence e : evidences) {
            if (e != null && "INSTITUTIONAL_NOC".equalsIgnoreCase(e.evidenceType)) {
                return e;
            }
        }
        return null;
    }
}
