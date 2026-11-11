package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;

import in.nextalloc.common.ApiException;
import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.CandidateSkill;
import in.nextalloc.domain.Opportunity;
import in.nextalloc.domain.OpportunitySkill;
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
import in.nextalloc.domain.enums.SkillSource;
import in.nextalloc.repo.CandidateProfileRepository;
import in.nextalloc.repo.CandidateSkillRepository;
import in.nextalloc.repo.ResumeFileRepository;
import in.nextalloc.security.AuthUser;
import in.nextalloc.service.EligibilityEvaluator.PairEvaluation;

@SpringBootTest
@DisplayName("Phase 4B-2B.2B: Candidate & Resume Skill Provenance Integration Tests")
class CandidateSkillProvenanceIntegrationTest {

    @Autowired
    private CandidateService candidateService;

    @Autowired
    private CandidateProfileRepository profileRepository;

    @Autowired
    private CandidateSkillRepository skillRepository;

    @Autowired
    private ResumeFileRepository resumeRepository;

    @Autowired
    private EligibilityEvaluator eligibilityEvaluator;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    @Autowired
    private ObjectMapper objectMapper;

    private static final java.util.concurrent.atomic.AtomicLong USER_SEQ = new java.util.concurrent.atomic.AtomicLong(9800000L);

    private AuthUser authUser;
    private CandidateProfile profile;

    @BeforeEach
    void setUp() {
        long userId = USER_SEQ.incrementAndGet();
        authUser = new AuthUser(userId, "cand" + userId + "@pragati.gov.in", "Provenance Candidate", "CANDIDATE");

        CandidateProfile p = new CandidateProfile();
        p.userId = userId;
        p.fullName = "Provenance Candidate";
        p.state = "Karnataka";
        p.qualification = Qualification.BACHELORS;
        p.candidateStatus = CandidateStatus.STUDENT;
        p.candidateState = CandidateState.ACTIVE;
        profile = profileRepository.save(p);
    }

    @Test
    @DisplayName("Gate A — Spring Framework alone does not create Java canonical skill nor satisfy mandatory Java requirements")
    void testSpringAloneDoesNotSatisfyMandatoryJava() {
        // 1. Verify that "Spring Boot" and "Spring Framework" are rejected as direct synonyms for Java
        assertNull(SkillTaxonomy.normalize("spring boot"), "spring boot must not normalize to Java");
        assertNull(SkillTaxonomy.normalize("Spring Framework"), "Spring Framework must not normalize to Java");
        assertNull(SkillTaxonomy.normalize("spring"), "spring must not normalize to Java");

        assertThrows(ApiException.class, () ->
                candidateService.setSkills(authUser, List.of("Spring Framework")),
                "Manual entry of Spring Framework alone without Java canonical match must be rejected");

        // 2. Candidate declares skills other than Java (e.g. Python)
        candidateService.setSkills(authUser, List.of("Python"));
        List<CandidateSkill> saved = skillRepository.findByCandidateId(profile.id);
        Set<String> candidateSkillCanonicals = new HashSet<>();
        for (CandidateSkill s : saved) {
            candidateSkillCanonicals.add(s.canonical);
        }
        assertFalse(candidateSkillCanonicals.contains("Java"), "Candidate skills must not contain Java");

        // 3. Target opportunity requiring MANDATORY Java
        Opportunity opp = new Opportunity();
        opp.id = 9991L;
        opp.title = "Core Java Specialist";
        opp.sector = Sector.SOFTWARE_IT;
        opp.status = OppStatus.ACTIVE;
        opp.minQualification = Qualification.BACHELORS;
        opp.capacity = 2;

        OpportunitySkill req = new OpportunitySkill();
        req.skill = "Java";
        req.mandatory = true;

        PairEvaluation eval = eligibilityEvaluator.evaluatePair(
                EligibilityEvaluator.RULESET_LEGACY, "1.0", profile, candidateSkillCanonicals, null, List.of(), opp, List.of(req), LocalDate.of(2026, 11, 10));

        assertEquals(EligibilityDecision.INELIGIBLE, eval.decision(),
                "Candidate with only Spring/Python must NOT be eligible for mandatory Java role");
        assertTrue(eval.reasonCodes().contains(EligibilityReasonCode.MANDATORY_SKILL_MISSING),
                "Missing mandatory skill reason code must be present");
    }

    @Test
    @DisplayName("Gate B — Manual skill submission preserves raw input, resolves canonical, sets SELF_DECLARED / UNVERIFIED")
    void testManualSkillSubmissionProvenance() {
        // Candidate enters aliases "py" and "postgresql"
        List<CandidateService.SkillItem> items = candidateService.setSkills(authUser, List.of("py", "postgresql"));

        assertEquals(2, items.size());

        List<CandidateSkill> persisted = skillRepository.findByCandidateId(profile.id);
        assertEquals(2, persisted.size());

        CandidateSkill pySkill = persisted.stream()
                .filter(s -> "Python".equals(s.canonical))
                .findFirst().orElseThrow();
        assertEquals("py", pySkill.rawLabel, "rawLabel must preserve submitted alias");
        assertEquals("py", pySkill.originalInput, "originalInput must preserve exact submitted label");
        assertEquals("Python", pySkill.canonical);
        assertEquals("CONCEPT-PYTHON", pySkill.conceptId);
        assertEquals(SkillTaxonomy.TAXONOMY_VERSION, pySkill.taxonomyVersion);
        assertEquals(SkillClaimSource.SELF_DECLARED, pySkill.claimSource);
        assertEquals(SkillEvidenceStatus.UNVERIFIED, pySkill.evidenceStatus);
        assertEquals(SkillSource.PROFILE, pySkill.source);
        assertTrue(pySkill.validated);

        CandidateSkill sqlSkill = persisted.stream()
                .filter(s -> "SQL".equals(s.canonical))
                .findFirst().orElseThrow();
        assertEquals("postgresql", sqlSkill.rawLabel);
        assertEquals("postgresql", sqlSkill.originalInput);
        assertEquals("SQL", sqlSkill.canonical);
        assertEquals("CONCEPT-SQL", sqlSkill.conceptId);
        assertEquals(SkillClaimSource.SELF_DECLARED, sqlSkill.claimSource);
        assertEquals(SkillEvidenceStatus.UNVERIFIED, sqlSkill.evidenceStatus);
    }

    @Test
    @DisplayName("Gate B — Genuinely VERIFIED records are preserved (id, timestamp, verified status) across manual updates")
    void testVerifiedSkillRecordIntegrityDuringManualUpdate() {
        // 1. Pre-insert a VERIFIED Java skill entity
        CandidateSkill verifiedJava = new CandidateSkill();
        verifiedJava.candidateId = profile.id;
        verifiedJava.rawLabel = "Java SE 17 Certified";
        verifiedJava.originalInput = "Java SE 17 Certified";
        verifiedJava.canonical = "Java";
        verifiedJava.conceptId = "CONCEPT-JAVA";
        verifiedJava.taxonomyVersion = SkillTaxonomy.TAXONOMY_VERSION;
        verifiedJava.source = SkillSource.PROFILE;
        verifiedJava.claimSource = SkillClaimSource.SELF_DECLARED;
        verifiedJava.evidenceStatus = SkillEvidenceStatus.VERIFIED;
        verifiedJava.validated = true;
        verifiedJava = skillRepository.save(verifiedJava);
        Long verifiedId = verifiedJava.id;
        Instant originalCreatedAt = verifiedJava.createdAt;
        assertNotNull(verifiedId);

        // 2. Candidate updates profile skills including Java and new skill Python
        List<CandidateService.SkillItem> updated = candidateService.setSkills(authUser, List.of("Java", "Python"));
        assertEquals(2, updated.size());

        // 3. Verify that Java record entity was NOT deleted and recreated
        List<CandidateSkill> persisted = skillRepository.findByCandidateId(profile.id);
        assertEquals(2, persisted.size());

        CandidateSkill retainedJava = persisted.stream()
                .filter(s -> "Java".equals(s.canonical))
                .findFirst().orElseThrow();
        assertEquals(verifiedId, retainedJava.id, "Existing VERIFIED skill entity id must be preserved");
        assertEquals(SkillEvidenceStatus.VERIFIED, retainedJava.evidenceStatus, "VERIFIED status must remain strictly intact");
        assertEquals(
                originalCreatedAt.truncatedTo(java.time.temporal.ChronoUnit.MILLIS),
                retainedJava.createdAt.truncatedTo(java.time.temporal.ChronoUnit.MILLIS),
                "Original createdAt timestamp must not be reset");

        CandidateSkill newPy = persisted.stream()
                .filter(s -> "Python".equals(s.canonical))
                .findFirst().orElseThrow();
        assertNotEquals(verifiedId, newPy.id);
        assertEquals(SkillEvidenceStatus.UNVERIFIED, newPy.evidenceStatus, "New skill must be UNVERIFIED");
        assertEquals(SkillClaimSource.SELF_DECLARED, newPy.claimSource, "New skill must be SELF_DECLARED");

        // 4. Candidate updates profile skills omitting Java: VERIFIED record must NOT be deleted
        candidateService.setSkills(authUser, List.of("Python"));
        List<CandidateSkill> afterOmission = skillRepository.findByCandidateId(profile.id);
        assertEquals(2, afterOmission.size(), "VERIFIED skill must not be deleted even when omitted from profile skills form");
        assertTrue(afterOmission.stream().anyMatch(s -> "Java".equals(s.canonical) && s.evidenceStatus == SkillEvidenceStatus.VERIFIED));
    }

    @Test
    @DisplayName("Gate B — Duplicate aliases for same canonical skill collapse deterministically without losing provenance")
    void testDuplicateAliasesDeduplication() {
        // Candidate submits "py" and "python3" — both map to canonical "Python"
        List<CandidateService.SkillItem> items = candidateService.setSkills(authUser, List.of("py", "python3", "Java"));

        assertEquals(2, items.size(), "Duplicate aliases must collapse into unique canonical skills");

        List<CandidateSkill> persisted = skillRepository.findByCandidateId(profile.id);
        assertEquals(2, persisted.size());

        CandidateSkill pySkill = persisted.stream()
                .filter(s -> "Python".equals(s.canonical))
                .findFirst().orElseThrow();
        assertEquals("py", pySkill.originalInput, "First submitted alias is preserved deterministically");
        assertEquals("Python", pySkill.canonical);
    }

    @Test
    @DisplayName("Gate B — Unrecognized manual skills are rejected with badRequest")
    void testUnrecognizedSkillRejection() {
        assertThrows(ApiException.class, () ->
                candidateService.setSkills(authUser, List.of("CompletelyFakeSkill12345")));
    }

    @Test
    @DisplayName("Gate C — Resume suggestion application preserves extracted source phrase and marks RESUME_EXTRACTED")
    void testResumeExtractionProvenanceApplication() throws Exception {
        // Create a simulated resume file with skillsDetailed mapping
        ResumeFile resume = new ResumeFile();
        resume.userId = authUser.id();
        resume.originalName = "test_resume.pdf";
        resume.storedName = "test_resume_stored.pdf";
        resume.sizeBytes = 1024;
        resume.status = "PENDING_REVIEW";

        var node = objectMapper.createObjectNode();
        node.putArray("fields");
        var skillsArr = node.putArray("skills");
        skillsArr.add("Java");
        skillsArr.add("SQL");

        var detailedArr = node.putArray("skillsDetailed");
        var d1 = detailedArr.addObject();
        d1.put("canonical", "Java");
        d1.put("raw", "core java and jvm internals");

        var d2 = detailedArr.addObject();
        d2.put("canonical", "SQL");
        d2.put("raw", "postgres 14");

        node.putArray("interests");
        resume.suggestionsJson = objectMapper.writeValueAsString(node);
        resume = resumeRepository.save(resume);

        // Candidate confirms Java and SQL suggestions
        CandidateService.ApplyInput input = new CandidateService.ApplyInput(
                resume.id,
                Map.of(),
                List.of("Java", "SQL"),
                List.of()
        );

        candidateService.applySuggestions(authUser, input);

        List<CandidateSkill> saved = skillRepository.findByCandidateId(profile.id);
        assertEquals(2, saved.size());

        CandidateSkill javaSkill = saved.stream()
                .filter(s -> "Java".equals(s.canonical))
                .findFirst().orElseThrow();
        assertEquals("core java and jvm internals", javaSkill.originalInput, "Must preserve actual extracted raw phrase");
        assertEquals("core java and jvm internals", javaSkill.rawLabel);
        assertEquals("Java", javaSkill.canonical);
        assertEquals("CONCEPT-JAVA", javaSkill.conceptId);
        assertEquals(SkillClaimSource.RESUME_EXTRACTED, javaSkill.claimSource);
        assertEquals(SkillEvidenceStatus.UNVERIFIED, javaSkill.evidenceStatus);
        assertEquals(SkillSource.RESUME, javaSkill.source);

        CandidateSkill sqlSkill = saved.stream()
                .filter(s -> "SQL".equals(s.canonical))
                .findFirst().orElseThrow();
        assertEquals("postgres 14", sqlSkill.originalInput);
        assertEquals("SQL", sqlSkill.canonical);
        assertEquals(SkillClaimSource.RESUME_EXTRACTED, sqlSkill.claimSource);
        assertEquals(SkillEvidenceStatus.UNVERIFIED, sqlSkill.evidenceStatus);
    }

    @Test
    @DisplayName("Gate C — When raw phrase was lost/unavailable, originalInput remains honestly null (no fabrication)")
    void testResumeExtractionFallbackHonestNullOriginalInput() throws Exception {
        // Create legacy suggestion payload lacking skillsDetailed
        ResumeFile resume = new ResumeFile();
        resume.userId = authUser.id();
        resume.originalName = "legacy_resume.pdf";
        resume.storedName = "legacy_resume_stored.pdf";
        resume.sizeBytes = 1024;
        resume.status = "PENDING_REVIEW";

        var node = objectMapper.createObjectNode();
        node.putArray("fields");
        var skillsArr = node.putArray("skills");
        skillsArr.add("Python");
        node.putArray("interests");
        resume.suggestionsJson = objectMapper.writeValueAsString(node);
        resume = resumeRepository.save(resume);

        CandidateService.ApplyInput input = new CandidateService.ApplyInput(
                resume.id,
                Map.of(),
                List.of("Python"),
                List.of()
        );

        candidateService.applySuggestions(authUser, input);

        List<CandidateSkill> saved = skillRepository.findByCandidateId(profile.id);
        assertEquals(1, saved.size());

        CandidateSkill pySkill = saved.get(0);
        assertEquals("Python", pySkill.canonical);
        assertNull(pySkill.originalInput, "Must NOT fabricate canonical name as original input when raw phrase is unknown");
        assertEquals(SkillClaimSource.RESUME_EXTRACTED, pySkill.claimSource);
        assertEquals(SkillEvidenceStatus.UNVERIFIED, pySkill.evidenceStatus);
    }

    @Test
    @DisplayName("Gate C — Tampered resume suggestions claiming un-suggested skills are rejected with 400 Bad Request")
    void testTamperedResumeSuggestionRejected() throws Exception {
        ResumeFile resume = new ResumeFile();
        resume.userId = authUser.id();
        resume.originalName = "resume.pdf";
        resume.storedName = "resume_stored.pdf";
        resume.sizeBytes = 512;
        resume.status = "PENDING_REVIEW";

        var node = objectMapper.createObjectNode();
        node.putArray("fields");
        var skillsArr = node.putArray("skills");
        skillsArr.add("Python");
        node.putArray("interests");
        resume.suggestionsJson = objectMapper.writeValueAsString(node);
        resume = resumeRepository.save(resume);

        // Attacker attempts to claim Java, which was not suggested by the resume
        CandidateService.ApplyInput tamperedInput = new CandidateService.ApplyInput(
                resume.id,
                Map.of(),
                List.of("Python", "Java"),
                List.of()
        );

        ApiException ex = assertThrows(ApiException.class, () ->
                candidateService.applySuggestions(authUser, tamperedInput));
        assertEquals(400, ex.getStatus().value());
        assertTrue(ex.getMessage().contains("Skill not suggested by this resume: Java"));
    }

    @Test
    @DisplayName("Gate C — Duplicate skills in applySuggestions batch collapse idempotently")
    void testBatchIdempotencyInApplySuggestions() throws Exception {
        ResumeFile resume = new ResumeFile();
        resume.userId = authUser.id();
        resume.originalName = "resume_batch.pdf";
        resume.storedName = "resume_batch_stored.pdf";
        resume.sizeBytes = 512;
        resume.status = "PENDING_REVIEW";

        var node = objectMapper.createObjectNode();
        node.putArray("fields");
        var skillsArr = node.putArray("skills");
        skillsArr.add("Python");
        node.putArray("interests");
        resume.suggestionsJson = objectMapper.writeValueAsString(node);
        resume = resumeRepository.save(resume);

        // Submitting duplicate "Python" in the same batch
        CandidateService.ApplyInput input = new CandidateService.ApplyInput(
                resume.id,
                Map.of(),
                List.of("Python", "Python"),
                List.of()
        );

        candidateService.applySuggestions(authUser, input);

        List<CandidateSkill> saved = skillRepository.findByCandidateId(profile.id);
        assertEquals(1, saved.size(), "Batch duplicates must not produce duplicate database rows");
    }

    @Test
    @DisplayName("Gate D — Concept ID mapping produces 42 unique IDs across 42 canonical skills with zero collisions")
    void testConceptIdUniqueness() {
        Set<String> conceptIds = new HashSet<>();
        for (String canonical : SkillTaxonomy.CANONICAL) {
            String cid = SkillTaxonomy.conceptId(canonical);
            assertNotNull(cid, "Concept ID must not be null for " + canonical);
            assertTrue(cid.startsWith("CONCEPT-"), "Concept ID must have standard prefix for " + canonical);
            boolean added = conceptIds.add(cid);
            assertTrue(added, "Duplicate concept ID detected: " + cid + " for canonical: " + canonical);
        }
        assertEquals(SkillTaxonomy.CANONICAL.size(), conceptIds.size(),
                "Concept ID count must exactly match canonical skills count with 0 collisions");
    }

    @Test
    @DisplayName("Gate E — Whole-profile concurrency serializes concurrent skill updates safely")
    void testConcurrentWholeProfileSkillUpdates() throws InterruptedException {
        int threads = 4;
        ExecutorService executor = Executors.newFixedThreadPool(threads);
        CountDownLatch startLatch = new CountDownLatch(1);
        CountDownLatch doneLatch = new CountDownLatch(threads);
        AtomicInteger successCount = new AtomicInteger(0);

        List<List<String>> submissions = List.of(
                List.of("Java", "Python"),
                List.of("Python", "SQL"),
                List.of("React", "Node.js"),
                List.of("C++", "Git")
        );

        for (int i = 0; i < threads; i++) {
            final int index = i;
            executor.submit(() -> {
                try {
                    startLatch.await();
                    candidateService.setSkills(authUser, submissions.get(index));
                    successCount.incrementAndGet();
                } catch (Exception ignored) {
                } finally {
                    doneLatch.countDown();
                }
            });
        }

        startLatch.countDown();
        boolean finished = doneLatch.await(10, TimeUnit.SECONDS);
        executor.shutdown();

        assertTrue(finished, "All concurrent updates should finish within timeout");
        assertTrue(successCount.get() >= 1, "At least one update must succeed");

        // Assert database state is clean: no duplicate canonical skills, collection size <= 2
        List<CandidateSkill> finalSkills = skillRepository.findByCandidateId(profile.id);
        long uniqueCanonicals = finalSkills.stream().map(s -> s.canonical).distinct().count();
        assertEquals(finalSkills.size(), uniqueCanonicals, "Database must not contain duplicate canonical skills");
        assertTrue(finalSkills.size() <= 2, "Whole profile collection must reflect one valid atomic state");
    }

    @Test
    @DisplayName("Gate F & J — Legacy records are read truthfully via mySkills with default provenance")
    void testLegacyRecordReadingThroughMySkills() {
        // Insert legacy row with raw SQL without V5 fields
        jdbcTemplate.update(
                "INSERT INTO candidate_skills (candidate_id, raw_label, canonical, source, validated) " +
                "VALUES (?, ?, ?, ?, ?)",
                profile.id, "LegacySkill", "Python", "PROFILE", true
        );

        List<CandidateService.SkillItem> mySkills = candidateService.mySkills(authUser);
        assertEquals(1, mySkills.size());

        CandidateService.SkillItem item = mySkills.get(0);
        assertEquals("LegacySkill", item.raw());
        assertEquals("Python", item.canonical());
        assertEquals("PROFILE", item.source());
        assertTrue(item.validated());
        assertNull(item.originalInput(), "Legacy record must have null originalInput");
        assertEquals("LEGACY_UNSPECIFIED", item.claimSource());
        assertEquals("UNVERIFIED", item.evidenceStatus());
    }
}
