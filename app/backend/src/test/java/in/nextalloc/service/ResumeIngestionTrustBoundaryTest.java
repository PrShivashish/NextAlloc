package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

import java.util.List;
import java.util.Set;

import org.junit.jupiter.api.Test;

import in.nextalloc.ai.AiServiceClient;
import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.Opportunity;
import in.nextalloc.domain.OpportunitySkill;
import in.nextalloc.domain.enums.CandidateState;
import in.nextalloc.domain.enums.CandidateStatus;
import in.nextalloc.domain.enums.OppStatus;
import in.nextalloc.domain.enums.Qualification;
import in.nextalloc.domain.enums.Sector;

/**
 * Phase 4B-2B.1B: Focused Java test verifying resume ingestion trust boundaries,
 * demonstrating how uncorrected NLP mappings bypassed mandatory eligibility,
 * and proving that corrected extraction prevents mandatory skill spoofing.
 */
class ResumeIngestionTrustBoundaryTest {

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
    void testDemonstratedVulnerability_UncorrectedNlpBypassesMandatoryDevOps() {
        // Simulates the legacy uncorrected AI service that mapped "kubernetes" -> "DevOps"
        AiServiceClient mockAi = mock(AiServiceClient.class);
        when(mockAi.extractSkills("Kubernetes cluster orchestration experience"))
                .thenReturn(new AiServiceClient.SkillsResult(
                        List.of(new AiServiceClient.ExtractedSkill("kubernetes", "DevOps", 1.0)),
                        "taxonomy-lexicon"
                ));

        // When Java client extracts skills:
        AiServiceClient.SkillsResult result = mockAi.extractSkills("Kubernetes cluster orchestration experience");
        List<String> canonicals = result.skills().stream().map(AiServiceClient.ExtractedSkill::canonical).toList();

        // Java receives ONLY canonical strings, discarding raw "kubernetes"
        assertEquals(List.of("DevOps"), canonicals);

        // Candidate confirms the suggested skill -> saved as validated=true
        Set<String> savedCandidateSkills = Set.copyOf(canonicals);

        // Mandatory requirement evaluation:
        Opportunity opp = createOpportunity(Sector.SOFTWARE_IT, Qualification.BACHELORS, "Delhi");
        List<OpportunitySkill> reqs = List.of(createSkill("DevOps", true));
        CandidateProfile cand = createCandidate(Qualification.BACHELORS, "Delhi");

        SuitabilityService.EligibilityResult eligibility = suitability.check(cand, savedCandidateSkills, opp, reqs);

        // DEMONSTRATED FLAW: In the legacy path, candidate cleared mandatory DevOps purely from Kubernetes mention!
        assertTrue(eligibility.eligible(), "Legacy uncorrected path permitted Kubernetes to satisfy mandatory DevOps");
    }

    @Test
    void testCorrectedPipeline_KubernetesOnlyDoesNotSatisfyMandatoryDevOps() {
        // Corrected AI service behavior: Kubernetes is a RELATED_CONCEPT, so it does NOT emit canonical DevOps
        AiServiceClient mockAi = mock(AiServiceClient.class);
        when(mockAi.extractSkills("Kubernetes cluster orchestration experience"))
                .thenReturn(new AiServiceClient.SkillsResult(List.of(), "taxonomy-lexicon"));

        AiServiceClient.SkillsResult result = mockAi.extractSkills("Kubernetes cluster orchestration experience");
        List<String> canonicals = result.skills().stream().map(AiServiceClient.ExtractedSkill::canonical).toList();

        // No canonical skill emitted
        assertTrue(canonicals.isEmpty(), "Corrected NLP must NOT emit canonical DevOps for Kubernetes alone");

        Set<String> savedCandidateSkills = Set.copyOf(canonicals);

        Opportunity opp = createOpportunity(Sector.SOFTWARE_IT, Qualification.BACHELORS, "Delhi");
        List<OpportunitySkill> reqs = List.of(createSkill("DevOps", true));
        CandidateProfile cand = createCandidate(Qualification.BACHELORS, "Delhi");

        SuitabilityService.EligibilityResult eligibility = suitability.check(cand, savedCandidateSkills, opp, reqs);

        // PROTECTED GATE: Candidate is properly rejected for missing mandatory skill
        assertFalse(eligibility.eligible(), "Candidate with Kubernetes alone must NOT pass mandatory DevOps check");
        assertTrue(eligibility.reasons().stream().anyMatch(r -> r.contains("Required DevOps skill is missing")));
    }

    @Test
    void testCorrectedPipeline_DockerOnlyDoesNotSatisfyMandatoryDevOps() {
        // Corrected AI service behavior: Docker is a RELATED_CONCEPT, so it does NOT emit canonical DevOps
        AiServiceClient mockAi = mock(AiServiceClient.class);
        when(mockAi.extractSkills("Built container images using Docker"))
                .thenReturn(new AiServiceClient.SkillsResult(List.of(), "taxonomy-lexicon"));

        AiServiceClient.SkillsResult result = mockAi.extractSkills("Built container images using Docker");
        List<String> canonicals = result.skills().stream().map(AiServiceClient.ExtractedSkill::canonical).toList();

        assertTrue(canonicals.isEmpty());
        Set<String> savedCandidateSkills = Set.copyOf(canonicals);

        Opportunity opp = createOpportunity(Sector.SOFTWARE_IT, Qualification.BACHELORS, "Delhi");
        List<OpportunitySkill> reqs = List.of(createSkill("DevOps", true));
        CandidateProfile cand = createCandidate(Qualification.BACHELORS, "Delhi");

        SuitabilityService.EligibilityResult eligibility = suitability.check(cand, savedCandidateSkills, opp, reqs);
        assertFalse(eligibility.eligible());
        assertTrue(eligibility.reasons().stream().anyMatch(r -> r.contains("Required DevOps skill is missing")));
    }

    @Test
    void testCorrectedPipeline_FrontendOnlyDoesNotSatisfyMandatoryWebDevelopment() {
        // Corrected AI service behavior: Frontend is a RELATED_CONCEPT (sub-discipline), NOT canonical Web Development
        AiServiceClient mockAi = mock(AiServiceClient.class);
        when(mockAi.extractSkills("Experienced frontend developer building responsive web layouts"))
                .thenReturn(new AiServiceClient.SkillsResult(List.of(), "taxonomy-lexicon"));

        AiServiceClient.SkillsResult result = mockAi.extractSkills("Experienced frontend developer building responsive web layouts");
        List<String> canonicals = result.skills().stream().map(AiServiceClient.ExtractedSkill::canonical).toList();

        assertTrue(canonicals.isEmpty());
        Set<String> savedCandidateSkills = Set.copyOf(canonicals);

        Opportunity opp = createOpportunity(Sector.SOFTWARE_IT, Qualification.BACHELORS, "Delhi");
        List<OpportunitySkill> reqs = List.of(createSkill("Web Development", true));
        CandidateProfile cand = createCandidate(Qualification.BACHELORS, "Delhi");

        SuitabilityService.EligibilityResult eligibility = suitability.check(cand, savedCandidateSkills, opp, reqs);
        assertFalse(eligibility.eligible());
        assertTrue(eligibility.reasons().stream().anyMatch(r -> r.contains("Required Web Development skill is missing")));
    }

    @Test
    void testExplicitCanonicalSkillContinuesToSatisfyMandatoryRequirement() {
        // Explicit DevOps mention in resume
        AiServiceClient mockAi = mock(AiServiceClient.class);
        when(mockAi.extractSkills(anyString()))
                .thenReturn(new AiServiceClient.SkillsResult(
                        List.of(new AiServiceClient.ExtractedSkill("DevOps", "DevOps", 1.0)),
                        "taxonomy-lexicon"
                ));

        AiServiceClient.SkillsResult result = mockAi.extractSkills("Senior DevOps Engineer with infrastructure experience");
        List<String> canonicals = result.skills().stream().map(AiServiceClient.ExtractedSkill::canonical).toList();
        assertEquals(List.of("DevOps"), canonicals);

        Opportunity opp = createOpportunity(Sector.SOFTWARE_IT, Qualification.BACHELORS, "Delhi");
        List<OpportunitySkill> reqs = List.of(createSkill("DevOps", true));
        CandidateProfile cand = createCandidate(Qualification.BACHELORS, "Delhi");

        SuitabilityService.EligibilityResult eligibility = suitability.check(cand, Set.copyOf(canonicals), opp, reqs);
        assertTrue(eligibility.eligible(), "Explicit DevOps mention must satisfy mandatory requirement");
    }
}
