package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;

import java.time.Instant;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.core.JdbcTemplate;

import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.CandidateSkill;
import in.nextalloc.domain.enums.CandidateState;
import in.nextalloc.domain.enums.CandidateStatus;
import in.nextalloc.domain.enums.Qualification;
import in.nextalloc.domain.enums.SkillClaimSource;
import in.nextalloc.domain.enums.SkillEvidenceStatus;
import in.nextalloc.domain.enums.SkillSource;
import in.nextalloc.repo.CandidateProfileRepository;
import in.nextalloc.repo.CandidateSkillRepository;

/**
 * Phase 4B-2B.2A: Versioned Skill Persistence & Provenance Foundation Tests.
 * Verifies additive schema migration, backward compatibility with legacy rows,
 * truthful null timestamps for legacy rows, concept consistency,
 * optimistic concurrency locking, and decoupling of taxonomy validation from evidence verification.
 */
@SpringBootTest
@DisplayName("Phase 4B-2B.2A — Versioned Skill Persistence and Provenance Tests")
class CandidateSkillPersistenceTest {

    @Autowired
    private CandidateSkillRepository candidateSkillRepository;

    @Autowired
    private CandidateProfileRepository candidateProfileRepository;

    @Autowired
    private JdbcTemplate jdbcTemplate;

    private CandidateProfile testCandidate;

    @BeforeEach
    void setUp() {
        CandidateProfile p = new CandidateProfile();
        p.userId = 999000L + System.nanoTime() % 100000L;
        p.fullName = "Test Candidate 4B-2B.2A";
        p.state = "Karnataka";
        p.qualification = Qualification.BACHELORS;
        p.candidateStatus = CandidateStatus.STUDENT;
        p.candidateState = CandidateState.ACTIVE;
        testCandidate = candidateProfileRepository.save(p);
    }

    @Test
    @DisplayName("Gate D — Verify Flyway V5 columns exist and schema is validated by Hibernate")
    void testFlywayV5SchemaColumnsExist() {
        List<String> columnNames = jdbcTemplate.query(
                "SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'CANDIDATE_SKILLS'",
                (rs, rowNum) -> rs.getString("COLUMN_NAME").toLowerCase()
        );

        assertTrue(columnNames.contains("concept_id"), "Missing concept_id column");
        assertTrue(columnNames.contains("taxonomy_version"), "Missing taxonomy_version column");
        assertTrue(columnNames.contains("original_input"), "Missing original_input column");
        assertTrue(columnNames.contains("claim_source"), "Missing claim_source column");
        assertTrue(columnNames.contains("evidence_status"), "Missing evidence_status column");
        assertTrue(columnNames.contains("created_at"), "Missing created_at column");
        assertTrue(columnNames.contains("updated_at"), "Missing updated_at column");
        assertTrue(columnNames.contains("version"), "Missing version column");
    }

    @Test
    @DisplayName("Check A & F — Legacy records without provenance retain honest null timestamps and default values")
    void testLegacyRecordBackwardCompatibility() {
        // Simulate a legacy pre-V5 record inserted via SQL without new provenance columns
        jdbcTemplate.update(
                "INSERT INTO candidate_skills (candidate_id, raw_label, canonical, source, validated) " +
                "VALUES (?, ?, ?, ?, ?)",
                testCandidate.id, "Python", "Python", "PROFILE", true
        );

        List<CandidateSkill> skills = candidateSkillRepository.findByCandidateId(testCandidate.id);
        assertFalse(skills.isEmpty());

        CandidateSkill legacy = skills.get(skills.size() - 1);
        assertEquals("Python", legacy.canonical);
        assertEquals("Python", legacy.rawLabel);
        assertEquals(SkillSource.PROFILE, legacy.source);
        assertTrue(legacy.validated);

        // Honest legacy uncertainty: originalInput, conceptId, taxonomyVersion, and timestamps are null (no fabrication)
        assertNull(legacy.originalInput, "Original input must be null for legacy records (no fabrication)");
        assertNull(legacy.conceptId, "Concept ID must be null for legacy unmigrated rows");
        assertNull(legacy.taxonomyVersion, "Taxonomy version must be null for legacy rows");
        assertNull(legacy.createdAt, "createdAt must be NULL for legacy records (no migration-time timestamp fabrication)");
        assertNull(legacy.updatedAt, "updatedAt must be NULL for legacy records (no migration-time timestamp fabrication)");
        assertEquals(SkillClaimSource.LEGACY_UNSPECIFIED, legacy.claimSource);
        assertEquals(SkillEvidenceStatus.UNVERIFIED, legacy.evidenceStatus);
        assertEquals(0L, legacy.version);

        // Gate B & C: Perform genuine JPA update on the legacy record and verify version + timestamp semantics
        legacy.evidenceStatus = SkillEvidenceStatus.VERIFIED;
        CandidateSkill updatedLegacy = candidateSkillRepository.saveAndFlush(legacy);

        // Verify preserved legacy identity and values
        assertEquals("Python", updatedLegacy.canonical);
        assertEquals("Python", updatedLegacy.rawLabel);
        assertEquals(SkillSource.PROFILE, updatedLegacy.source);
        assertTrue(updatedLegacy.validated);
        assertNull(updatedLegacy.originalInput, "originalInput remains NULL when wording was historically lost");

        // Verify truthful timestamp behavior: createdAt stays NULL, updatedAt is set
        assertNull(updatedLegacy.createdAt, "createdAt must remain NULL even after subsequent update");
        assertNotNull(updatedLegacy.updatedAt, "updatedAt must be populated upon genuine update");

        // Verify optimistic locking version increment
        assertEquals(1L, updatedLegacy.version, "@Version must increment from 0 to 1 on managed entity update");
    }

    @Test
    @DisplayName("Check A & C — Additive provenance persistence preserves original label, concept identity, and timestamps")
    void testAdditiveProvenancePersistence() {
        CandidateSkill s = new CandidateSkill();
        s.candidateId = testCandidate.id;
        s.rawLabel = "PyTorch";
        s.canonical = "PyTorch"; // Retains its own canonical concept identity (not conflated with Deep Learning)
        s.originalInput = "pytorch (v2.1 framework)";
        s.conceptId = "CONCEPT-PYTORCH";
        s.taxonomyVersion = "nextalloc-2026.11-v1";
        s.source = SkillSource.RESUME;
        s.claimSource = SkillClaimSource.RESUME_EXTRACTED;
        s.evidenceStatus = SkillEvidenceStatus.UNVERIFIED;
        s.validated = true;

        CandidateSkill saved = candidateSkillRepository.save(s);
        assertNotNull(saved.id);
        assertNotNull(saved.createdAt, "New records must receive genuine creation timestamp via lifecycle hook");
        assertNotNull(saved.updatedAt, "New records must receive genuine update timestamp via lifecycle hook");

        CandidateSkill reloaded = candidateSkillRepository.findById(saved.id).orElseThrow();
        assertEquals("PyTorch", reloaded.rawLabel);
        assertEquals("PyTorch", reloaded.canonical);
        assertEquals("pytorch (v2.1 framework)", reloaded.originalInput);
        assertEquals("CONCEPT-PYTORCH", reloaded.conceptId);
        assertEquals("nextalloc-2026.11-v1", reloaded.taxonomyVersion);
        assertEquals(SkillSource.RESUME, reloaded.source);
        assertEquals(SkillClaimSource.RESUME_EXTRACTED, reloaded.claimSource);
        assertEquals(SkillEvidenceStatus.UNVERIFIED, reloaded.evidenceStatus);
        assertEquals(0L, reloaded.version);
    }

    @Test
    @DisplayName("Check A & D — Optimistic locking increments version and updates timestamp on mutation")
    void testOptimisticLockingConcurrencyProtection() throws InterruptedException {
        CandidateSkill s = new CandidateSkill();
        s.candidateId = testCandidate.id;
        s.rawLabel = "Docker";
        s.canonical = "Docker"; // Retains its own concept identity
        s.originalInput = "docker";
        s.conceptId = "CONCEPT-DOCKER";
        s.source = SkillSource.PROFILE;
        s.claimSource = SkillClaimSource.SELF_DECLARED;
        s.evidenceStatus = SkillEvidenceStatus.UNVERIFIED;
        s.validated = true;

        CandidateSkill saved = candidateSkillRepository.saveAndFlush(s);
        assertEquals(0L, saved.version);
        Instant origCreatedAt = saved.createdAt;
        assertNotNull(origCreatedAt);

        Thread.sleep(10); // Guarantee clock advance for update timestamp test

        // Update record
        saved.evidenceStatus = SkillEvidenceStatus.PENDING_VERIFICATION;
        CandidateSkill updated = candidateSkillRepository.saveAndFlush(saved);
        assertEquals(1L, updated.version);
        assertEquals(origCreatedAt, updated.createdAt, "createdAt must remain immutable on update");
        assertTrue(updated.updatedAt.isAfter(origCreatedAt) || updated.updatedAt.equals(origCreatedAt));

        // Simulate stale concurrent write
        CandidateSkill stale = new CandidateSkill();
        stale.id = updated.id;
        stale.candidateId = updated.candidateId;
        stale.rawLabel = updated.rawLabel;
        stale.canonical = updated.canonical;
        stale.originalInput = updated.originalInput;
        stale.conceptId = updated.conceptId;
        stale.source = updated.source;
        stale.claimSource = updated.claimSource;
        stale.evidenceStatus = SkillEvidenceStatus.VERIFIED;
        stale.createdAt = updated.createdAt;
        stale.updatedAt = Instant.now();
        stale.version = 0L; // Stale version token

        assertThrows(OptimisticLockingFailureException.class, () -> {
            candidateSkillRepository.saveAndFlush(stale);
        });
    }

    @Test
    @DisplayName("Check C — Taxonomy recognition does not conflate with evidence verification")
    void testTaxonomyValidationDecoupledFromEvidenceStatus() {
        CandidateSkill s = new CandidateSkill();
        s.candidateId = testCandidate.id;
        s.rawLabel = "Kubernetes";
        s.canonical = "Kubernetes"; // Retains its own canonical concept identity
        s.originalInput = "kubernetes";
        s.conceptId = "CONCEPT-KUBERNETES";
        s.source = SkillSource.PROFILE;
        s.claimSource = SkillClaimSource.SELF_DECLARED;
        s.validated = true; // Candidate accepted/profile-validated
        s.evidenceStatus = SkillEvidenceStatus.UNVERIFIED; // Not verified by documentary authority

        CandidateSkill saved = candidateSkillRepository.save(s);

        // validated=true MUST NOT fabricate verified occupational qualification
        assertTrue(saved.validated, "Skill entry is active on profile");
        assertEquals(SkillEvidenceStatus.UNVERIFIED, saved.evidenceStatus,
                "Profile-declared skill must remain UNVERIFIED without documentary evidence");
    }

    @Test
    @DisplayName("Check E — Custom repository queries by conceptId and evidenceStatus operate cleanly")
    void testRepositoryCustomQueries() {
        CandidateSkill s1 = new CandidateSkill();
        s1.candidateId = testCandidate.id;
        s1.rawLabel = "Java";
        s1.canonical = "Java";
        s1.conceptId = "CONCEPT-JAVA";
        s1.evidenceStatus = SkillEvidenceStatus.VERIFIED;
        s1.claimSource = SkillClaimSource.SELF_DECLARED;
        candidateSkillRepository.save(s1);

        CandidateSkill s2 = new CandidateSkill();
        s2.candidateId = testCandidate.id;
        s2.rawLabel = "Docker";
        s2.canonical = "Docker";
        s2.conceptId = "CONCEPT-DOCKER";
        s2.evidenceStatus = SkillEvidenceStatus.UNVERIFIED;
        s2.claimSource = SkillClaimSource.SELF_DECLARED;
        candidateSkillRepository.save(s2);

        List<CandidateSkill> byConcept = candidateSkillRepository.findByCandidateIdAndConceptId(testCandidate.id, "CONCEPT-JAVA");
        assertEquals(1, byConcept.size());
        assertEquals("CONCEPT-JAVA", byConcept.get(0).conceptId);

        List<CandidateSkill> byEvidence = candidateSkillRepository.findByCandidateIdAndEvidenceStatus(
                testCandidate.id, SkillEvidenceStatus.VERIFIED);
        assertEquals(1, byEvidence.size());
        assertEquals("CONCEPT-JAVA", byEvidence.get(0).conceptId);
    }
}
