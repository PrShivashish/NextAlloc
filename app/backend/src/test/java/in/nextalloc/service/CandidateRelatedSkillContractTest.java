package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;

import in.nextalloc.common.ApiException;
import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.CandidateRelatedSkill;
import in.nextalloc.domain.CandidateSkill;
import in.nextalloc.domain.Opportunity;
import in.nextalloc.domain.OpportunitySkill;
import in.nextalloc.domain.Provider;
import in.nextalloc.domain.ResumeFile;
import in.nextalloc.domain.enums.CandidateState;
import in.nextalloc.domain.enums.CandidateStatus;
import in.nextalloc.domain.enums.EligibilityDecision;
import in.nextalloc.domain.enums.EligibilityReasonCode;
import in.nextalloc.domain.enums.OppStatus;
import in.nextalloc.domain.enums.Qualification;
import in.nextalloc.domain.enums.Sector;
import in.nextalloc.domain.enums.SkillClaimSource;
import in.nextalloc.domain.enums.SkillEvidenceStatus;
import in.nextalloc.repo.CandidateProfileRepository;
import in.nextalloc.repo.CandidateRelatedSkillRepository;
import in.nextalloc.repo.CandidateSkillRepository;
import in.nextalloc.repo.OpportunityRepository;
import in.nextalloc.repo.OpportunitySkillRepository;
import in.nextalloc.repo.ProviderRepository;
import in.nextalloc.repo.ResumeFileRepository;
import in.nextalloc.security.AuthUser;
import in.nextalloc.service.CandidateService.ApplyInput;
import in.nextalloc.service.CandidateService.RelatedSkillItem;
import in.nextalloc.service.EligibilityEvaluator.PairEvaluation;
import in.nextalloc.service.ProviderService.OppInput;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Phase 4B-2B.3A: Candidate Related Skill Contract and Persistence Isolation Tests")
class CandidateRelatedSkillContractTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private in.nextalloc.security.JwtService jwtService;

    @Autowired
    private CandidateService candidateService;

    @Autowired
    private ProviderService providerService;

    @Autowired
    private CandidateProfileRepository profileRepository;

    @Autowired
    private CandidateSkillRepository skillRepository;

    @Autowired
    private CandidateRelatedSkillRepository relatedSkillRepository;

    @Autowired
    private OpportunityRepository opportunityRepository;

    @Autowired
    private OpportunitySkillRepository opportunitySkillRepository;

    @Autowired
    private ProviderRepository providerRepository;

    @Autowired
    private ResumeFileRepository resumeRepository;

    @Autowired
    private EligibilityEvaluator eligibilityEvaluator;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private Flyway flyway;

    @Autowired
    private ObjectMapper objectMapper;

    private static final java.util.concurrent.atomic.AtomicLong USER_SEQ = new java.util.concurrent.atomic.AtomicLong(9900000L);

    private AuthUser candidateUser;
    private CandidateProfile candidateProfile;
    private AuthUser providerUser;
    private Provider providerOrg;

    @BeforeEach
    void setUp() {
        long candUserId = USER_SEQ.incrementAndGet();
        candidateUser = new AuthUser(candUserId, "relcand" + candUserId + "@pragati.gov.in", "Related Candidate", "CANDIDATE");

        CandidateProfile p = new CandidateProfile();
        p.userId = candUserId;
        p.fullName = "Related Candidate";
        p.state = "Karnataka";
        p.qualification = Qualification.BACHELORS;
        p.candidateStatus = CandidateStatus.STUDENT;
        p.candidateState = CandidateState.ACTIVE;
        candidateProfile = profileRepository.save(p);

        long provUserId = USER_SEQ.incrementAndGet();
        providerUser = new AuthUser(provUserId, "relprov" + provUserId + "@pragati.gov.in", "Tech Provider", "PROVIDER");

        Provider prov = new Provider();
        prov.userId = provUserId;
        prov.orgName = "Enterprise Cloud Corp";
        prov.orgType = "CORPORATE";
        prov.state = "Karnataka";
        providerOrg = providerRepository.save(prov);
    }

    @Test
    @DisplayName("Test 1: V6 Migration Applied & Schema Integrity — candidate_related_skills table structure")
    void testV6FlywayMigrationAndSchemaIntegrity() {
        MigrationInfo[] history = flyway.info().applied();
        assertTrue(history.length >= 6, "Flyway schema history must have at least 6 migrations");

        MigrationInfo v6 = null;
        for (MigrationInfo info : history) {
            if ("6".equals(info.getVersion().getVersion())) {
                v6 = info;
                break;
            }
        }
        assertNotNull(v6, "V6 migration must be present in applied migrations");
        assertEquals("candidate related skills", v6.getDescription());
        assertTrue(v6.getState().isApplied(), "V6 migration must be in applied state");

        // Verify table existence and column definitions
        Integer columnCount = jdbcTemplate.queryForObject(
                "SELECT COUNT(*) FROM information_schema.columns WHERE UPPER(table_name) = 'CANDIDATE_RELATED_SKILLS'",
                Integer.class
        );
        assertNotNull(columnCount);
        assertTrue(columnCount >= 11, "candidate_related_skills must have at least 11 columns");

        // Verify key columns exist
        List<String> columns = jdbcTemplate.query(
                "SELECT column_name FROM information_schema.columns WHERE UPPER(table_name) = 'CANDIDATE_RELATED_SKILLS'",
                (rs, rowNum) -> rs.getString("column_name").toLowerCase()
        );
        assertTrue(columns.contains("id"));
        assertTrue(columns.contains("candidate_id"));
        assertTrue(columns.contains("raw_label"));
        assertTrue(columns.contains("concept_id"));
        assertTrue(columns.contains("related_canonical"));
        assertTrue(columns.contains("relationship_type"));
        assertTrue(columns.contains("taxonomy_version"));
        assertTrue(columns.contains("claim_source"));
        assertTrue(columns.contains("evidence_status"));
        assertTrue(columns.contains("version"));
        assertTrue(columns.contains("created_at"));
        assertTrue(columns.contains("updated_at"));
    }

    @Test
    @DisplayName("Test 2: Manual Related Skill Declaration — strictly self-declared, unverified, and isolated from candidate_skills")
    void testManualRelatedSkillDeclaration() {
        // Candidate submits related skills: Spring Boot and Docker
        List<RelatedSkillItem> items = candidateService.setRelatedSkills(
                candidateUser, List.of("Spring Boot", "Docker")
        );
        assertEquals(2, items.size());

        // Verify persistence in candidate_related_skills
        List<CandidateRelatedSkill> saved = relatedSkillRepository.findByCandidateId(candidateProfile.id);
        assertEquals(2, saved.size());

        Map<String, CandidateRelatedSkill> byConcept = new java.util.HashMap<>();
        for (CandidateRelatedSkill crs : saved) {
            byConcept.put(crs.conceptId, crs);
        }

        // Check Spring Boot row
        CandidateRelatedSkill spring = byConcept.get("CONCEPT-REL-SPRING_BOOT");
        assertNotNull(spring, "Spring Boot must be persisted with CONCEPT-REL-SPRING_BOOT");
        assertEquals("Spring Boot", spring.rawLabel);
        assertEquals("Java", spring.relatedCanonical);
        assertEquals("FRAMEWORK", spring.relationshipType);
        assertEquals(SkillClaimSource.SELF_DECLARED, spring.claimSource);
        assertEquals(SkillEvidenceStatus.UNVERIFIED, spring.evidenceStatus);
        assertEquals(SkillTaxonomy.TAXONOMY_VERSION, spring.taxonomyVersion);

        // Check Docker row
        CandidateRelatedSkill docker = byConcept.get("CONCEPT-REL-DOCKER");
        assertNotNull(docker, "Docker must be persisted with CONCEPT-REL-DOCKER");
        assertEquals("Docker", docker.rawLabel);
        assertEquals("DevOps", docker.relatedCanonical);
        assertEquals("TOOL", docker.relationshipType);
        assertEquals(SkillClaimSource.SELF_DECLARED, docker.claimSource);
        assertEquals(SkillEvidenceStatus.UNVERIFIED, docker.evidenceStatus);

        // CRITICAL INVARIANT: ZERO rows in candidate_skills table
        List<CandidateSkill> canonicalSkills = skillRepository.findByCandidateId(candidateProfile.id);
        assertTrue(canonicalSkills.isEmpty(), "candidate_skills table must have ZERO rows for related skills");

        // Verify nonsensical / unmapped terms are rejected with 400 Bad Request
        assertThrows(ApiException.class, () ->
                candidateService.setRelatedSkills(candidateUser, List.of("quantum flux")),
                "Nonsensical unmapped skill must throw 400 Bad Request");
    }

    @Test
    @DisplayName("Test 3: Preserving Verified Related Skill Records — manual update cannot overwrite verified status")
    void testPreservingVerifiedRelatedSkillOnUpdate() {
        // Pre-seed a VERIFIED related skill (e.g. from an authoritative review)
        CandidateRelatedSkill verifiedSkill = new CandidateRelatedSkill();
        verifiedSkill.candidateId = candidateProfile.id;
        verifiedSkill.rawLabel = "Spring Boot Enterprise";
        verifiedSkill.conceptId = "CONCEPT-REL-SPRING_BOOT";
        verifiedSkill.relatedCanonical = "Java";
        verifiedSkill.relationshipType = "FRAMEWORK";
        verifiedSkill.taxonomyVersion = SkillTaxonomy.TAXONOMY_VERSION;
        verifiedSkill.claimSource = SkillClaimSource.SELF_DECLARED;
        verifiedSkill.evidenceStatus = SkillEvidenceStatus.VERIFIED;
        relatedSkillRepository.save(verifiedSkill);

        // Candidate submits a new manual list omitting Spring Boot
        candidateService.setRelatedSkills(candidateUser, List.of("Kubernetes"));

        // Assert verified Spring Boot skill was NOT deleted
        List<CandidateRelatedSkill> current = relatedSkillRepository.findByCandidateId(candidateProfile.id);
        assertEquals(2, current.size());

        CandidateRelatedSkill retainedSpring = current.stream()
                .filter(s -> "CONCEPT-REL-SPRING_BOOT".equals(s.conceptId))
                .findFirst().orElse(null);
        assertNotNull(retainedSpring, "Verified related skill must not be deleted");
        assertEquals(SkillEvidenceStatus.VERIFIED, retainedSpring.evidenceStatus);
        assertEquals(SkillClaimSource.SELF_DECLARED, retainedSpring.claimSource);

        CandidateRelatedSkill addedK8s = current.stream()
                .filter(s -> "CONCEPT-REL-KUBERNETES".equals(s.conceptId))
                .findFirst().orElse(null);
        assertNotNull(addedK8s, "Newly added Kubernetes skill must be present");
        assertEquals(SkillEvidenceStatus.UNVERIFIED, addedK8s.evidenceStatus);
    }

    @Test
    @DisplayName("Test 4: Resume Suggestion Review & Related Skill Confirmation — strict provenance and suggestion boundary")
    void testResumeSuggestionAndConfirmationOfRelatedSkills() throws Exception {
        // Create an uploaded resume file in PENDING_REVIEW status with relatedSkills in suggestionsJson
        ResumeFile rf = new ResumeFile();
        rf.userId = candidateUser.id();
        rf.originalName = "resume_test.pdf";
        rf.storedName = "resume_test_stored.pdf";
        rf.contentType = "application/pdf";
        rf.sizeBytes = 1024L;
        rf.status = "PENDING_REVIEW";
        rf.createdAt = Instant.now();

        var node = objectMapper.createObjectNode();
        node.putArray("fields");
        node.putArray("skills");
        node.putArray("skillsDetailed");
        var relatedArr = node.putArray("relatedSkills");
        var relObj = relatedArr.addObject();
        relObj.put("raw", "Spring Boot");
        relObj.put("conceptId", "CONCEPT-REL-SPRING_BOOT");
        relObj.put("relatedCanonical", "Java");
        relObj.put("relationType", "FRAMEWORK");
        node.putArray("interests");

        rf.suggestionsJson = objectMapper.writeValueAsString(node);
        rf = resumeRepository.save(rf);

        // Candidate confirms the suggested "Spring Boot"
        ApplyInput applyInput = new ApplyInput(
                rf.id,
                Map.of(),
                List.of(),
                List.of(),
                List.of("Spring Boot")
        );
        candidateService.applySuggestions(candidateUser, applyInput);

        // Verify persisted related skill record
        List<CandidateRelatedSkill> saved = relatedSkillRepository.findByCandidateId(candidateProfile.id);
        assertEquals(1, saved.size());
        CandidateRelatedSkill item = saved.get(0);
        assertEquals("CONCEPT-REL-SPRING_BOOT", item.conceptId);
        assertEquals("Spring Boot", item.rawLabel);
        assertEquals("Java", item.relatedCanonical);
        assertEquals("FRAMEWORK", item.relationshipType);
        assertEquals(SkillClaimSource.RESUME_EXTRACTED, item.claimSource);
        assertEquals(SkillEvidenceStatus.UNVERIFIED, item.evidenceStatus);

        // Verify candidate_skills table remains untouched
        List<CandidateSkill> canonicalSkills = skillRepository.findByCandidateId(candidateProfile.id);
        assertTrue(canonicalSkills.isEmpty(), "candidate_skills must NOT receive related skills");

        // Verify that confirming an un-suggested related skill fails
        ResumeFile rf2 = new ResumeFile();
        rf2.userId = candidateUser.id();
        rf2.originalName = "resume_test2.pdf";
        rf2.storedName = "resume_test2_stored.pdf";
        rf2.contentType = "application/pdf";
        rf2.sizeBytes = 1024L;
        rf2.status = "PENDING_REVIEW";
        rf2.createdAt = Instant.now();
        rf2.suggestionsJson = rf.suggestionsJson;
        rf2 = resumeRepository.save(rf2);

        ApplyInput unSuggestedInput = new ApplyInput(
                rf2.id,
                Map.of(),
                List.of(),
                List.of(),
                List.of("Kubernetes") // Kubernetes was not suggested by resume
        );
        assertThrows(ApiException.class, () ->
                candidateService.applySuggestions(candidateUser, unSuggestedInput),
                "Un-suggested related skill must be rejected with 400 Bad Request");
    }

    @Test
    @DisplayName("Test 5: Provider Requirement Gating — mandatory rejects related skills, niceSkills accepts related skills")
    void testProviderRequirementGating() {
        // Attempt 1: Provider specifies "Spring Boot" as a MANDATORY skill -> REJECTED
        OppInput invalidOpp = new OppInput(
                "Spring Boot Specialist",
                "SOFTWARE_IT",
                "Karnataka",
                "Bengaluru",
                5,
                6,
                "BACHELORS",
                "Backend engineering role",
                List.of("Spring Boot"), // Unrecognized as mandatory canonical
                List.of()
        );
        ApiException ex = assertThrows(ApiException.class, () ->
                providerService.createOpp(providerUser, invalidOpp),
                "Mandatory requirement of Spring Boot must be rejected");
        assertTrue(ex.getMessage().contains("Unrecognized mandatory skill"),
                "Exception message must specify mandatory skill error");

        // Attempt 2: Provider specifies canonical "Java" as mandatory, and "Spring Boot" as optional (niceSkills) -> ACCEPTED
        OppInput validOpp = new OppInput(
                "Java Backend Engineer",
                "SOFTWARE_IT",
                "Karnataka",
                "Bengaluru",
                5,
                6,
                "BACHELORS",
                "Backend engineering role",
                List.of("Java"),
                List.of("Spring Boot", "Docker")
        );
        var created = providerService.createOpp(providerUser, validOpp);
        assertNotNull(created);
        assertNotNull(created.id());

        // Verify OpportunitySkill entries saved
        List<OpportunitySkill> oppSkills = opportunitySkillRepository.findByOpportunityIdIn(List.of(created.id()));
        assertEquals(3, oppSkills.size());

        OpportunitySkill javaReq = oppSkills.stream().filter(s -> "Java".equals(s.skill)).findFirst().orElse(null);
        assertNotNull(javaReq);
        assertTrue(javaReq.mandatory, "Java must be mandatory");

        OpportunitySkill springOpt = oppSkills.stream().filter(s -> "Spring Boot".equals(s.skill)).findFirst().orElse(null);
        assertNotNull(springOpt);
        assertFalse(springOpt.mandatory, "Spring Boot must be optional (mandatory=false)");

        OpportunitySkill dockerOpt = oppSkills.stream().filter(s -> "Docker".equals(s.skill)).findFirst().orElse(null);
        assertNotNull(dockerOpt);
        assertFalse(dockerOpt.mandatory, "Docker must be optional (mandatory=false)");
    }

    @Test
    @DisplayName("Test 6: Hard-Eligibility Firewall Invariant — Spring Boot in related skills NEVER satisfies mandatory Java requirement")
    void testHardEligibilityFirewallInvariant() {
        // Candidate has Spring Boot in candidate_related_skills
        candidateService.setRelatedSkills(candidateUser, List.of("Spring Boot"));

        // Candidate has NO Java in candidate_skills
        List<CandidateSkill> canonicalSkills = skillRepository.findByCandidateId(candidateProfile.id);
        Set<String> candidateCanonicals = new HashSet<>();
        for (CandidateSkill s : canonicalSkills) {
            candidateCanonicals.add(s.canonical);
        }
        assertFalse(candidateCanonicals.contains("Java"), "Candidate must not have Java canonical skill");

        // Opportunity requires MANDATORY Java
        Opportunity opp = new Opportunity();
        opp.id = 8881L;
        opp.title = "Core Java Architect";
        opp.sector = Sector.SOFTWARE_IT;
        opp.status = OppStatus.ACTIVE;
        opp.minQualification = Qualification.BACHELORS;
        opp.capacity = 2;

        OpportunitySkill mandatoryJava = new OpportunitySkill();
        mandatoryJava.opportunityId = opp.id;
        mandatoryJava.skill = "Java";
        mandatoryJava.mandatory = true;

        OpportunitySkill optionalSpring = new OpportunitySkill();
        optionalSpring.opportunityId = opp.id;
        optionalSpring.skill = "Spring Boot";
        optionalSpring.mandatory = false;

        // Evaluate pair eligibility
        PairEvaluation eval = eligibilityEvaluator.evaluatePair(
                EligibilityEvaluator.RULESET_LEGACY,
                "1.0",
                candidateProfile,
                candidateCanonicals,
                null,
                List.of(),
                opp,
                List.of(mandatoryJava, optionalSpring),
                LocalDate.of(2026, 11, 10)
        );

        // Verification of Hard Firewall:
        assertEquals(EligibilityDecision.INELIGIBLE, eval.decision(),
                "Candidate with only related Spring Boot skill must be strictly INELIGIBLE for mandatory Java");
        assertTrue(eval.reasonCodes().contains(EligibilityReasonCode.MANDATORY_SKILL_MISSING),
                "Failure reasons must include MANDATORY_SKILL_MISSING");
    }

    @Test
    @DisplayName("Test 7: Gate B — Candidate HTTP API Accessibility, Self-Scoped Isolation & Role Protection")
    void testCandidateHttpApi_GetAndPutRelatedSkills() throws Exception {
        String tokenCand1 = jwtService.issue(candidateUser.id(), candidateUser.email(), candidateUser.name(), "CANDIDATE");

        // 1. Initial GET should be empty for new candidate
        mockMvc.perform(get("/api/candidates/me/related-skills")
                        .header("Authorization", "Bearer " + tokenCand1))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_JSON))
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(0));

        // 2. PUT valid related skills: Spring Boot and Docker
        mockMvc.perform(put("/api/candidates/me/related-skills")
                        .header("Authorization", "Bearer " + tokenCand1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of("Spring Boot", "Docker"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[?(@.conceptId == 'CONCEPT-REL-SPRING_BOOT')].claimSource").value("SELF_DECLARED"))
                .andExpect(jsonPath("$[?(@.conceptId == 'CONCEPT-REL-SPRING_BOOT')].evidenceStatus").value("UNVERIFIED"))
                .andExpect(jsonPath("$[?(@.conceptId == 'CONCEPT-REL-DOCKER')].relationshipType").value("TOOL"));

        // 3. GET /me/related-skills reflects saved claims
        mockMvc.perform(get("/api/candidates/me/related-skills")
                        .header("Authorization", "Bearer " + tokenCand1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(2));

        // 4. GET /me/profile includes relatedSkills field
        mockMvc.perform(get("/api/candidates/me/profile")
                        .header("Authorization", "Bearer " + tokenCand1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.relatedSkills.length()").value(2));

        // 5. Candidate isolation: Candidate 2 cannot see or modify Candidate 1's claims
        long cand2Id = USER_SEQ.incrementAndGet();
        CandidateProfile p2 = new CandidateProfile();
        p2.userId = cand2Id;
        p2.fullName = "Other Candidate";
        p2.qualification = Qualification.BACHELORS;
        p2.candidateStatus = CandidateStatus.STUDENT;
        p2.candidateState = CandidateState.ACTIVE;
        profileRepository.save(p2);
        String tokenCand2 = jwtService.issue(cand2Id, "other" + cand2Id + "@pragati.gov.in", "Other Candidate", "CANDIDATE");

        mockMvc.perform(get("/api/candidates/me/related-skills")
                        .header("Authorization", "Bearer " + tokenCand2))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));

        // 6. Unsupported / nonsensical skill returns 400 Bad Request
        mockMvc.perform(put("/api/candidates/me/related-skills")
                        .header("Authorization", "Bearer " + tokenCand1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of("quantum flux"))))
                .andExpect(status().isBadRequest());

        // 7. Duplicate equivalent aliases resolve deterministically
        mockMvc.perform(put("/api/candidates/me/related-skills")
                        .header("Authorization", "Bearer " + tokenCand1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of("Kubernetes", "k8s"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].conceptId").value("CONCEPT-REL-KUBERNETES"));
    }

    @Test
    @DisplayName("Test 8: Gate C — End-to-End Resume Extraction, Suggestion Confirmation, and Hard Firewall Invariant")
    void testGateC_EndToEndResumeSkillsExtractionAndIsolation() throws Exception {
        // 1. Resume contains Python, Spring Boot, and Kubernetes
        ResumeFile rf = new ResumeFile();
        rf.userId = candidateUser.id();
        rf.originalName = "resume_gate_c.pdf";
        rf.storedName = "resume_gate_c_stored.pdf";
        rf.contentType = "application/pdf";
        rf.sizeBytes = 2048L;
        rf.status = "PENDING_REVIEW";
        rf.createdAt = Instant.now();

        var node = objectMapper.createObjectNode();
        node.putArray("fields");
        var skillsArr = node.putArray("skills");
        skillsArr.add("Python");

        var detailsArr = node.putArray("skillsDetailed");
        var detObj = detailsArr.addObject();
        detObj.put("canonical", "Python");
        detObj.put("raw", "Python");

        var relArr = node.putArray("relatedSkills");
        var rel1 = relArr.addObject();
        rel1.put("raw", "Spring Boot");
        rel1.put("conceptId", "CONCEPT-REL-SPRING_BOOT");
        rel1.put("relatedCanonical", "Java");
        rel1.put("relationType", "FRAMEWORK");

        var rel2 = relArr.addObject();
        rel2.put("raw", "Kubernetes");
        rel2.put("conceptId", "CONCEPT-REL-KUBERNETES");
        rel2.put("relatedCanonical", "DevOps");
        rel2.put("relationType", "TOOL");

        node.putArray("interests");
        rf.suggestionsJson = objectMapper.writeValueAsString(node);
        rf = resumeRepository.save(rf);

        // 2. Candidate confirms Python, Spring Boot, and Kubernetes
        ApplyInput in = new ApplyInput(
                rf.id,
                Map.of(),
                List.of("Python"),
                List.of(),
                List.of("Spring Boot", "Kubernetes")
        );
        candidateService.applySuggestions(candidateUser, in);

        // 3. Verify CandidateSkill table has strictly ONLY Python
        List<CandidateSkill> canonicalSaved = skillRepository.findByCandidateId(candidateProfile.id);
        assertEquals(1, canonicalSaved.size(), "Only Python must be persisted to candidate_skills");
        assertEquals("Python", canonicalSaved.get(0).canonical);
        assertEquals(SkillClaimSource.RESUME_EXTRACTED, canonicalSaved.get(0).claimSource);
        assertEquals(SkillEvidenceStatus.UNVERIFIED, canonicalSaved.get(0).evidenceStatus);

        // Explicitly assert NO Java and NO DevOps qualification was fabricated
        Set<String> canonicalNames = new HashSet<>();
        for (CandidateSkill s : canonicalSaved) canonicalNames.add(s.canonical);
        assertFalse(canonicalNames.contains("Java"), "Spring Boot must NOT create Java competence");
        assertFalse(canonicalNames.contains("DevOps"), "Kubernetes must NOT create DevOps competence");

        // 4. Verify CandidateRelatedSkill table has Spring Boot and Kubernetes
        List<CandidateRelatedSkill> relatedSaved = relatedSkillRepository.findByCandidateId(candidateProfile.id);
        assertEquals(2, relatedSaved.size());
        Map<String, CandidateRelatedSkill> byConcept = new java.util.HashMap<>();
        for (CandidateRelatedSkill crs : relatedSaved) byConcept.put(crs.conceptId, crs);

        CandidateRelatedSkill spring = byConcept.get("CONCEPT-REL-SPRING_BOOT");
        assertNotNull(spring);
        assertEquals("Spring Boot", spring.rawLabel);
        assertEquals("Java", spring.relatedCanonical);
        assertEquals("FRAMEWORK", spring.relationshipType);
        assertEquals(SkillClaimSource.RESUME_EXTRACTED, spring.claimSource);
        assertEquals(SkillEvidenceStatus.UNVERIFIED, spring.evidenceStatus);

        CandidateRelatedSkill k8s = byConcept.get("CONCEPT-REL-KUBERNETES");
        assertNotNull(k8s);
        assertEquals("Kubernetes", k8s.rawLabel);
        assertEquals("DevOps", k8s.relatedCanonical);
        assertEquals("TOOL", k8s.relationshipType);
        assertEquals(SkillClaimSource.RESUME_EXTRACTED, k8s.claimSource);
        assertEquals(SkillEvidenceStatus.UNVERIFIED, k8s.evidenceStatus);

        // 5. Hard Eligibility Invariant: Opportunity requiring mandatory Java
        Opportunity oppJava = new Opportunity();
        oppJava.id = 7001L;
        oppJava.title = "Backend Java Developer";
        oppJava.sector = Sector.SOFTWARE_IT;
        oppJava.status = OppStatus.ACTIVE;
        oppJava.minQualification = Qualification.BACHELORS;
        oppJava.capacity = 1;

        OpportunitySkill reqJava = new OpportunitySkill();
        reqJava.opportunityId = oppJava.id;
        reqJava.skill = "Java";
        reqJava.mandatory = true;

        PairEvaluation evalJava = eligibilityEvaluator.evaluatePair(
                EligibilityEvaluator.RULESET_LEGACY, "1.0",
                candidateProfile, canonicalNames, null, List.of(),
                oppJava, List.of(reqJava), LocalDate.of(2026, 11, 10));

        assertEquals(EligibilityDecision.INELIGIBLE, evalJava.decision());
        assertTrue(evalJava.reasonCodes().contains(EligibilityReasonCode.MANDATORY_SKILL_MISSING));

        // 6. Hard Eligibility Invariant: Opportunity requiring mandatory Python
        Opportunity oppPython = new Opportunity();
        oppPython.id = 7002L;
        oppPython.title = "Python Automation Specialist";
        oppPython.sector = Sector.SOFTWARE_IT;
        oppPython.status = OppStatus.ACTIVE;
        oppPython.minQualification = Qualification.BACHELORS;
        oppPython.capacity = 1;

        OpportunitySkill reqPython = new OpportunitySkill();
        reqPython.opportunityId = oppPython.id;
        reqPython.skill = "Python";
        reqPython.mandatory = true;

        PairEvaluation evalPython = eligibilityEvaluator.evaluatePair(
                EligibilityEvaluator.RULESET_LEGACY, "1.0",
                candidateProfile, canonicalNames, null, List.of(),
                oppPython, List.of(reqPython), LocalDate.of(2026, 11, 10));

        assertEquals(EligibilityDecision.ELIGIBLE, evalPython.decision());
    }

    @Test
    @DisplayName("Test 9: Gate A — Distinct Concept Identity & Directivity Contract Verification")
    void testDistinctConceptIdentityMatrix() {
        // 1. Kubernetes and k8s share one concept ID
        var k8s = SkillTaxonomy.findRelatedConcept("k8s");
        var kubernetes = SkillTaxonomy.findRelatedConcept("kubernetes");
        assertNotNull(k8s);
        assertNotNull(kubernetes);
        assertEquals("CONCEPT-REL-KUBERNETES", k8s.conceptId());
        assertEquals("CONCEPT-REL-KUBERNETES", kubernetes.conceptId());
        assertEquals(kubernetes.conceptId(), k8s.conceptId());

        // 2. Docker and Kubernetes have distinct IDs
        var docker = SkillTaxonomy.findRelatedConcept("docker");
        assertNotNull(docker);
        assertEquals("CONCEPT-REL-DOCKER", docker.conceptId());
        assertNotEquals(docker.conceptId(), kubernetes.conceptId());

        // 3. Spring Framework and Spring Boot are distinct concepts
        var springBoot = SkillTaxonomy.findRelatedConcept("spring boot");
        var springFw = SkillTaxonomy.findRelatedConcept("spring framework");
        assertNotNull(springBoot);
        assertNotNull(springFw);
        assertEquals("CONCEPT-REL-SPRING_BOOT", springBoot.conceptId());
        assertEquals("CONCEPT-REL-SPRING_FRAMEWORK", springFw.conceptId());
        assertNotEquals(springBoot.conceptId(), springFw.conceptId());

        // 4. PyTorch and TensorFlow are distinct concepts
        var pytorch = SkillTaxonomy.findRelatedConcept("pytorch");
        var tensorflow = SkillTaxonomy.findRelatedConcept("tensorflow");
        assertNotNull(pytorch);
        assertNotNull(tensorflow);
        assertEquals("CONCEPT-REL-PYTORCH", pytorch.conceptId());
        assertEquals("CONCEPT-REL-TENSORFLOW", tensorflow.conceptId());
        assertNotEquals(pytorch.conceptId(), tensorflow.conceptId());

        // 5. FastAPI, Django and Flask have distinct IDs
        var fastapi = SkillTaxonomy.findRelatedConcept("fastapi");
        var django = SkillTaxonomy.findRelatedConcept("django");
        var flask = SkillTaxonomy.findRelatedConcept("flask");
        assertNotNull(fastapi);
        assertNotNull(django);
        assertNotNull(flask);
        assertEquals("CONCEPT-REL-FASTAPI", fastapi.conceptId());
        assertEquals("CONCEPT-REL-DJANGO", django.conceptId());
        assertEquals("CONCEPT-REL-FLASK", flask.conceptId());
        assertNotEquals(fastapi.conceptId(), django.conceptId());
        assertNotEquals(django.conceptId(), flask.conceptId());

        // 6. scikit-learn and sklearn share one ID
        var scikit = SkillTaxonomy.findRelatedConcept("scikit-learn");
        var sklearn = SkillTaxonomy.findRelatedConcept("sklearn");
        assertNotNull(scikit);
        assertNotNull(sklearn);
        assertEquals("CONCEPT-REL-SCIKIT_LEARN", scikit.conceptId());
        assertEquals("CONCEPT-REL-SCIKIT_LEARN", sklearn.conceptId());

        // 7. Every active related concept has unique stable nonblank identity
        Set<String> seenAliases = new HashSet<>();
        for (var entry : SkillTaxonomy.RELATED_CONCEPTS.entrySet()) {
            assertFalse(entry.getKey().isBlank(), "Alias must not be blank");
            var rc = entry.getValue();
            assertNotNull(rc.conceptId(), "Concept ID must not be null");
            assertFalse(rc.conceptId().isBlank(), "Concept ID must not be blank");
            assertNotNull(rc.relatedCanonical(), "Related canonical must not be null");
            assertNotNull(rc.relationType(), "Relation type must not be null");
            assertTrue(SkillTaxonomy.CANONICAL.contains(rc.relatedCanonical()),
                    "Related canonical must point to an official canonical skill: " + rc.relatedCanonical());
        }

        // 8. Framework/tool classification is not confused with lexical equivalence
        assertNull(SkillTaxonomy.normalize("spring boot"), "Spring Boot must NOT be a canonical synonym");
        assertNull(SkillTaxonomy.normalize("kubernetes"), "Kubernetes must NOT be a canonical synonym");
        assertNull(SkillTaxonomy.normalize("docker"), "Docker must NOT be a canonical synonym");
        assertNull(SkillTaxonomy.normalize("pytorch"), "PyTorch must NOT be a canonical synonym");
    }
}
