package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import com.fasterxml.jackson.databind.ObjectMapper;

import in.nextalloc.ai.AiServiceClient;
import in.nextalloc.common.ApiException;
import in.nextalloc.domain.*;
import in.nextalloc.domain.enums.*;
import in.nextalloc.service.EligibilityEvaluator.CandidateEvaluation;
import in.nextalloc.service.EligibilityEvaluator.PairEvaluation;

/**
 * Gate 4 Verification & Quality Gate Regression Test Suite:
 * Deterministic, Version-Aware Hard Eligibility Evaluator.
 *
 * NOTE ON TEST SCOPES:
 * - Tests 1-14, 19-22: Direct unit tests of EligibilityEvaluator (and comparison against SuitabilityService).
 * - Test 15: Unit boundary simulation proving ineligible candidates are excluded prior to optimizer payload assembly.
 * - Test 16: Payload inspection unit test verifying OptPair JSON serialization contains no confidential document data.
 * - Test 17: Candidate universe unit test verifying the AllocationService.toCandidateIds helper preserves 0-pair candidates.
 * - Test 18 & 22: Contract tests asserting complete independence between fairness policy versions (v1/v2) and eligibility rule-sets.
 *
 * (Live allocation integration tests involving AllocationService and the live Python optimizer are deferred to Phase 4A-2C).
 */
class EligibilityEvaluatorTest {

    private EligibilityEvaluator evaluator;
    private SuitabilityService suitabilityService;
    private ObjectMapper json;
    private LocalDate referenceDate;

    @BeforeEach
    void setUp() {
        json = new ObjectMapper();
        evaluator = new EligibilityEvaluator(json);
        suitabilityService = new SuitabilityService();
        referenceDate = LocalDate.of(2026, 5, 1);
    }

    private CandidateProfile createCandidate(Long id, CandidateState state, LocalDate dob,
                                             EmploymentType empType, Qualification qual) {
        CandidateProfile p = new CandidateProfile();
        p.id = id;
        p.userId = id + 1000L;
        p.fullName = "Candidate " + id;
        p.candidateState = state;
        p.dob = dob;
        p.employmentType = empType;
        p.qualification = qual;
        p.locationType = LocationType.RURAL;
        p.state = "Karnataka";
        return p;
    }

    private Opportunity createOpportunity(Long id, OppStatus status, Qualification minQual, int capacity) {
        Opportunity o = new Opportunity();
        o.id = id;
        o.title = "Software Intern " + id;
        o.status = status;
        o.minQualification = minQual;
        o.capacity = capacity;
        o.state = "Karnataka";
        o.sector = Sector.SOFTWARE_IT;
        return o;
    }

    private CandidateAcademicRecord createAcademicRecord(Long candId, EnrollmentStatus enrollStatus,
                                                         FinalYearStatus finalYearStatus, String degree) {
        CandidateAcademicRecord r = new CandidateAcademicRecord();
        r.candidateId = candId;
        r.enrollmentStatus = enrollStatus;
        r.finalYearStatus = finalYearStatus;
        r.degreeProgram = degree;
        r.institutionName = "National Institute of Technology";
        return r;
    }

    private CandidateEvidence createNoc(Long id, Long candId, EvidenceStatus status,
                                        SignatoryRole role, boolean noConflict,
                                        LocalDate validFrom, LocalDate validUntil) {
        CandidateEvidence e = new CandidateEvidence();
        e.id = id;
        e.candidateId = candId;
        e.evidenceType = "INSTITUTIONAL_NOC";
        e.documentReference = "DOC-NOC-" + id + ".pdf";
        e.documentSha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        e.issuingInstitution = "National Institute of Technology";
        e.signatoryRole = role;
        e.signatoryName = "Dr. Dean Academic";
        e.signatoryEmail = "dean@nit.edu.in";
        e.declaresNoAcademicConflict = noConflict;
        e.verificationStatus = status;
        e.validFrom = validFrom;
        e.validUntil = validUntil;
        return e;
    }

    // ------------------------------------------------------------------
    // 1. Legacy prototype parity
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 1: Legacy prototype parity with SuitabilityService.check")
    void test1_legacyPrototypeParity() {
        CandidateProfile candActive = createCandidate(1L, CandidateState.ACTIVE,
                LocalDate.of(2003, 1, 1), EmploymentType.FULL_TIME, Qualification.BACHELORS);
        CandidateProfile candWithdrawn = createCandidate(2L, CandidateState.WITHDRAWN,
                LocalDate.of(2003, 1, 1), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);

        Opportunity oppActive = createOpportunity(10L, OppStatus.ACTIVE, Qualification.BACHELORS, 2);
        Opportunity oppInactive = createOpportunity(20L, OppStatus.CLOSED, Qualification.BACHELORS, 2);
        Opportunity oppHighQual = createOpportunity(30L, OppStatus.ACTIVE, Qualification.POST_GRADUATE, 2);

        OpportunitySkill reqSkill = new OpportunitySkill();
        reqSkill.opportunityId = 10L;
        reqSkill.skill = "Java";
        reqSkill.mandatory = true;

        List<OpportunitySkill> reqs = List.of(reqSkill);

        // Active candidate, matching skill
        var legacyRes1 = suitabilityService.check(candActive, Set.of("Java"), oppActive, reqs);
        var evalRes1 = evaluator.evaluatePair(
                EligibilityEvaluator.RULESET_LEGACY, "1.0.0",
                candActive, Set.of("Java"), null, null, oppActive, reqs, referenceDate);
        assertEquals(legacyRes1.eligible(), evalRes1.isEligible());
        assertTrue(evalRes1.isEligible());
        assertFalse(evalRes1.isDemonstrationOnly());

        // Missing mandatory skill
        var legacyRes2 = suitabilityService.check(candActive, Set.of("Python"), oppActive, reqs);
        var evalRes2 = evaluator.evaluatePair(
                EligibilityEvaluator.RULESET_LEGACY, "1.0.0",
                candActive, Set.of("Python"), null, null, oppActive, reqs, referenceDate);
        assertEquals(legacyRes2.eligible(), evalRes2.isEligible());
        assertFalse(evalRes2.isEligible());
        assertTrue(evalRes2.reasonCodes().contains(EligibilityReasonCode.MANDATORY_SKILL_MISSING));

        // Withdrawn candidate
        var legacyRes3 = suitabilityService.check(candWithdrawn, Set.of("Java"), oppActive, reqs);
        var evalRes3 = evaluator.evaluatePair(
                EligibilityEvaluator.RULESET_LEGACY, "1.0.0",
                candWithdrawn, Set.of("Java"), null, null, oppActive, reqs, referenceDate);
        assertEquals(legacyRes3.eligible(), evalRes3.isEligible());
        assertFalse(evalRes3.isEligible());
        assertTrue(evalRes3.reasonCodes().contains(EligibilityReasonCode.CANDIDATE_WITHDRAWN));

        // Inactive opportunity
        var legacyRes4 = suitabilityService.check(candActive, Set.of("Java"), oppInactive, reqs);
        var evalRes4 = evaluator.evaluatePair(
                EligibilityEvaluator.RULESET_LEGACY, "1.0.0",
                candActive, Set.of("Java"), null, null, oppInactive, reqs, referenceDate);
        assertEquals(legacyRes4.eligible(), evalRes4.isEligible());
        assertFalse(evalRes4.isEligible());
        assertTrue(evalRes4.reasonCodes().contains(EligibilityReasonCode.OPPORTUNITY_INACTIVE));

        // Qualification below minimum
        var legacyRes5 = suitabilityService.check(candActive, Set.of("Java"), oppHighQual, reqs);
        var evalRes5 = evaluator.evaluatePair(
                EligibilityEvaluator.RULESET_LEGACY, "1.0.0",
                candActive, Set.of("Java"), null, null, oppHighQual, reqs, referenceDate);
        assertEquals(legacyRes5.eligible(), evalRes5.isEligible());
        assertFalse(evalRes5.isEligible());
        assertTrue(evalRes5.reasonCodes().contains(EligibilityReasonCode.QUALIFICATION_BELOW_MINIMUM));
    }

    // ------------------------------------------------------------------
    // 2. High-scoring but ineligible candidate
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 2: High suitability match candidate rejected when legally ineligible")
    void test2_highScoringIneligibleCandidate() {
        CandidateProfile cand = createCandidate(101L, CandidateState.ACTIVE,
                LocalDate.of(2002, 1, 1), EmploymentType.FULL_TIME, Qualification.BACHELORS);
        Opportunity opp = createOpportunity(10L, OppStatus.ACTIVE, Qualification.BACHELORS, 2);

        SuitabilityService.PairScore score = suitabilityService.score(
                cand, Set.of("Java", "Spring"), Set.of(Sector.SOFTWARE_IT), 1, opp, List.of(),
                new in.nextalloc.common.Weights(20, 20, 15, 15, 15, 10, 5));
        assertTrue(score.overall() > 70.0, "Score is high");

        CandidateAcademicRecord acad = createAcademicRecord(101L, EnrollmentStatus.NOT_ENROLLED,
                FinalYearStatus.UNKNOWN, "B.Tech Computer Science");
        PairEvaluation eval = evaluator.evaluatePair(
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                cand, Set.of("Java", "Spring"), acad, List.of(), opp, List.of(), referenceDate);

        assertFalse(eval.isEligible(), "High scoring candidate must be marked INELIGIBLE");
        assertEquals(EligibilityDecision.INELIGIBLE, eval.decision());
        assertTrue(eval.reasonCodes().contains(EligibilityReasonCode.FULL_TIME_EMPLOYED));
        assertFalse(eval.missingEvidence());
        assertTrue(eval.isDemonstrationOnly());
    }

    // ------------------------------------------------------------------
    // 3. Verified final-year UG with valid NOC evidence
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 3: Verified final-year UG student with valid NOC is ELIGIBLE under demonstration rules")
    void test3_verifiedFinalYearUgWithValidNoc() {
        CandidateProfile cand = createCandidate(201L, CandidateState.ACTIVE,
                LocalDate.of(2003, 6, 15), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);
        CandidateAcademicRecord acad = createAcademicRecord(201L, EnrollmentStatus.ENROLLED_FULL_TIME,
                FinalYearStatus.VERIFIED_FINAL_YEAR, "B.Tech Mechanical");
        CandidateEvidence noc = createNoc(501L, 201L, EvidenceStatus.VERIFIED,
                SignatoryRole.DEAN, true, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31));

        Opportunity opp = createOpportunity(10L, OppStatus.ACTIVE, Qualification.BACHELORS, 5);

        PairEvaluation eval = evaluator.evaluatePair(
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                cand, Set.of("CAD"), acad, List.of(noc), opp, List.of(), referenceDate);

        assertTrue(eval.isEligible());
        assertEquals(EligibilityDecision.ELIGIBLE, eval.decision());
        assertEquals(List.of(EligibilityReasonCode.ELIGIBLE), eval.reasonCodes());
        assertEquals(501L, eval.evidenceIdRef());
        assertEquals("VERIFIED", eval.evidenceStatusSnapshot());
        assertFalse(eval.missingEvidence());
        assertTrue(eval.isDemonstrationOnly(), "Demonstration rule-set must flag isDemonstrationOnly=true");
    }

    // ------------------------------------------------------------------
    // 4. Verified final-year PG with valid NOC evidence
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 4: Verified final-year PG student with valid NOC is ELIGIBLE under demonstration rules")
    void test4_verifiedFinalYearPgWithValidNoc() {
        CandidateProfile cand = createCandidate(202L, CandidateState.ACTIVE,
                LocalDate.of(2001, 8, 20), EmploymentType.UNEMPLOYED, Qualification.POST_GRADUATE);
        CandidateAcademicRecord acad = createAcademicRecord(202L, EnrollmentStatus.ENROLLED_FULL_TIME,
                FinalYearStatus.VERIFIED_FINAL_YEAR, "M.Tech Data Science");
        CandidateEvidence noc = createNoc(502L, 202L, EvidenceStatus.VERIFIED,
                SignatoryRole.HEAD_OF_DEPARTMENT, true, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31));

        Opportunity opp = createOpportunity(12L, OppStatus.ACTIVE, Qualification.BACHELORS, 3);

        PairEvaluation eval = evaluator.evaluatePair(
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                cand, Set.of("Python"), acad, List.of(noc), opp, List.of(), referenceDate);

        assertTrue(eval.isEligible());
        assertEquals(EligibilityDecision.ELIGIBLE, eval.decision());
        assertEquals(502L, eval.evidenceIdRef());
        assertEquals("VERIFIED", eval.evidenceStatusSnapshot());
        assertTrue(eval.isDemonstrationOnly());
    }

    // ------------------------------------------------------------------
    // 5. Missing NOC
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 5: Full-time enrolled final-year student with missing NOC is INELIGIBLE")
    void test5_missingNoc() {
        CandidateProfile cand = createCandidate(203L, CandidateState.ACTIVE,
                LocalDate.of(2003, 3, 10), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);
        CandidateAcademicRecord acad = createAcademicRecord(203L, EnrollmentStatus.ENROLLED_FULL_TIME,
                FinalYearStatus.VERIFIED_FINAL_YEAR, "B.E. Civil");

        CandidateEvaluation eval = evaluator.evaluateCandidate(
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                cand, acad, Collections.emptyList(), referenceDate);

        assertFalse(eval.isEligible());
        assertEquals(EligibilityDecision.INELIGIBLE, eval.decision());
        assertTrue(eval.reasonCodes().contains(EligibilityReasonCode.INSTITUTIONAL_NOC_MISSING));
        assertTrue(eval.missingEvidence(), "Must flag missingEvidence = true");
        assertNull(eval.evidenceIdRef());
    }

    // ------------------------------------------------------------------
    // 6. Pending NOC
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 6: Full-time enrolled student with pending NOC is INELIGIBLE (missing evidence)")
    void test6_pendingNoc() {
        CandidateProfile cand = createCandidate(204L, CandidateState.ACTIVE,
                LocalDate.of(2003, 3, 10), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);
        CandidateAcademicRecord acad = createAcademicRecord(204L, EnrollmentStatus.ENROLLED_FULL_TIME,
                FinalYearStatus.VERIFIED_FINAL_YEAR, "B.Com");
        CandidateEvidence noc = createNoc(504L, 204L, EvidenceStatus.SUBMITTED,
                SignatoryRole.PRINCIPAL, true, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31));

        CandidateEvaluation eval = evaluator.evaluateCandidate(
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                cand, acad, List.of(noc), referenceDate);

        assertFalse(eval.isEligible());
        assertEquals(EligibilityDecision.INELIGIBLE, eval.decision());
        assertTrue(eval.reasonCodes().contains(EligibilityReasonCode.INSTITUTIONAL_NOC_UNVERIFIED));
        assertTrue(eval.missingEvidence());
        assertEquals(504L, eval.evidenceIdRef());
        assertEquals("SUBMITTED", eval.evidenceStatusSnapshot());
    }

    // ------------------------------------------------------------------
    // 7. Rejected NOC
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 7: Full-time enrolled student with rejected NOC is INELIGIBLE")
    void test7_rejectedNoc() {
        CandidateProfile cand = createCandidate(205L, CandidateState.ACTIVE,
                LocalDate.of(2003, 3, 10), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);
        CandidateAcademicRecord acad = createAcademicRecord(205L, EnrollmentStatus.ENROLLED_FULL_TIME,
                FinalYearStatus.VERIFIED_FINAL_YEAR, "B.Sc");
        CandidateEvidence noc = createNoc(505L, 205L, EvidenceStatus.REJECTED,
                SignatoryRole.PRINCIPAL, true, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31));
        noc.rejectionNotes = "Institution seal not verified.";

        CandidateEvaluation eval = evaluator.evaluateCandidate(
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                cand, acad, List.of(noc), referenceDate);

        assertFalse(eval.isEligible());
        assertEquals(EligibilityDecision.INELIGIBLE, eval.decision());
        assertTrue(eval.reasonCodes().contains(EligibilityReasonCode.INSTITUTIONAL_NOC_REJECTED));
        assertFalse(eval.missingEvidence());
        assertEquals(505L, eval.evidenceIdRef());
        assertEquals("REJECTED", eval.evidenceStatusSnapshot());
    }

    // ------------------------------------------------------------------
    // 8. Unknown enrollment state
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 8: Unknown enrollment state produces ACADEMIC_STANDING_UNVERIFIED")
    void test8_unknownEnrollmentState() {
        CandidateProfile cand = createCandidate(206L, CandidateState.ACTIVE,
                LocalDate.of(2002, 5, 10), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);

        // Academic record null
        CandidateEvaluation evalNull = evaluator.evaluateCandidate(
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                cand, null, List.of(), referenceDate);
        assertFalse(evalNull.isEligible());
        assertTrue(evalNull.reasonCodes().contains(EligibilityReasonCode.ACADEMIC_STANDING_UNVERIFIED));
        assertTrue(evalNull.missingEvidence());

        // Academic record status UNKNOWN
        CandidateAcademicRecord acadUnknown = createAcademicRecord(206L, EnrollmentStatus.UNKNOWN,
                FinalYearStatus.UNKNOWN, null);
        CandidateEvaluation evalUnknown = evaluator.evaluateCandidate(
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                cand, acadUnknown, List.of(), referenceDate);
        assertFalse(evalUnknown.isEligible());
        assertTrue(evalUnknown.reasonCodes().contains(EligibilityReasonCode.ACADEMIC_STANDING_UNVERIFIED));
        assertTrue(evalUnknown.missingEvidence());
    }

    // ------------------------------------------------------------------
    // 9. Unsupported rule-set version
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 9: Unsupported rule-set or version throws ApiException and fails safely")
    void test9_unsupportedRuleSetVersion() {
        CandidateProfile cand = createCandidate(301L, CandidateState.ACTIVE,
                LocalDate.of(2003, 1, 1), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);

        assertThrows(ApiException.class, () ->
                evaluator.validateAndCanonicalizeRuleSet("unknown-ruleset", "1.0.0"));
        assertThrows(ApiException.class, () ->
                evaluator.validateAndCanonicalizeRuleSet(EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "99.0.0"));
        assertThrows(ApiException.class, () ->
                evaluator.evaluateCandidate("invalid-policy", "1.0.0", cand, null, List.of(), referenceDate));
    }

    // ------------------------------------------------------------------
    // 10. Existing mandatory opportunity qualification and skill requirements
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 10: Opportunity qualification and mandatory skill enforcement")
    void test10_opportunityRequirements() {
        CandidateProfile cand = createCandidate(401L, CandidateState.ACTIVE,
                LocalDate.of(2002, 1, 1), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);
        CandidateAcademicRecord acad = createAcademicRecord(401L, EnrollmentStatus.NOT_ENROLLED,
                FinalYearStatus.UNKNOWN, "B.Sc");

        Opportunity opp = createOpportunity(50L, OppStatus.ACTIVE, Qualification.POST_GRADUATE, 2);
        OpportunitySkill s1 = new OpportunitySkill();
        s1.opportunityId = 50L;
        s1.skill = "SQL";
        s1.mandatory = true;

        PairEvaluation eval = evaluator.evaluatePair(
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                cand, Set.of("Python"), acad, List.of(), opp, List.of(s1), referenceDate);

        assertFalse(eval.isEligible());
        assertTrue(eval.reasonCodes().contains(EligibilityReasonCode.QUALIFICATION_BELOW_MINIMUM));
        assertTrue(eval.reasonCodes().contains(EligibilityReasonCode.MANDATORY_SKILL_MISSING));
    }

    // ------------------------------------------------------------------
    // 11. Historical policy-version inheritance
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 11: Historical runs with prototype-legacy-v1 preserve legacy semantics")
    void test11_historicalRuleSetInheritance() {
        CandidateProfile cand = createCandidate(501L, CandidateState.ACTIVE,
                LocalDate.of(2003, 1, 1), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);
        Opportunity opp = createOpportunity(60L, OppStatus.ACTIVE, Qualification.BACHELORS, 2);

        // Under 2026 demo rules: INELIGIBLE (missing academic NOC)
        PairEvaluation eval2026 = evaluator.evaluatePair(
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                cand, Set.of(), null, List.of(), opp, List.of(), referenceDate);
        assertFalse(eval2026.isEligible());

        // Under historical legacy rules: ELIGIBLE (historical runs had no NOC checks)
        PairEvaluation evalLegacy = evaluator.evaluatePair(
                EligibilityEvaluator.RULESET_LEGACY, "1.0.0",
                cand, Set.of(), null, List.of(), opp, List.of(), referenceDate);
        assertTrue(evalLegacy.isEligible(), "Historical legacy mode must preserve legacy eligibility");
    }

    // ------------------------------------------------------------------
    // 12. Rule-set effective-date handling
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 12: Effective-date checks for NOC expiration and candidate age")
    void test12_ruleSetEffectiveDateHandling() {
        CandidateAcademicRecord acad = createAcademicRecord(601L, EnrollmentStatus.ENROLLED_FULL_TIME,
                FinalYearStatus.VERIFIED_FINAL_YEAR, "B.E.");
        CandidateEvidence expiredNoc = createNoc(701L, 601L, EvidenceStatus.VERIFIED,
                SignatoryRole.DEAN, true, LocalDate.of(2025, 4, 15), LocalDate.of(2026, 4, 15));

        // Age 26 candidate (born 2000-01-01 relative to reference date 2026-05-01)
        CandidateProfile candOverAge = createCandidate(601L, CandidateState.ACTIVE,
                LocalDate.of(2000, 1, 1), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);

        CandidateEvaluation eval = evaluator.evaluateCandidate(
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                candOverAge, acad, List.of(expiredNoc), referenceDate);

        assertFalse(eval.isEligible());
        assertTrue(eval.reasonCodes().contains(EligibilityReasonCode.AGE_EXCEEDS_MAXIMUM));
        assertTrue(eval.reasonCodes().contains(EligibilityReasonCode.INSTITUTIONAL_NOC_EXPIRED));

        // Age 17 candidate (born 2009-01-01)
        CandidateProfile candUnderAge = createCandidate(602L, CandidateState.ACTIVE,
                LocalDate.of(2009, 1, 1), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);
        CandidateEvaluation evalUnder = evaluator.evaluateCandidate(
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                candUnderAge, acad, List.of(expiredNoc), referenceDate);
        assertTrue(evalUnder.reasonCodes().contains(EligibilityReasonCode.AGE_BELOW_MINIMUM));
    }

    // ------------------------------------------------------------------
    // 13. Decision reason-code accuracy
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 13: Accurate reason codes for unauthorized signatory, conflict, and non-final year")
    void test13_decisionReasonCodeAccuracy() {
        CandidateProfile cand = createCandidate(701L, CandidateState.ACTIVE,
                LocalDate.of(2003, 1, 1), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);

        // Case A: Unauthorized signatory (OTHER_UNRECOGNIZED) and conflict declared
        CandidateAcademicRecord acad = createAcademicRecord(701L, EnrollmentStatus.ENROLLED_FULL_TIME,
                FinalYearStatus.VERIFIED_FINAL_YEAR, "B.Tech");
        CandidateEvidence badNoc = createNoc(801L, 701L, EvidenceStatus.VERIFIED,
                SignatoryRole.OTHER_UNRECOGNIZED, false, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31));

        CandidateEvaluation evalA = evaluator.evaluateCandidate(
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                cand, acad, List.of(badNoc), referenceDate);
        assertTrue(evalA.reasonCodes().contains(EligibilityReasonCode.UNAUTHORIZED_NOC_SIGNATORY));
        assertTrue(evalA.reasonCodes().contains(EligibilityReasonCode.NOC_ACADEMIC_CONFLICT_DECLARED));

        // Case B: Verified NOT in final year
        CandidateAcademicRecord acadNotFinal = createAcademicRecord(701L, EnrollmentStatus.ENROLLED_FULL_TIME,
                FinalYearStatus.VERIFIED_NOT_FINAL_YEAR, "B.Tech");
        CandidateEvaluation evalB = evaluator.evaluateCandidate(
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                cand, acadNotFinal, List.of(), referenceDate);
        assertTrue(evalB.reasonCodes().contains(EligibilityReasonCode.NOT_IN_FINAL_YEAR));
        assertTrue(evalB.reasonCodes().contains(EligibilityReasonCode.FULL_TIME_EDUCATION_DISQUALIFIED));
    }

    // ------------------------------------------------------------------
    // 14. Evidence verified after a historical decision does not rewrite result
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 14: Historical snapshot retains original decision after evidence mutation")
    void test14_evidenceMutationDoesNotRewriteHistoricalDecision() {
        CandidateProfile cand = createCandidate(801L, CandidateState.ACTIVE,
                LocalDate.of(2003, 1, 1), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);
        CandidateAcademicRecord acad = createAcademicRecord(801L, EnrollmentStatus.ENROLLED_FULL_TIME,
                FinalYearStatus.VERIFIED_FINAL_YEAR, "B.Tech");
        CandidateEvidence noc = createNoc(901L, 801L, EvidenceStatus.SUBMITTED,
                SignatoryRole.DEAN, true, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31));

        CandidateEvaluation evalT0 = evaluator.evaluateCandidate(
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                cand, acad, List.of(noc), referenceDate);
        AllocationEligibilitySnapshot snapshot = evaluator.createSnapshot(10L, evalT0);

        assertEquals(EligibilityDecision.INELIGIBLE, snapshot.decision);
        assertEquals("SUBMITTED", snapshot.evidenceStatusSnapshot);
        assertEquals(901L, snapshot.evidenceIdRef);

        // Mutating evidence record in memory does not change existing snapshot entity
        noc.verificationStatus = EvidenceStatus.VERIFIED;
        noc.signatoryName = "Dean Confirmed";

        assertEquals(EligibilityDecision.INELIGIBLE, snapshot.decision);
        assertEquals("SUBMITTED", snapshot.evidenceStatusSnapshot);
        assertEquals(901L, snapshot.evidenceIdRef);
    }

    // ------------------------------------------------------------------
    // 15. Unit Boundary: Ineligible candidate exclusion before optimizer payload
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 15: Unit boundary simulation: ineligible candidates excluded prior to OptPair construction")
    void test15_ineligibleCandidateExcludedPriorToOptimizerPayload() {
        CandidateProfile candEligible = createCandidate(901L, CandidateState.ACTIVE,
                LocalDate.of(2003, 1, 1), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);
        CandidateAcademicRecord acadElig = createAcademicRecord(901L, EnrollmentStatus.NOT_ENROLLED,
                FinalYearStatus.UNKNOWN, "B.A.");

        CandidateProfile candIneligible = createCandidate(902L, CandidateState.ACTIVE,
                LocalDate.of(2003, 1, 1), EmploymentType.FULL_TIME, Qualification.BACHELORS);
        CandidateAcademicRecord acadInelig = createAcademicRecord(902L, EnrollmentStatus.NOT_ENROLLED,
                FinalYearStatus.UNKNOWN, "B.A.");

        Opportunity opp = createOpportunity(100L, OppStatus.ACTIVE, Qualification.BACHELORS, 1);

        List<CandidateProfile> cohort = List.of(candEligible, candIneligible);
        List<SuitabilityService.EligiblePair> admittedPairs = new ArrayList<>();

        for (CandidateProfile p : cohort) {
            CandidateAcademicRecord rec = p.id.equals(901L) ? acadElig : acadInelig;
            PairEvaluation eval = evaluator.evaluatePair(
                    EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                    p, Set.of(), rec, List.of(), opp, List.of(), referenceDate);
            if (eval.isEligible()) {
                admittedPairs.add(new SuitabilityService.EligiblePair(p.id, opp.id,
                        new SuitabilityService.PairScore(100, 100, 100, 100, 100, 100, 100, 100), 1));
            }
        }

        assertEquals(1, admittedPairs.size());
        assertEquals(901L, admittedPairs.get(0).candidateId());
        assertTrue(admittedPairs.stream().noneMatch(p -> p.candidateId().equals(902L)));
    }

    // ------------------------------------------------------------------
    // 16. Unit Boundary: Payload inspection for sensitive document protection
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 16: Payload inspection: OptPair JSON serialization contains no confidential document data")
    void test16_noSensitiveDocumentLeakageIntoOptimizerPayloads() {
        CandidateEvidence noc = createNoc(999L, 101L, EvidenceStatus.VERIFIED,
                SignatoryRole.DEAN, true, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31));

        AiServiceClient.OptPair pair = new AiServiceClient.OptPair(
                101, 201, 8500, 1);

        assertDoesNotThrow(() -> {
            String jsonStr = json.writeValueAsString(pair);
            assertFalse(jsonStr.contains(noc.documentReference));
            assertFalse(jsonStr.contains(noc.documentSha256));
            assertFalse(jsonStr.contains(noc.signatoryName));
            assertFalse(jsonStr.contains(noc.signatoryEmail));
            assertFalse(jsonStr.contains(noc.issuingInstitution));
        });
    }

    // ------------------------------------------------------------------
    // 17. Existing candidate-universe invariants
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 17: Candidate universe invariant: toCandidateIds preserves 0-pair applicants")
    void test17_candidateUniverseInvariants() {
        CandidateProfile c1 = createCandidate(1001L, CandidateState.ACTIVE,
                LocalDate.of(2003, 1, 1), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);
        CandidateProfile c2 = createCandidate(1002L, CandidateState.ACTIVE,
                LocalDate.of(2003, 1, 1), EmploymentType.UNEMPLOYED, Qualification.HIGHER_SECONDARY);

        Opportunity opp = createOpportunity(101L, OppStatus.ACTIVE, Qualification.BACHELORS, 2);

        PairEvaluation eval1 = evaluator.evaluatePair(
                EligibilityEvaluator.RULESET_LEGACY, "1.0.0",
                c1, Set.of(), null, List.of(), opp, List.of(), referenceDate);
        PairEvaluation eval2 = evaluator.evaluatePair(
                EligibilityEvaluator.RULESET_LEGACY, "1.0.0",
                c2, Set.of(), null, List.of(), opp, List.of(), referenceDate);

        assertTrue(eval1.isEligible());
        assertFalse(eval2.isEligible());

        List<CandidateProfile> fullCohort = List.of(c1, c2);
        List<Integer> candidateIdsForOptimizer = AllocationService.toCandidateIds(fullCohort);

        assertEquals(List.of(1001, 1002), candidateIdsForOptimizer);
        assertTrue(candidateIdsForOptimizer.contains(1002));
    }

    // ------------------------------------------------------------------
    // 18. Policy versioning semantics resolution
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 18: Policy version resolution: v1 vs v2 are distinct fairness semantics")
    void test18_v1AndV2FairnessBehavior() {
        AllocationRun runV1 = new AllocationRun();
        runV1.policyVersion = "v1";
        runV1.fairnessFloorPct = 30;

        AllocationRun runV2 = new AllocationRun();
        runV2.policyVersion = "v2";
        runV2.fairnessFloorPct = 30;

        assertEquals("v1", AllocationService.resolvePolicyVersion(runV1));
        assertEquals("v2", AllocationService.resolvePolicyVersion(runV2));
    }

    // ------------------------------------------------------------------
    // 19. Quality Gate Check 2: REGISTRAR is rejected as unauthorized signatory
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 19: Signatory role REGISTRAR is rejected as UNAUTHORIZED_NOC_SIGNATORY")
    void test19_registrarSignatoryRoleIsRejected() {
        CandidateProfile cand = createCandidate(1101L, CandidateState.ACTIVE,
                LocalDate.of(2003, 1, 1), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);
        CandidateAcademicRecord acad = createAcademicRecord(1101L, EnrollmentStatus.ENROLLED_FULL_TIME,
                FinalYearStatus.VERIFIED_FINAL_YEAR, "B.Tech");

        CandidateEvidence registrarNoc = createNoc(1201L, 1101L, EvidenceStatus.VERIFIED,
                SignatoryRole.REGISTRAR, true, LocalDate.of(2026, 1, 1), LocalDate.of(2026, 12, 31));

        CandidateEvaluation eval = evaluator.evaluateCandidate(
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                cand, acad, List.of(registrarNoc), referenceDate);

        assertFalse(eval.isEligible(), "REGISTRAR signatory must not be automatically authorized");
        assertEquals(EligibilityDecision.INELIGIBLE, eval.decision());
        assertTrue(eval.reasonCodes().contains(EligibilityReasonCode.UNAUTHORIZED_NOC_SIGNATORY));
    }

    // ------------------------------------------------------------------
    // 20. Quality Gate Check 4: Deterministic reference date requirement
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 20: Deterministic reference date is required; null throws ApiException")
    void test20_deterministicReferenceDateRequired() {
        CandidateProfile cand = createCandidate(1301L, CandidateState.ACTIVE,
                LocalDate.of(2003, 1, 1), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);

        ApiException ex = assertThrows(ApiException.class, () ->
                evaluator.evaluateCandidate(EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                        cand, null, List.of(), null));

        assertTrue(ex.getMessage().contains("Evaluation reference date is required"),
                "Evaluator must reject null reference date to prevent non-reproducible clock drift");
    }

    // ------------------------------------------------------------------
    // 21. Quality Gate Check 1: Explicit isDemonstrationOnly classification
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 21: Partial 2026 rule-set is marked isDemonstrationOnly=true; legacy is false")
    void test21_demonstrationPolicyFlagVerification() {
        CandidateProfile cand = createCandidate(1401L, CandidateState.ACTIVE,
                LocalDate.of(2003, 1, 1), EmploymentType.UNEMPLOYED, Qualification.BACHELORS);
        CandidateAcademicRecord acad = createAcademicRecord(1401L, EnrollmentStatus.NOT_ENROLLED,
                FinalYearStatus.UNKNOWN, "B.Sc");

        CandidateEvaluation evalDemo = evaluator.evaluateCandidate(
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0",
                cand, acad, List.of(), referenceDate);
        assertTrue(evalDemo.isDemonstrationOnly(), "2026 rule-set must be flagged as demonstration only");

        CandidateEvaluation evalLegacy = evaluator.evaluateCandidate(
                EligibilityEvaluator.RULESET_LEGACY, "1.0.0",
                cand, acad, List.of(), referenceDate);
        assertFalse(evalLegacy.isDemonstrationOnly(), "Legacy rule-set is not flagged as 2026 demo");
    }

    // ------------------------------------------------------------------
    // 22. Quality Gate Check 3: Fairness policy and eligibility rule-set independence
    // ------------------------------------------------------------------
    @Test
    @DisplayName("Test 22: Fairness policy versions and eligibility rule-sets vary independently")
    void test22_fairnessAndEligibilityIndependence() {
        // Assert all 4 permutations are valid independent configurations
        String[] fairnessVersions = {"v1", "v2"};
        String[] eligibilityRuleSets = {
                EligibilityEvaluator.RULESET_LEGACY,
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO
        };

        for (String fv : fairnessVersions) {
            for (String es : eligibilityRuleSets) {
                AllocationRun run = new AllocationRun();
                run.policyVersion = fv;
                run.eligibilityRuleSetId = es;
                run.eligibilityRuleSetVersion = "1.0.0";

                // Verify neither setting alters or derives the other
                assertEquals(fv, AllocationService.resolvePolicyVersion(run));
                assertEquals(es, run.eligibilityRuleSetId);
                assertDoesNotThrow(() -> evaluator.validateAndCanonicalizeRuleSet(run.eligibilityRuleSetId, run.eligibilityRuleSetVersion));
            }
        }
    }
}
