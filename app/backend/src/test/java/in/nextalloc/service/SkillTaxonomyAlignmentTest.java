package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;

import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import in.nextalloc.common.Weights;
import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.Opportunity;
import in.nextalloc.domain.OpportunitySkill;
import in.nextalloc.domain.enums.CandidateState;
import in.nextalloc.domain.enums.CandidateStatus;
import in.nextalloc.domain.enums.OppStatus;
import in.nextalloc.domain.enums.Qualification;
import in.nextalloc.domain.enums.Sector;

/**
 * Phase 4B-2B.1: Focused Java taxonomy safety and hard-eligibility regression test suite.
 * Validates approved exact alias alignment, removal of unsafe canonical coercions,
 * and strict eligibility protection.
 */
class SkillTaxonomyAlignmentTest {

    private final SuitabilityService suitability = new SuitabilityService();

    private CandidateProfile createCandidate(Qualification qual, String state) {
        CandidateProfile p = new CandidateProfile();
        p.qualification = qual;
        p.state = state;
        p.candidateState = CandidateState.ACTIVE;
        p.candidateStatus = CandidateStatus.STUDENT;
        p.experienceYears = 1.0;
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
    void testApprovedExactAliasesCanonicalizeCorrectly() {
        // UI/UX Design variants
        assertEquals("UI/UX Design", SkillTaxonomy.normalize("ui/ux"));
        assertEquals("UI/UX Design", SkillTaxonomy.normalize("ui ux"));
        assertEquals("UI/UX Design", SkillTaxonomy.normalize("ui-ux"));
        assertEquals("UI/UX Design", SkillTaxonomy.normalize("  UI/UX  "));

        // Excel variants
        assertEquals("Excel", SkillTaxonomy.normalize("microsoft excel"));
        assertEquals("Excel", SkillTaxonomy.normalize("ms-excel"));
        assertEquals("Excel", SkillTaxonomy.normalize("MS-Excel"));
        assertEquals("Excel", SkillTaxonomy.normalize("ms excel"));

        // Framework / runtime variants
        assertEquals("React", SkillTaxonomy.normalize("react js"));
        assertEquals("React", SkillTaxonomy.normalize("React JS"));
        assertEquals("Node.js", SkillTaxonomy.normalize("node-js"));
        assertEquals("Node.js", SkillTaxonomy.normalize("Node-JS"));

        // Power BI variant
        assertEquals("Power BI", SkillTaxonomy.normalize("power-bi"));
        assertEquals("Power BI", SkillTaxonomy.normalize("Power-BI"));
    }

    @Test
    void testUnsafeCoercionsRemovedAndReturnNull() {
        // Gate B: Specific unsafe coercions that must NOT coerce to DevOps
        assertNull(SkillTaxonomy.normalize("kubernetes"), "kubernetes alone must not normalize to DevOps");
        assertNull(SkillTaxonomy.normalize("docker"), "docker alone must not normalize to DevOps");
        assertNull(SkillTaxonomy.normalize("ci cd"), "ci cd alone must not normalize to DevOps");
        assertNull(SkillTaxonomy.normalize("ci/cd"), "ci/cd alone must not normalize to DevOps");
        assertNull(SkillTaxonomy.normalize("k8s"), "k8s alone must not normalize to DevOps");

        // Gate B: Frontend must NOT coerce to full Web Development
        assertNull(SkillTaxonomy.normalize("frontend"), "frontend alone must not normalize to Web Development");
        assertNull(SkillTaxonomy.normalize("front-end"), "front-end alone must not normalize to Web Development");
        assertNull(SkillTaxonomy.normalize("backend"), "backend alone must not normalize to Web Development");
        assertNull(SkillTaxonomy.normalize("back-end"), "back-end alone must not normalize to Web Development");

        // Disallowed broad substitutions
        assertNull(SkillTaxonomy.normalize("tally"), "tally software must not normalize to Accounting");
        assertNull(SkillTaxonomy.normalize("pytorch"), "pytorch must not normalize to Deep Learning");
        assertNull(SkillTaxonomy.normalize("tensorflow"), "tensorflow must not normalize to Deep Learning");
    }

    @Test
    void testKubernetesAndDockerAloneFailMandatoryDevOpsRequirement() {
        Opportunity opp = createOpportunity(Sector.SOFTWARE_IT, Qualification.BACHELORS, "Delhi");
        List<OpportunitySkill> reqs = List.of(createSkill("DevOps", true));

        // Candidate entering raw "kubernetes" or "docker" receives null from normalize()
        String normK8s = SkillTaxonomy.normalize("kubernetes");
        String normDocker = SkillTaxonomy.normalize("docker");
        assertNull(normK8s);
        assertNull(normDocker);

        // Candidate's resolved skill set contains no recognized DevOps skill
        CandidateProfile cand = createCandidate(Qualification.BACHELORS, "Delhi");
        Set<String> candidateSkills = Set.of(); // empty because raw inputs failed validation

        SuitabilityService.EligibilityResult res = suitability.check(cand, candidateSkills, opp, reqs);
        assertFalse(res.eligible(), "Candidate with only Kubernetes/Docker must NOT satisfy mandatory DevOps");
        assertTrue(res.reasons().stream().anyMatch(r -> r.contains("Required DevOps skill is missing")));
    }

    @Test
    void testFrontendAloneFailsMandatoryWebDevelopmentRequirement() {
        Opportunity opp = createOpportunity(Sector.SOFTWARE_IT, Qualification.BACHELORS, "Maharashtra");
        List<OpportunitySkill> reqs = List.of(createSkill("Web Development", true));

        String normFrontend = SkillTaxonomy.normalize("frontend");
        assertNull(normFrontend, "Frontend must not normalize to Web Development");

        CandidateProfile cand = createCandidate(Qualification.BACHELORS, "Maharashtra");
        Set<String> candidateSkills = Set.of(); // empty because frontend was rejected

        SuitabilityService.EligibilityResult res = suitability.check(cand, candidateSkills, opp, reqs);
        assertFalse(res.eligible(), "Candidate with only Frontend must NOT satisfy mandatory Web Development");
        assertTrue(res.reasons().stream().anyMatch(r -> r.contains("Required Web Development skill is missing")));
    }

    @Test
    void testApprovedExactAliasesSatisfyMandatoryRequirements() {
        // UI/UX Design mandatory
        Opportunity oppUi = createOpportunity(Sector.DESIGN_MEDIA, Qualification.BACHELORS, "Delhi");
        List<OpportunitySkill> reqsUi = List.of(createSkill("UI/UX Design", true));

        String normUi = SkillTaxonomy.normalize("ui/ux");
        assertNotNull(normUi);
        assertEquals("UI/UX Design", normUi);

        CandidateProfile candUi = createCandidate(Qualification.BACHELORS, "Delhi");
        SuitabilityService.EligibilityResult resUi = suitability.check(candUi, Set.of(normUi), oppUi, reqsUi);
        assertTrue(resUi.eligible(), "Approved alias 'ui/ux' must satisfy mandatory UI/UX Design");

        // Excel mandatory
        Opportunity oppExcel = createOpportunity(Sector.FINANCE_BANKING, Qualification.BACHELORS, "Maharashtra");
        List<OpportunitySkill> reqsExcel = List.of(createSkill("Excel", true));

        String normExcel = SkillTaxonomy.normalize("microsoft excel");
        assertNotNull(normExcel);
        assertEquals("Excel", normExcel);

        CandidateProfile candExcel = createCandidate(Qualification.BACHELORS, "Maharashtra");
        SuitabilityService.EligibilityResult resExcel = suitability.check(candExcel, Set.of(normExcel), oppExcel, reqsExcel);
        assertTrue(resExcel.eligible(), "Approved alias 'microsoft excel' must satisfy mandatory Excel");
    }

    @Test
    void testUnsupportedTermsFailSafely() {
        assertNull(SkillTaxonomy.normalize("quantum flux"));
        assertNull(SkillTaxonomy.normalize("piano"));
        assertNull(SkillTaxonomy.normalize("gardening"));
        assertNull(SkillTaxonomy.normalize("baking"));
        assertNull(SkillTaxonomy.normalize("welding"));
        assertNull(SkillTaxonomy.normalize(""));
        assertNull(SkillTaxonomy.normalize("   "));
        assertNull(SkillTaxonomy.normalize(null));
    }

    @Test
    void testLegacyPersistedCanonicalRecordsRemainReadableAndScoreAccurately() {
        // Existing records in candidate_skills store canonical values ("DevOps", "Web Development")
        Opportunity opp = createOpportunity(Sector.SOFTWARE_IT, Qualification.BACHELORS, "Delhi");
        List<OpportunitySkill> reqs = List.of(
                createSkill("DevOps", true),
                createSkill("React", false)
        );

        CandidateProfile cand = createCandidate(Qualification.BACHELORS, "Delhi");
        Set<String> legacySkills = Set.of("DevOps", "React");

        SuitabilityService.EligibilityResult res = suitability.check(cand, legacySkills, opp, reqs);
        assertTrue(res.eligible(), "Legacy candidate with persisted canonical 'DevOps' must remain eligible");

        SuitabilityService.PairScore score = suitability.score(
                cand, legacySkills, Set.of(Sector.SOFTWARE_IT), 1, opp, reqs, Weights.defaultBalanced()
        );
        assertEquals(100.0, score.skills(), "Candidate with full preferred match scores 100.0 on skills");
        assertTrue(score.overall() > 0.0);
    }
}
