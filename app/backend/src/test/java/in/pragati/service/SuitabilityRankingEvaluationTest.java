package in.pragati.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import in.pragati.common.Weights;
import in.pragati.domain.CandidateProfile;
import in.pragati.domain.Opportunity;
import in.pragati.domain.OpportunitySkill;
import in.pragati.domain.enums.CandidateState;
import in.pragati.domain.enums.CandidateStatus;
import in.pragati.domain.enums.OppStatus;
import in.pragati.domain.enums.Qualification;
import in.pragati.domain.enums.Sector;

/**
 * Phase 4B-2A: Candidate-Internship Ranking & Matching Evaluation Test Harness.
 * Validates real Java SuitabilityService and Eligibility gates against offline multi-sector benchmark cases.
 */
class SuitabilityRankingEvaluationTest {

    private final SuitabilityService svc = new SuitabilityService();

    private CandidateProfile createCandidate(Qualification qual, String state, CandidateState candState, double expYears) {
        CandidateProfile p = new CandidateProfile();
        p.qualification = qual;
        p.state = state;
        p.candidateState = candState;
        p.candidateStatus = CandidateStatus.STUDENT;
        p.experienceYears = expYears;
        return p;
    }

    private Opportunity createOpportunity(Sector sector, Qualification minQual, String state) {
        Opportunity o = new Opportunity();
        o.sector = sector;
        o.minQualification = minQual;
        o.state = state;
        o.status = OppStatus.ACTIVE;
        return o;
    }

    private OpportunitySkill createSkill(String name, boolean mandatory) {
        OpportunitySkill s = new OpportunitySkill();
        s.skill = name;
        s.mandatory = mandatory;
        return s;
    }

    @Test
    void testMandatorySkillGateDisallowsRelatedToolCoercion() {
        // CAND-03: Has PyTorch and TensorFlow, but lacks mandatory Python
        CandidateProfile cand = createCandidate(Qualification.POST_GRADUATE, "Delhi", CandidateState.ACTIVE, 1.5);
        Set<String> declaredSkills = Set.of("Machine Learning"); // PyTorch was unmapped/related tool

        Opportunity opp = createOpportunity(Sector.DATA_ANALYTICS, Qualification.POST_GRADUATE, "Delhi");
        List<OpportunitySkill> reqs = List.of(
                createSkill("Python", true),
                createSkill("Machine Learning", true),
                createSkill("Deep Learning", false)
        );

        SuitabilityService.EligibilityResult res = svc.check(cand, declaredSkills, opp, reqs);
        assertFalse(res.eligible(), "Candidate possessing only related tools must NOT pass mandatory Python check");
        assertTrue(res.reasons().stream().anyMatch(r -> r.contains("Required Python skill is missing")));
    }

    @Test
    void testHardEligibilityRejectsWithdrawnCandidateDespiteFullSkillMatch() {
        // CAND-07: Has 100% skills for ML opportunity, but participation is withdrawn
        CandidateProfile cand = createCandidate(Qualification.POST_GRADUATE, "Delhi", CandidateState.WITHDRAWN, 2.0);
        Set<String> declaredSkills = Set.of("Python", "Machine Learning", "Deep Learning", "Statistics");

        Opportunity opp = createOpportunity(Sector.DATA_ANALYTICS, Qualification.POST_GRADUATE, "Delhi");
        List<OpportunitySkill> reqs = List.of(
                createSkill("Python", true),
                createSkill("Machine Learning", true),
                createSkill("Deep Learning", false)
        );

        SuitabilityService.EligibilityResult res = svc.check(cand, declaredSkills, opp, reqs);
        assertFalse(res.eligible(), "Withdrawn candidate must be strictly rejected regardless of skill match");
        assertTrue(res.reasons().stream().anyMatch(r -> r.contains("withdrawn")));
    }

    @Test
    void testHardEligibilityRejectsQualificationRankDeficit() {
        // CAND-08: Has skills, but Higher Secondary applying to Post-Graduate opportunity
        CandidateProfile cand = createCandidate(Qualification.HIGHER_SECONDARY, "Delhi", CandidateState.ACTIVE, 0.0);
        Set<String> declaredSkills = Set.of("Python", "Machine Learning");

        Opportunity opp = createOpportunity(Sector.DATA_ANALYTICS, Qualification.POST_GRADUATE, "Delhi");
        List<OpportunitySkill> reqs = List.of(createSkill("Python", true), createSkill("Machine Learning", true));

        SuitabilityService.EligibilityResult res = svc.check(cand, declaredSkills, opp, reqs);
        assertFalse(res.eligible(), "Candidate below minimum qualification rank must fail hard eligibility");
        assertTrue(res.reasons().stream().anyMatch(r -> r.contains("Qualification below the required level")));
    }

    @Test
    void testRankingStabilityAndZeroIneligibleLeakage() {
        // Evaluates ranking between fully eligible candidate (CAND-01), tool-deficient candidate (CAND-03), and missing mandatory (CAND-06)
        Opportunity opp = createOpportunity(Sector.SOFTWARE_IT, Qualification.BACHELORS, "Delhi");
        List<OpportunitySkill> reqs = List.of(
                createSkill("Python", true),
                createSkill("Cloud Computing", false),
                createSkill("DevOps", false)
        );

        CandidateProfile cand01 = createCandidate(Qualification.BACHELORS, "Delhi", CandidateState.ACTIVE, 1.0);
        Set<String> skills01 = Set.of("Python", "Cloud Computing", "DevOps");

        CandidateProfile cand04 = createCandidate(Qualification.BACHELORS, "Karnataka", CandidateState.ACTIVE, 1.0);
        Set<String> skills04 = Set.of("Python"); // Has k8s/ci-cd as related tools, but only Python canonical

        CandidateProfile cand06 = createCandidate(Qualification.BACHELORS, "Delhi", CandidateState.ACTIVE, 2.0);
        Set<String> skills06 = Set.of("Cloud Computing", "DevOps"); // Missing Python

        // Check eligibility
        SuitabilityService.EligibilityResult res01 = svc.check(cand01, skills01, opp, reqs);
        SuitabilityService.EligibilityResult res04 = svc.check(cand04, skills04, opp, reqs);
        SuitabilityService.EligibilityResult res06 = svc.check(cand06, skills06, opp, reqs);

        assertTrue(res01.eligible());
        assertTrue(res04.eligible());
        assertFalse(res06.eligible(), "CAND-06 missing mandatory Python must be ineligible");

        // Score eligible candidates
        Weights w = Weights.defaultBalanced();
        SuitabilityService.PairScore score01 = svc.score(cand01, skills01, Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, w);
        SuitabilityService.PairScore score04 = svc.score(cand04, skills04, Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, w);

        // CAND-01 has all preferred skills (Cloud + DevOps) -> skillsFit = 100.0, location = 100.0
        // CAND-04 has 0 preferred skills -> skillsFit = 75.0, location = 40.0
        assertTrue(score01.overall() > score04.overall(),
                "Candidate with full preferred skill match must rank strictly higher than candidate lacking preferred skills");
        assertEquals(100.0, score01.skills());
        assertEquals(75.0, score04.skills());
    }
}
