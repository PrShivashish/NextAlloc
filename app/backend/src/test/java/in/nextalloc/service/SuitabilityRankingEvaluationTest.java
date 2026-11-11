package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import in.nextalloc.common.Weights;
import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.CandidateRelatedSkill;
import in.nextalloc.domain.Opportunity;
import in.nextalloc.domain.OpportunitySkill;
import in.nextalloc.domain.enums.CandidateState;
import in.nextalloc.domain.enums.CandidateStatus;
import in.nextalloc.domain.enums.OppStatus;
import in.nextalloc.domain.enums.Qualification;
import in.nextalloc.domain.enums.Sector;
import in.nextalloc.domain.enums.SkillClaimSource;
import in.nextalloc.domain.enums.SkillEvidenceStatus;

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

    private CandidateRelatedSkill createRelatedSkill(Long candId, String rawLabel, String conceptId,
                                                    String relatedCanonical, String relType) {
        CandidateRelatedSkill r = new CandidateRelatedSkill();
        r.candidateId = candId;
        r.rawLabel = rawLabel;
        r.conceptId = conceptId;
        r.relatedCanonical = relatedCanonical;
        r.relationshipType = relType;
        r.taxonomyVersion = "v1.0";
        r.claimSource = SkillClaimSource.SELF_DECLARED;
        r.evidenceStatus = SkillEvidenceStatus.UNVERIFIED;
        return r;
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

    @Test
    void testExperimentalSoftSuitabilityDisabledByDefault() {
        Opportunity opp = createOpportunity(Sector.SOFTWARE_IT, Qualification.BACHELORS, "Delhi");
        List<OpportunitySkill> reqs = List.of(
                createSkill("Java", true),
                createSkill("DevOps", false)
        );

        CandidateProfile cand = createCandidate(Qualification.BACHELORS, "Delhi", CandidateState.ACTIVE, 1.0);
        cand.id = 101L;
        Set<String> skills = Set.of("Java");
        List<CandidateRelatedSkill> related = List.of(
                createRelatedSkill(101L, "Kubernetes", "CONCEPT-REL-KUBERNETES", "DevOps", "TOOL")
        );

        Weights w = Weights.defaultBalanced();
        // With experimental mode disabled (default svc)
        SuitabilityService.PairScore baselineScore = svc.score(cand, skills, related, Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, w);
        assertEquals(75.0, baselineScore.skills(), "Disabled experimental mode must not give bonus for related skills");
    }

    @Test
    void testExperimentalSoftSuitabilityPreservesExactMatchDominance() {
        Opportunity opp = createOpportunity(Sector.SOFTWARE_IT, Qualification.BACHELORS, "Delhi");
        List<OpportunitySkill> reqs = List.of(
                createSkill("Java", true),
                createSkill("DevOps", false)
        );

        // Candidate A: has exact canonical DevOps
        CandidateProfile candA = createCandidate(Qualification.BACHELORS, "Delhi", CandidateState.ACTIVE, 1.0);
        candA.id = 201L;
        Set<String> skillsA = Set.of("Java", "DevOps");

        // Candidate B: has Java and related tool Kubernetes for DevOps
        CandidateProfile candB = createCandidate(Qualification.BACHELORS, "Delhi", CandidateState.ACTIVE, 1.0);
        candB.id = 202L;
        Set<String> skillsB = Set.of("Java");
        List<CandidateRelatedSkill> relB = List.of(
                createRelatedSkill(202L, "Kubernetes", "CONCEPT-REL-KUBERNETES", "DevOps", "TOOL")
        );

        // Candidate C: has Java only, no DevOps and no related tools
        CandidateProfile candC = createCandidate(Qualification.BACHELORS, "Delhi", CandidateState.ACTIVE, 1.0);
        candC.id = 203L;
        Set<String> skillsC = Set.of("Java");

        Weights w = Weights.defaultBalanced();
        SuitabilityService.PairScore scoreA = svc.score(candA, skillsA, List.of(), Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, w, true);
        SuitabilityService.PairScore scoreB = svc.score(candB, skillsB, relB, Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, w, true);
        SuitabilityService.PairScore scoreC = svc.score(candC, skillsC, List.of(), Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, w, true);

        // Exact match (100.0) > Related match (81.3) > Zero match (75.0)
        assertEquals(100.0, scoreA.skills(), "Exact match must receive 100.0 skills fit");
        assertEquals(81.3, scoreB.skills(), "Tool relation (0.25) on 1 nice skill must yield 75 + 25*0.25 = 81.25 -> 81.3");
        assertEquals(75.0, scoreC.skills(), "Zero match must yield 75.0 skills fit");

        assertTrue(scoreA.skills() > scoreB.skills(), "Exact match must strictly dominate related tool match");
        assertTrue(scoreB.skills() > scoreC.skills(), "Related tool match must strictly dominate zero match");
        assertTrue(scoreA.overall() > scoreB.overall(), "Overall score of exact match must strictly exceed related tool");
        assertTrue(scoreB.overall() > scoreC.overall(), "Overall score of related tool must strictly exceed zero match");
    }

    @Test
    void testRelationshipHierarchyWeights() {
        Opportunity opp = createOpportunity(Sector.SOFTWARE_IT, Qualification.BACHELORS, "Delhi");
        List<OpportunitySkill> reqs = List.of(
                createSkill("Python", true),
                createSkill("Web Development", false)
        );

        CandidateProfile cand = createCandidate(Qualification.BACHELORS, "Delhi", CandidateState.ACTIVE, 1.0);
        cand.id = 301L;
        Set<String> skills = Set.of("Python");

        // Framework relation (FastAPI -> Python, or React -> Web Development, weight 0.50)
        List<CandidateRelatedSkill> fwRel = List.of(
                createRelatedSkill(301L, "React", "CONCEPT-REL-REACT", "Web Development", "FRAMEWORK")
        );
        // Superset relation (TypeScript -> Web Development / JavaScript, weight 0.40)
        List<CandidateRelatedSkill> supersetRel = List.of(
                createRelatedSkill(301L, "TypeScript", "CONCEPT-REL-TS", "Web Development", "LANGUAGE_SUPERSET")
        );
        // Tool relation (Docker -> Web Development / DevOps, weight 0.25)
        List<CandidateRelatedSkill> toolRel = List.of(
                createRelatedSkill(301L, "Docker", "CONCEPT-REL-DOCKER", "Web Development", "TOOL")
        );

        Weights w = Weights.defaultBalanced();
        double scoreFw = svc.score(cand, skills, fwRel, Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, w, true).skills();
        double scoreSuperset = svc.score(cand, skills, supersetRel, Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, w, true).skills();
        double scoreTool = svc.score(cand, skills, toolRel, Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, w, true).skills();

        assertEquals(87.5, scoreFw, "Framework weight (0.50) yields 75 + 25*0.5 = 87.5");
        assertEquals(85.0, scoreSuperset, "Superset weight (0.40) yields 75 + 25*0.4 = 85.0");
        assertEquals(81.3, scoreTool, "Tool weight (0.25) yields 75 + 25*0.25 = 81.25 -> 81.3");

        assertTrue(scoreFw > scoreSuperset);
        assertTrue(scoreSuperset > scoreTool);
    }

    @Test
    void testMandatorySkillGateRemainsStrictEvenWithExperimentalEnabled() {
        Opportunity opp = createOpportunity(Sector.SOFTWARE_IT, Qualification.BACHELORS, "Delhi");
        List<OpportunitySkill> reqs = List.of(
                createSkill("Java", true), // MANDATORY
                createSkill("Spring Boot", false)
        );

        // Candidate has NO Java canonical skill, only Spring Boot as related skill
        CandidateProfile cand = createCandidate(Qualification.BACHELORS, "Delhi", CandidateState.ACTIVE, 1.0);
        cand.id = 401L;
        Set<String> skills = Set.of(); // lacks Java
        List<CandidateRelatedSkill> rel = List.of(
                createRelatedSkill(401L, "Spring Boot", "CONCEPT-REL-SPRING_BOOT", "Java", "FRAMEWORK")
        );

        // Gate check MUST FAIL: mandatory skill Java is missing
        SuitabilityService.EligibilityResult res = svc.check(cand, skills, opp, reqs);
        assertFalse(res.eligible(), "Candidate lacking mandatory Java must be ineligible despite having Spring Boot");
        assertTrue(res.reasons().stream().anyMatch(r -> r.contains("Required Java skill is missing")));
    }

    @Test
    void testNDCGRankingComparisonOnMultiCandidateBenchmark() {
        // Multi-candidate benchmark evaluating ranking resolution with and without experimental soft suitability
        Opportunity opp = createOpportunity(Sector.SOFTWARE_IT, Qualification.BACHELORS, "Delhi");
        List<OpportunitySkill> reqs = List.of(
                createSkill("Python", true),
                createSkill("Web Development", false),
                createSkill("DevOps", false)
        );

        // Cand 1: Exact match for both optional skills (Python + Web Development + DevOps)
        CandidateProfile c1 = createCandidate(Qualification.BACHELORS, "Delhi", CandidateState.ACTIVE, 1.0);
        c1.id = 501L;
        Set<String> s1 = Set.of("Python", "Web Development", "DevOps");

        // Cand 2: Python + Framework related to Web Development (React)
        CandidateProfile c2 = createCandidate(Qualification.BACHELORS, "Delhi", CandidateState.ACTIVE, 1.0);
        c2.id = 502L;
        Set<String> s2 = Set.of("Python");
        List<CandidateRelatedSkill> r2 = List.of(createRelatedSkill(502L, "React", "CONCEPT-REACT", "Web Development", "FRAMEWORK"));

        // Cand 3: Python + Tool related to DevOps (Docker)
        CandidateProfile c3 = createCandidate(Qualification.BACHELORS, "Delhi", CandidateState.ACTIVE, 1.0);
        c3.id = 503L;
        Set<String> s3 = Set.of("Python");
        List<CandidateRelatedSkill> r3 = List.of(createRelatedSkill(503L, "Docker", "CONCEPT-DOCKER", "DevOps", "TOOL"));

        // Cand 4: Python only, no optional or related skills
        CandidateProfile c4 = createCandidate(Qualification.BACHELORS, "Delhi", CandidateState.ACTIVE, 1.0);
        c4.id = 504L;
        Set<String> s4 = Set.of("Python");

        Weights w = Weights.defaultBalanced();

        // Baseline scores: Cand 2, 3, 4 are tied at 75.0 skills fit
        double baseFit1 = svc.score(c1, s1, List.of(), Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, w, false).skills();
        double baseFit2 = svc.score(c2, s2, r2, Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, w, false).skills();
        double baseFit3 = svc.score(c3, s3, r3, Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, w, false).skills();
        double baseFit4 = svc.score(c4, s4, List.of(), Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, w, false).skills();

        assertEquals(100.0, baseFit1);
        assertEquals(75.0, baseFit2, "In baseline, related framework gets 75.0");
        assertEquals(75.0, baseFit3, "In baseline, related tool gets 75.0");
        assertEquals(75.0, baseFit4, "In baseline, zero match gets 75.0");

        // Experimental scores: Clear discrimination: C1 (100.0) > C2 (81.3: 75 + 25*(0.5/2)) > C3 (78.1: 75 + 25*(0.25/2)) > C4 (75.0)
        double expFit1 = svc.score(c1, s1, List.of(), Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, w, true).skills();
        double expFit2 = svc.score(c2, s2, r2, Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, w, true).skills();
        double expFit3 = svc.score(c3, s3, r3, Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, w, true).skills();
        double expFit4 = svc.score(c4, s4, List.of(), Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, w, true).skills();

        assertEquals(100.0, expFit1);
        assertEquals(81.3, expFit2, "React framework contributes 0.50/2 = 0.25 to optional fit -> 81.3");
        assertEquals(78.1, expFit3, "Docker tool contributes 0.25/2 = 0.125 to optional fit -> 78.1");
        assertEquals(75.0, expFit4, "Zero match remains 75.0");

        assertTrue(expFit1 > expFit2);
        assertTrue(expFit2 > expFit3);
        assertTrue(expFit3 > expFit4);
    }
}
