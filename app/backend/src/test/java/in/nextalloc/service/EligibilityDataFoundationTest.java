package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.Statement;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicLong;

import javax.sql.DataSource;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationInfo;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestMethodOrder;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.jdbc.datasource.SingleConnectionDataSource;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;

import in.nextalloc.domain.AllocationEligibilitySnapshot;
import in.nextalloc.domain.AllocationRun;
import in.nextalloc.domain.CandidateAcademicRecord;
import in.nextalloc.domain.CandidateEvidence;
import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.enums.CandidateState;
import in.nextalloc.domain.enums.CandidateStatus;
import in.nextalloc.domain.enums.EligibilityDecision;
import in.nextalloc.domain.enums.EligibilityReasonCode;
import in.nextalloc.domain.enums.EmploymentType;
import in.nextalloc.domain.enums.EnrollmentStatus;
import in.nextalloc.domain.enums.EvidenceStatus;
import in.nextalloc.domain.enums.FinalYearStatus;
import in.nextalloc.domain.enums.LocationType;
import in.nextalloc.domain.enums.Qualification;
import in.nextalloc.domain.enums.RunStatus;
import in.nextalloc.domain.enums.ScenarioKey;
import in.nextalloc.domain.enums.SignatoryRole;
import in.nextalloc.repo.AllocationEligibilitySnapshotRepository;
import in.nextalloc.repo.AllocationRunRepository;
import in.nextalloc.repo.CandidateAcademicRecordRepository;
import in.nextalloc.repo.CandidateEvidenceRepository;
import in.nextalloc.repo.CandidateProfileRepository;

@SpringBootTest
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
@DisplayName("Phase 4A-2A — Eligibility Data Foundation Integration Test Suite")
class EligibilityDataFoundationTest {

    private static final AtomicLong USER_ID_GEN = new AtomicLong(900000);

    @Autowired
    private Flyway flyway;

    @Autowired
    private DataSource dataSource;

    @Autowired
    private CandidateProfileRepository candidateProfiles;

    @Autowired
    private AllocationRunRepository allocationRuns;

    @Autowired
    private CandidateAcademicRecordRepository academicRecords;

    @Autowired
    private CandidateEvidenceRepository candidateEvidences;

    @Autowired
    private AllocationEligibilitySnapshotRepository eligibilitySnapshots;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private CandidateProfile createTestCandidate(String name) {
        CandidateProfile c = new CandidateProfile();
        c.userId = USER_ID_GEN.incrementAndGet();
        c.fullName = name;
        c.phone = "9876543210";
        c.dob = LocalDate.of(2002, 5, 15);
        c.state = "Bihar";
        c.district = "Patna";
        c.locationType = LocationType.RURAL;
        c.qualification = Qualification.BACHELORS;
        c.candidateStatus = CandidateStatus.GRADUATE;
        c.candidateState = CandidateState.ACTIVE;
        c.employmentType = EmploymentType.UNKNOWN;
        c.updatedAt = Instant.now();
        return candidateProfiles.save(c);
    }

    private AllocationRun createTestRun(String name) {
        AllocationRun run = new AllocationRun();
        run.runCode = "RUN-" + UUID.randomUUID().toString().substring(0, 8);
        run.number = 100;
        run.scenario = ScenarioKey.STANDARD_SHOWCASE;
        run.snapshotId = 1L;
        run.policyName = name;
        run.policyKey = "balanced_v2";
        run.policyVersion = "2.0.0";
        run.eligibilityRuleSetId = "prototype-legacy-v1";
        run.eligibilityRuleSetVersion = "1.0.0";
        run.weightsJson = "{}";
        run.fullCoverage = false;
        run.fairnessFloorPct = 30;
        run.status = RunStatus.QUEUED;
        run.createdAt = Instant.now();
        return allocationRuns.save(run);
    }

    @Test
    @Order(1)
    @DisplayName("Case 1: Fresh Flyway migrations applied successfully (V1 and V2)")
    void testFlywayMigrationsApplied() {
        MigrationInfo[] applied = flyway.info().applied();
        assertTrue(applied.length >= 2, "Expected at least 2 Flyway migrations applied");

        assertEquals("1", applied[0].getVersion().getVersion());
        assertEquals("baseline schema", applied[0].getDescription());
        assertTrue(applied[0].getState().isApplied());

        assertEquals("2", applied[1].getVersion().getVersion());
        assertEquals("phase4a2 eligibility foundation", applied[1].getDescription());
        assertTrue(applied[1].getState().isApplied());
    }

    @Test
    @Order(2)
    @DisplayName("Case 2: Hibernate schema validation passes with ddl-auto: validate")
    void testSchemaValidationSucceeds() {
        // If ddl-auto=validate failed, Spring context startup would have aborted.
        // Asserting non-null repositories and entities proves JPA mapping alignment.
        assertNotNull(academicRecords);
        assertNotNull(candidateEvidences);
        assertNotNull(eligibilitySnapshots);
        assertNotNull(allocationRuns);
        assertNotNull(candidateProfiles);
    }

    @Test
    @Order(3)
    @DisplayName("Case 3: Genuine pre-Flyway legacy database upgrade test (checkpoint c1b2f3a)")
    void testLegacyDatabaseUpgradeSimulation() throws Exception {
        // Create an isolated in-memory H2 database specifically to simulate the genuine pre-Flyway c1b2f3a database
        String dbUrl = "jdbc:h2:mem:genuine_legacy_" + UUID.randomUUID().toString().replace("-", "") + ";DB_CLOSE_DELAY=-1";
        SingleConnectionDataSource testDs = new SingleConnectionDataSource(dbUrl, "sa", "", true);

        try {
            // Step 1: Create the exact pre-Flyway physical schema generated by Hibernate at checkpoint c1b2f3a
            // Note: At c1b2f3a, no flyway_schema_history existed, candidate_profiles had no employment_type,
            // and allocation_runs had no eligibility_ruleset_* columns.
            try (Connection conn = testDs.getConnection();
                 Statement stmt = conn.createStatement()) {
                
                stmt.execute("CREATE TABLE users (" +
                        "id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, " +
                        "email VARCHAR(190) NOT NULL, " +
                        "password_hash VARCHAR(255) NOT NULL, " +
                        "name VARCHAR(120) NOT NULL, " +
                        "role VARCHAR(20) NOT NULL, " +
                        "status VARCHAR(20) NOT NULL, " +
                        "created_at TIMESTAMP NOT NULL, " +
                        "CONSTRAINT uq_users_email UNIQUE (email))");

                stmt.execute("CREATE TABLE candidate_profiles (" +
                        "id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, " +
                        "user_id BIGINT NOT NULL, " +
                        "full_name VARCHAR(120) NOT NULL, " +
                        "phone VARCHAR(30), " +
                        "dob DATE, " +
                        "qualification VARCHAR(30), " +
                        "candidate_status VARCHAR(20), " +
                        "state VARCHAR(60), " +
                        "district VARCHAR(60), " +
                        "location_type VARCHAR(20), " +
                        "bio VARCHAR(600), " +
                        "experience_years DOUBLE PRECISION NOT NULL, " +
                        "candidate_state VARCHAR(20) NOT NULL, " +
                        "updated_at TIMESTAMP NOT NULL, " +
                        "CONSTRAINT uq_candidate_user UNIQUE (user_id))");

                stmt.execute("CREATE TABLE opportunities (" +
                        "id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, " +
                        "provider_id BIGINT NOT NULL, " +
                        "title VARCHAR(160) NOT NULL, " +
                        "sector VARCHAR(40) NOT NULL, " +
                        "state VARCHAR(60) NOT NULL, " +
                        "city VARCHAR(80), " +
                        "capacity INT NOT NULL, " +
                        "duration_months INT NOT NULL, " +
                        "min_qualification VARCHAR(30) NOT NULL, " +
                        "status VARCHAR(20) NOT NULL, " +
                        "description VARCHAR(800), " +
                        "created_at TIMESTAMP NOT NULL, " +
                        "updated_at TIMESTAMP NOT NULL)");

                stmt.execute("CREATE TABLE policy_presets (" +
                        "id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, " +
                        "preset_key VARCHAR(40) NOT NULL, " +
                        "name VARCHAR(120) NOT NULL, " +
                        "description VARCHAR(400), " +
                        "weights_json VARCHAR(500) NOT NULL, " +
                        "full_coverage BOOLEAN NOT NULL, " +
                        "fairness_floor_pct INT, " +
                        "is_default BOOLEAN NOT NULL, " +
                        "version VARCHAR(20) NOT NULL, " +
                        "CONSTRAINT uq_policy_key UNIQUE (preset_key))");

                stmt.execute("CREATE TABLE allocation_runs (" +
                        "id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, " +
                        "snapshot_id BIGINT NOT NULL, " +
                        "number INT NOT NULL, " +
                        "run_code VARCHAR(40) NOT NULL, " +
                        "scenario VARCHAR(40) NOT NULL, " +
                        "policy_key VARCHAR(40) NOT NULL, " +
                        "policy_name VARCHAR(120) NOT NULL, " +
                        "policy_version VARCHAR(20) NOT NULL, " +
                        "weights_json VARCHAR(500) NOT NULL, " +
                        "full_coverage BOOLEAN NOT NULL, " +
                        "fairness_floor_pct INT, " +
                        "fairness_groups_json VARCHAR(1000), " +
                        "overrides_json VARCHAR(2000), " +
                        "changes_json VARCHAR(1000), " +
                        "parent_run_id BIGINT, " +
                        "status VARCHAR(20) NOT NULL, " +
                        "solver_status VARCHAR(20), " +
                        "objective BIGINT, " +
                        "eligible_pairs INT NOT NULL DEFAULT 0, " +
                        "variables INT NOT NULL DEFAULT 0, " +
                        "constraints INT NOT NULL DEFAULT 0, " +
                        "solver_runtime_ms BIGINT NOT NULL DEFAULT 0, " +
                        "total_runtime_ms BIGINT NOT NULL DEFAULT 0, " +
                        "stage_timings_json VARCHAR(2000), " +
                        "error_message VARCHAR(500), " +
                        "created_at TIMESTAMP NOT NULL, " +
                        "started_at TIMESTAMP, " +
                        "completed_at TIMESTAMP, " +
                        "CONSTRAINT uq_run_code UNIQUE (run_code))");

                stmt.execute("CREATE TABLE assignments (" +
                        "id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, " +
                        "run_id BIGINT NOT NULL, " +
                        "candidate_id BIGINT NOT NULL, " +
                        "opportunity_id BIGINT NOT NULL, " +
                        "source VARCHAR(20) NOT NULL, " +
                        "suitability DOUBLE PRECISION NOT NULL, " +
                        "skills_fit DOUBLE PRECISION NOT NULL, " +
                        "qualification_fit DOUBLE PRECISION NOT NULL, " +
                        "interest_fit DOUBLE PRECISION NOT NULL, " +
                        "location_fit DOUBLE PRECISION NOT NULL, " +
                        "preference_fit DOUBLE PRECISION NOT NULL, " +
                        "learning_fit DOUBLE PRECISION NOT NULL, " +
                        "experience_fit DOUBLE PRECISION NOT NULL, " +
                        "breakdown_json VARCHAR(800), " +
                        "reason VARCHAR(600), " +
                        "CONSTRAINT uq_assign_run_cand_src UNIQUE (run_id, candidate_id, source))");

                // Include V1 baseline candidate_skills table
                stmt.execute("CREATE TABLE candidate_skills (" +
                        "id BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY, " +
                        "candidate_id BIGINT NOT NULL, " +
                        "raw_label VARCHAR(80) NOT NULL, " +
                        "canonical VARCHAR(80) NOT NULL, " +
                        "source VARCHAR(20) NOT NULL, " +
                        "validated BOOLEAN NOT NULL)");

                // Populate representative legacy data
                stmt.execute("INSERT INTO users (id, email, password_hash, name, role, status, created_at) " +
                        "VALUES (101, 'admin@pragati.gov.in', 'hash123', 'Administrator', 'ADMIN', 'ACTIVE', CURRENT_TIMESTAMP)");
                stmt.execute("INSERT INTO users (id, email, password_hash, name, role, status, created_at) " +
                        "VALUES (102, 'rahul@example.com', 'hash456', 'Rahul Sharma', 'CANDIDATE', 'ACTIVE', CURRENT_TIMESTAMP)");

                stmt.execute("INSERT INTO candidate_profiles (id, user_id, full_name, phone, state, district, location_type, qualification, candidate_status, candidate_state, experience_years, updated_at) " +
                        "VALUES (201, 102, 'Rahul Sharma', '9876543210', 'Bihar', 'Patna', 'RURAL', 'BACHELORS', 'GRADUATE', 'ACTIVE', 0.0, CURRENT_TIMESTAMP)");

                stmt.execute("INSERT INTO candidate_skills (id, candidate_id, raw_label, canonical, source, validated) " +
                        "VALUES (801, 201, 'Python', 'Python', 'PROFILE', true)");

                stmt.execute("INSERT INTO opportunities (id, provider_id, title, sector, state, city, capacity, duration_months, min_qualification, status, created_at, updated_at) " +
                        "VALUES (301, 1, 'Data Entry Intern', 'IT', 'Bihar', 'Patna', 5, 12, 'BACHELORS', 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)");

                stmt.execute("INSERT INTO policy_presets (id, preset_key, name, description, weights_json, full_coverage, fairness_floor_pct, is_default, version) " +
                        "VALUES (401, 'balanced', 'Balanced Legacy', 'Legacy v1 balanced preset', '{\"skills\":0.4}', false, 30, false, '1.0.0')");

                stmt.execute("INSERT INTO allocation_runs (id, run_code, number, scenario, snapshot_id, policy_name, policy_key, policy_version, weights_json, full_coverage, fairness_floor_pct, status, eligible_pairs, variables, constraints, solver_runtime_ms, total_runtime_ms, created_at) " +
                        "VALUES (501, 'RUN-LEGACY-001', 1, 'STANDARD_SHOWCASE', 1, 'Balanced Legacy', 'balanced', '1.0.0', '{\"skills\":0.4}', false, 30, 'COMPLETED', 10, 20, 30, 150, 200, CURRENT_TIMESTAMP)");

                stmt.execute("INSERT INTO assignments (id, run_id, candidate_id, opportunity_id, source, suitability, skills_fit, qualification_fit, interest_fit, location_fit, preference_fit, learning_fit, experience_fit) " +
                        "VALUES (601, 501, 201, 301, 'GLOBAL', 85.5, 90.0, 80.0, 70.0, 100.0, 80.0, 75.0, 60.0)");
            }

            // Step 2: Verify Safety Risk A — running migrate with baseline-on-migrate=false against this un-baselined DB FAILS
            Flyway unsafeFlyway = Flyway.configure()
                    .dataSource(testDs)
                    .baselineOnMigrate(false)
                    .locations("classpath:db/migration")
                    .load();
            
            assertThrows(org.flywaydb.core.api.FlywayException.class, () -> {
                unsafeFlyway.migrate();
            }, "Running Flyway on un-baselined nonempty legacy DB with baseline-on-migrate: false MUST fail");

            // Step 3: Controlled Legacy Onboarding Procedure
            // a) Pre-baseline inspection: Verify schema fingerprint (all expected legacy tables exist)
            try (Connection conn = testDs.getConnection();
                 Statement stmt = conn.createStatement()) {
                String[] expectedTables = {"USERS", "CANDIDATE_PROFILES", "CANDIDATE_SKILLS", "OPPORTUNITIES", "POLICY_PRESETS", "ALLOCATION_RUNS", "ASSIGNMENTS"};
                for (String tbl : expectedTables) {
                    try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM " + tbl)) {
                        assertTrue(rs.next(), "Expected table " + tbl + " must exist before baselining");
                    }
                }
                try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM candidate_profiles")) {
                    assertTrue(rs.next());
                    assertEquals(1, rs.getInt(1), "Expected 1 candidate pre-migration");
                }
                try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM allocation_runs")) {
                    assertTrue(rs.next());
                    assertEquals(1, rs.getInt(1), "Expected 1 allocation run pre-migration");
                }
            }

            // b) Explicitly baseline the legacy database at Version 1
            Flyway controlledFlyway = Flyway.configure()
                    .dataSource(testDs)
                    .baselineVersion("1")
                    .baselineDescription("baseline schema")
                    .locations("classpath:db/migration")
                    .load();
            controlledFlyway.baseline();

            // c) Apply V2 migration
            controlledFlyway.migrate();

            // Step 4: Verify complete backward compatibility and additive schema expansion
            try (Connection conn = testDs.getConnection();
                 Statement stmt = conn.createStatement()) {
                
                // Assert Candidate row count and new employment_type column default
                try (ResultSet rs = stmt.executeQuery("SELECT id, full_name, location_type, employment_type FROM candidate_profiles WHERE id = 201")) {
                    assertTrue(rs.next(), "Candidate 201 must exist");
                    assertEquals("Rahul Sharma", rs.getString("full_name"));
                    assertEquals("RURAL", rs.getString("location_type"));
                    assertEquals("UNKNOWN", rs.getString("employment_type"), "Legacy profile must default employment_type to UNKNOWN");
                }

                // Assert Allocation Run row count and new ruleset columns default
                try (ResultSet rs = stmt.executeQuery("SELECT id, policy_key, policy_version, weights_json, fairness_floor_pct, eligibility_ruleset_id, eligibility_ruleset_version FROM allocation_runs WHERE id = 501")) {
                    assertTrue(rs.next(), "Legacy run 501 must exist");
                    assertEquals("balanced", rs.getString("policy_key"));
                    assertEquals("1.0.0", rs.getString("policy_version"));
                    assertEquals("{\"skills\":0.4}", rs.getString("weights_json"));
                    assertEquals(30, rs.getInt("fairness_floor_pct"));
                    assertEquals("prototype-legacy-v1", rs.getString("eligibility_ruleset_id"));
                    assertEquals("1.0.0", rs.getString("eligibility_ruleset_version"));
                }

                // Assert Assignment row count and suitability scores preserved
                try (ResultSet rs = stmt.executeQuery("SELECT candidate_id, opportunity_id, suitability FROM assignments WHERE id = 601")) {
                    assertTrue(rs.next(), "Assignment 601 must exist");
                    assertEquals(201L, rs.getLong("candidate_id"));
                    assertEquals(301L, rs.getLong("opportunity_id"));
                    assertEquals(85.5, rs.getDouble("suitability"), 0.001);
                }

                // Assert Candidate Skill row preserved and upgraded with truthful legacy null timestamps
                try (ResultSet rs = stmt.executeQuery("SELECT id, candidate_id, raw_label, canonical, source, validated, claim_source, evidence_status, created_at, updated_at, version FROM candidate_skills WHERE id = 801")) {
                    assertTrue(rs.next(), "Legacy candidate skill 801 must exist");
                    assertEquals(201L, rs.getLong("candidate_id"));
                    assertEquals("Python", rs.getString("raw_label"));
                    assertEquals("Python", rs.getString("canonical"));
                    assertEquals("PROFILE", rs.getString("source"));
                    assertTrue(rs.getBoolean("validated"));
                    assertEquals("LEGACY_UNSPECIFIED", rs.getString("claim_source"));
                    assertEquals("UNVERIFIED", rs.getString("evidence_status"));
                    assertNull(rs.getTimestamp("created_at"), "Legacy skill created_at must be NULL (no fabricated migration timestamp)");
                    assertNull(rs.getTimestamp("updated_at"), "Legacy skill updated_at must be NULL (no fabricated migration timestamp)");
                    assertEquals(0L, rs.getLong("version"));
                }

                // Assert New tables exist and are initially empty
                try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM candidate_academic_records")) {
                    assertTrue(rs.next());
                    assertEquals(0, rs.getInt(1), "New candidate_academic_records table should be empty");
                }
                try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM candidate_evidences")) {
                    assertTrue(rs.next());
                    assertEquals(0, rs.getInt(1), "New candidate_evidences table should be empty");
                }
                try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM allocation_eligibility_snapshots")) {
                    assertTrue(rs.next());
                    assertEquals(0, rs.getInt(1), "New allocation_eligibility_snapshots table should be empty");
                }
                try (ResultSet rs = stmt.executeQuery("SELECT COUNT(*) FROM candidate_evidence_current")) {
                    assertTrue(rs.next());
                    assertEquals(0, rs.getInt(1), "New candidate_evidence_current table should be empty");
                }
            }

            // Step 5: Assert Flyway Schema History table state
            MigrationInfo[] history = controlledFlyway.info().applied();
            assertEquals(8, history.length, "Flyway schema history must have 8 entries (Baseline + V2 to V8)");
            assertEquals("1", history[0].getVersion().getVersion());
            assertEquals("baseline schema", history[0].getDescription());
            assertEquals("BASELINE", history[0].getType().name());

            assertEquals("2", history[1].getVersion().getVersion());
            assertEquals("phase4a2 eligibility foundation", history[1].getDescription());
            assertEquals("SQL", history[1].getType().name());
            assertTrue(history[1].getState().isApplied());

            assertEquals("3", history[2].getVersion().getVersion());
            assertEquals("phase4a2c noc current submission", history[2].getDescription());
            assertEquals("SQL", history[2].getType().name());
            assertTrue(history[2].getState().isApplied());

            assertEquals("4", history[3].getVersion().getVersion());
            assertEquals("candidate academic record version", history[3].getDescription());
            assertEquals("SQL", history[3].getType().name());
            assertTrue(history[3].getState().isApplied());

            assertEquals("5", history[4].getVersion().getVersion());
            assertEquals("candidate skill provenance and version", history[4].getDescription());
            assertEquals("SQL", history[4].getType().name());
            assertTrue(history[4].getState().isApplied());

            assertEquals("6", history[5].getVersion().getVersion());
            assertEquals("candidate related skills", history[5].getDescription());
            assertEquals("SQL", history[5].getType().name());
            assertTrue(history[5].getState().isApplied());

            assertEquals("7", history[6].getVersion().getVersion());
            assertEquals("offer lifecycle", history[6].getDescription());
            assertEquals("SQL", history[6].getType().name());
            assertTrue(history[6].getState().isApplied());

            assertEquals("8", history[7].getVersion().getVersion());
            assertEquals("update admin display name", history[7].getDescription());
            assertEquals("SQL", history[7].getType().name());
            assertTrue(history[7].getState().isApplied());

            // Step 6: Verify Idempotence — calling migrate again does nothing
            int subsequentMigrations = controlledFlyway.migrate().migrationsExecuted;
            assertEquals(0, subsequentMigrations, "Subsequent migration on up-to-date database must execute 0 migrations");

        } finally {
            testDs.destroy();
        }
    }

    @Test
    @Order(4)
    @DisplayName("Case 4: CandidateAcademicRecord persistence, defaults, and retrieval")
    void testCandidateAcademicRecordPersistence() {
        CandidateProfile c = createTestCandidate("Academic Test Candidate");

        CandidateAcademicRecord record = new CandidateAcademicRecord();
        record.candidateId = c.id;
        record.institutionName = "National Institute of Technology";
        record.degreeProgram = "Computer Science and Engineering";
        record.institutionAisheCode = "U-0123";
        record.currentAcademicYear = 4;
        record.programDurationYears = 4;
        record.enrollmentStatus = EnrollmentStatus.ENROLLED_FULL_TIME;
        record.finalYearStatus = FinalYearStatus.VERIFIED_FINAL_YEAR;
        record.expectedCompletionDate = LocalDate.of(2026, 6, 30);
        record.updatedAt = Instant.now();

        CandidateAcademicRecord saved = academicRecords.save(record);
        assertNotNull(saved.id);

        Optional<CandidateAcademicRecord> fetched = academicRecords.findByCandidateId(c.id);
        assertTrue(fetched.isPresent());
        assertEquals("National Institute of Technology", fetched.get().institutionName);
        assertEquals("Computer Science and Engineering", fetched.get().degreeProgram);
        assertEquals(EnrollmentStatus.ENROLLED_FULL_TIME, fetched.get().enrollmentStatus);
        assertEquals(FinalYearStatus.VERIFIED_FINAL_YEAR, fetched.get().finalYearStatus);
        assertEquals(Integer.valueOf(4), fetched.get().currentAcademicYear);
        assertEquals(LocalDate.of(2026, 6, 30), fetched.get().expectedCompletionDate);
    }

    @Test
    @Order(5)
    @DisplayName("Case 5: CandidateEvidence persistence and verification workflow")
    void testCandidateEvidenceWorkflow() {
        CandidateProfile c = createTestCandidate("Evidence Test Candidate");

        CandidateEvidence evidence = new CandidateEvidence();
        evidence.candidateId = c.id;
        evidence.evidenceType = "INSTITUTIONAL_NOC";
        evidence.verificationStatus = EvidenceStatus.SUBMITTED;
        evidence.documentReference = "s3://pragati-evidence/2026/noc_c" + c.id + ".pdf";
        evidence.documentSha256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
        evidence.issuingInstitution = "NIT Patna";
        evidence.signatoryRole = SignatoryRole.HEAD_OF_DEPARTMENT;
        evidence.signatoryName = "Dr. S. Sharma";
        evidence.signatoryEmail = "hod.cse@nitp.ac.in";
        evidence.declaresNoAcademicConflict = true;
        evidence.validFrom = LocalDate.of(2026, 4, 1);
        evidence.createdAt = Instant.now();
        evidence.updatedAt = Instant.now();

        CandidateEvidence saved = candidateEvidences.save(evidence);
        assertNotNull(saved.id);
        assertEquals(Integer.valueOf(0), saved.version);
        assertEquals(EvidenceStatus.SUBMITTED, saved.verificationStatus);

        // Verification transition
        saved.verificationStatus = EvidenceStatus.VERIFIED;
        saved.verifiedByUserId = 1L; // Admin user
        saved.verifiedAt = Instant.now();
        saved.validUntil = LocalDate.of(2026, 12, 31);
        CandidateEvidence updated = candidateEvidences.save(saved);

        assertEquals(EvidenceStatus.VERIFIED, updated.verificationStatus);
        assertEquals(Integer.valueOf(1), updated.version);
        assertEquals("Dr. S. Sharma", updated.signatoryName);
        assertEquals(SignatoryRole.HEAD_OF_DEPARTMENT, updated.signatoryRole);
    }

    @Test
    @Order(6)
    @DisplayName("Case 6: CandidateEvidence optimistic locking via @Version")
    void testCandidateEvidenceOptimisticLocking() {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

        Long evidenceId = tx.execute(status -> {
            CandidateProfile c = createTestCandidate("Optimistic Lock Candidate");
            CandidateEvidence ev = new CandidateEvidence();
            ev.candidateId = c.id;
            ev.evidenceType = "GOVERNMENT_ID";
            ev.verificationStatus = EvidenceStatus.SUBMITTED;
            ev.documentReference = "ref-123";
            ev.createdAt = Instant.now();
            ev.updatedAt = Instant.now();
            return candidateEvidences.save(ev).id;
        });

        // Thread A / Stale Entity simulation:
        CandidateEvidence staleEntity = candidateEvidences.findById(evidenceId).orElseThrow();
        assertEquals(Integer.valueOf(0), staleEntity.version);

        // Thread B updates the row:
        tx.execute(status -> {
            CandidateEvidence freshEntity = candidateEvidences.findById(evidenceId).orElseThrow();
            freshEntity.rejectionNotes = "Updated by Thread B";
            return candidateEvidences.save(freshEntity);
        });

        // Thread A now attempts to save stale entity:
        staleEntity.rejectionNotes = "Conflicting update by Thread A";
        assertThrows(OptimisticLockingFailureException.class, () -> {
            candidateEvidences.saveAndFlush(staleEntity);
        }, "Saving stale entity with older version should throw OptimisticLockingFailureException");
    }

    @Test
    @Order(7)
    @DisplayName("Case 7: AllocationEligibilitySnapshot persistence and unique constraint (run_id, candidate_id)")
    void testAllocationEligibilitySnapshotUniqueness() {
        CandidateProfile c = createTestCandidate("Snapshot Candidate");
        AllocationRun r = createTestRun("Snapshot Run");

        AllocationEligibilitySnapshot s1 = new AllocationEligibilitySnapshot();
        s1.runId = r.id;
        s1.candidateId = c.id;
        s1.decision = EligibilityDecision.ELIGIBLE;
        s1.reasonCodesJson = "[\"ELIGIBLE\"]";
        s1.evidenceStatusSnapshot = "VERIFIED";
        s1.evaluatedAt = Instant.now();

        AllocationEligibilitySnapshot saved = eligibilitySnapshots.save(s1);
        assertNotNull(saved.id);

        // Duplicate snapshot for same run and candidate must violate unique constraint
        AllocationEligibilitySnapshot s2 = new AllocationEligibilitySnapshot();
        s2.runId = r.id;
        s2.candidateId = c.id;
        s2.decision = EligibilityDecision.INELIGIBLE;
        s2.reasonCodesJson = "[\"FULL_TIME_EDUCATION_DISQUALIFIED\"]";
        s2.evaluatedAt = Instant.now();

        assertThrows(DataIntegrityViolationException.class, () -> {
            eligibilitySnapshots.saveAndFlush(s2);
        }, "Duplicate (run_id, candidate_id) snapshot must violate uniqueness constraint");
    }

    @Test
    @Order(8)
    @DisplayName("Case 8: AllocationRun entity defaults match prototype-legacy-v1 / 1.0.0")
    void testAllocationRunDefaults() {
        AllocationRun run = new AllocationRun();
        run.runCode = "RUN-" + UUID.randomUUID().toString().substring(0, 8);
        run.number = 101;
        run.scenario = ScenarioKey.STANDARD_SHOWCASE;
        run.snapshotId = 1L;
        run.policyName = "Default Check Run";
        run.policyKey = "balanced_v2";
        run.policyVersion = "2.0.0";
        run.weightsJson = "{}";
        run.status = RunStatus.QUEUED;

        assertEquals("prototype-legacy-v1", run.eligibilityRuleSetId);
        assertEquals("1.0.0", run.eligibilityRuleSetVersion);

        AllocationRun saved = allocationRuns.save(run);
        AllocationRun reloaded = allocationRuns.findById(saved.id).orElseThrow();
        assertEquals("prototype-legacy-v1", reloaded.eligibilityRuleSetId);
        assertEquals("1.0.0", reloaded.eligibilityRuleSetVersion);
    }

    @Test
    @Order(9)
    @DisplayName("Case 9: CandidateProfile entity defaults match EmploymentType.UNKNOWN")
    void testCandidateProfileEmploymentTypeDefault() {
        CandidateProfile p = new CandidateProfile();
        assertEquals(EmploymentType.UNKNOWN, p.employmentType);

        p.userId = USER_ID_GEN.incrementAndGet();
        p.fullName = "Employment Default Check";
        p.phone = "9876543211";
        p.dob = LocalDate.of(2001, 8, 20);
        p.state = "Jharkhand";
        p.district = "Ranchi";
        p.locationType = LocationType.URBAN;
        p.qualification = Qualification.HIGHER_SECONDARY;
        p.candidateStatus = CandidateStatus.STUDENT;
        p.candidateState = CandidateState.ACTIVE;
        p.updatedAt = Instant.now();

        CandidateProfile saved = candidateProfiles.save(p);
        CandidateProfile reloaded = candidateProfiles.findById(saved.id).orElseThrow();
        assertEquals(EmploymentType.UNKNOWN, reloaded.employmentType);
    }

    @Test
    @Order(10)
    @DisplayName("Case 10: Referential integrity enforces candidate_id on CandidateAcademicRecord")
    void testReferentialIntegrityAcademicRecord() {
        CandidateAcademicRecord record = new CandidateAcademicRecord();
        record.candidateId = 99999999L; // Non-existent candidate
        record.institutionName = "Ghost College";
        record.updatedAt = Instant.now();

        assertThrows(DataIntegrityViolationException.class, () -> {
            academicRecords.saveAndFlush(record);
        }, "Saving CandidateAcademicRecord with invalid candidateId must violate FK constraint");
    }

    @Test
    @Order(11)
    @DisplayName("Case 11: Referential integrity enforces candidate_id on CandidateEvidence")
    void testReferentialIntegrityCandidateEvidence() {
        CandidateEvidence ev = new CandidateEvidence();
        ev.candidateId = 99999999L; // Non-existent candidate
        ev.evidenceType = "NOC";
        ev.documentReference = "doc://invalid";
        ev.createdAt = Instant.now();
        ev.updatedAt = Instant.now();

        assertThrows(DataIntegrityViolationException.class, () -> {
            candidateEvidences.saveAndFlush(ev);
        }, "Saving CandidateEvidence with invalid candidateId must violate FK constraint");
    }

    @Test
    @Order(12)
    @DisplayName("Case 12: Referential integrity enforces run_id and candidate_id on EligibilitySnapshot")
    void testReferentialIntegrityEligibilitySnapshot() {
        CandidateProfile c = createTestCandidate("Snapshot FK Candidate");

        // Invalid runId
        AllocationEligibilitySnapshot badRunSnapshot = new AllocationEligibilitySnapshot();
        badRunSnapshot.runId = 99999999L;
        badRunSnapshot.candidateId = c.id;
        badRunSnapshot.decision = EligibilityDecision.ELIGIBLE;
        badRunSnapshot.evaluatedAt = Instant.now();

        assertThrows(DataIntegrityViolationException.class, () -> {
            eligibilitySnapshots.saveAndFlush(badRunSnapshot);
        }, "Saving AllocationEligibilitySnapshot with invalid runId must violate FK constraint");

        AllocationRun r = createTestRun("Snapshot FK Run");

        // Invalid candidateId
        AllocationEligibilitySnapshot badCandSnapshot = new AllocationEligibilitySnapshot();
        badCandSnapshot.runId = r.id;
        badCandSnapshot.candidateId = 99999999L;
        badCandSnapshot.decision = EligibilityDecision.ELIGIBLE;
        badCandSnapshot.evaluatedAt = Instant.now();

        assertThrows(DataIntegrityViolationException.class, () -> {
            eligibilitySnapshots.saveAndFlush(badCandSnapshot);
        }, "Saving AllocationEligibilitySnapshot with invalid candidateId must violate FK constraint");
    }

    @Test
    @Order(13)
    @DisplayName("Case 13: Enum domain values mapping and String serialization correctness")
    void testEnumDomainValuesCompleteness() {
        // EnrollmentStatus
        assertEquals(4, EnrollmentStatus.values().length);
        assertEquals(EnrollmentStatus.UNKNOWN, EnrollmentStatus.valueOf("UNKNOWN"));
        assertEquals(EnrollmentStatus.NOT_ENROLLED, EnrollmentStatus.valueOf("NOT_ENROLLED"));
        assertEquals(EnrollmentStatus.ENROLLED_FULL_TIME, EnrollmentStatus.valueOf("ENROLLED_FULL_TIME"));
        assertEquals(EnrollmentStatus.ENROLLED_DISTANCE_PART_TIME, EnrollmentStatus.valueOf("ENROLLED_DISTANCE_PART_TIME"));

        // FinalYearStatus
        assertEquals(4, FinalYearStatus.values().length);
        assertEquals(FinalYearStatus.UNKNOWN, FinalYearStatus.valueOf("UNKNOWN"));
        assertEquals(FinalYearStatus.VERIFIED_NOT_FINAL_YEAR, FinalYearStatus.valueOf("VERIFIED_NOT_FINAL_YEAR"));
        assertEquals(FinalYearStatus.CLAIMED_FINAL_YEAR, FinalYearStatus.valueOf("CLAIMED_FINAL_YEAR"));
        assertEquals(FinalYearStatus.VERIFIED_FINAL_YEAR, FinalYearStatus.valueOf("VERIFIED_FINAL_YEAR"));

        // EmploymentType
        assertEquals(5, EmploymentType.values().length);
        assertEquals(EmploymentType.UNKNOWN, EmploymentType.valueOf("UNKNOWN"));
        assertEquals(EmploymentType.UNEMPLOYED, EmploymentType.valueOf("UNEMPLOYED"));
        assertEquals(EmploymentType.PART_TIME, EmploymentType.valueOf("PART_TIME"));
        assertEquals(EmploymentType.INTERNSHIP_OR_APPRENTICE, EmploymentType.valueOf("INTERNSHIP_OR_APPRENTICE"));
        assertEquals(EmploymentType.FULL_TIME, EmploymentType.valueOf("FULL_TIME"));

        // EvidenceStatus
        assertEquals(6, EvidenceStatus.values().length);
        assertEquals(EvidenceStatus.NOT_SUBMITTED, EvidenceStatus.valueOf("NOT_SUBMITTED"));
        assertEquals(EvidenceStatus.SUBMITTED, EvidenceStatus.valueOf("SUBMITTED"));
        assertEquals(EvidenceStatus.PENDING_ADDITIONAL_INFO, EvidenceStatus.valueOf("PENDING_ADDITIONAL_INFO"));
        assertEquals(EvidenceStatus.VERIFIED, EvidenceStatus.valueOf("VERIFIED"));
        assertEquals(EvidenceStatus.REJECTED, EvidenceStatus.valueOf("REJECTED"));
        assertEquals(EvidenceStatus.EXPIRED, EvidenceStatus.valueOf("EXPIRED"));

        // SignatoryRole
        assertEquals(6, SignatoryRole.values().length);
        assertEquals(SignatoryRole.HEAD_OF_DEPARTMENT, SignatoryRole.valueOf("HEAD_OF_DEPARTMENT"));
        assertEquals(SignatoryRole.DEAN, SignatoryRole.valueOf("DEAN"));
        assertEquals(SignatoryRole.PRINCIPAL, SignatoryRole.valueOf("PRINCIPAL"));
        assertEquals(SignatoryRole.TRAINING_AND_PLACEMENT_OFFICER, SignatoryRole.valueOf("TRAINING_AND_PLACEMENT_OFFICER"));
        assertEquals(SignatoryRole.REGISTRAR, SignatoryRole.valueOf("REGISTRAR"));
        assertEquals(SignatoryRole.OTHER_UNRECOGNIZED, SignatoryRole.valueOf("OTHER_UNRECOGNIZED"));

        // EligibilityDecision
        assertEquals(2, EligibilityDecision.values().length);
        assertEquals(EligibilityDecision.ELIGIBLE, EligibilityDecision.valueOf("ELIGIBLE"));
        assertEquals(EligibilityDecision.INELIGIBLE, EligibilityDecision.valueOf("INELIGIBLE"));

        // EligibilityReasonCode
        assertEquals(17, EligibilityReasonCode.values().length);
        assertEquals(EligibilityReasonCode.QUALIFICATION_BELOW_MINIMUM, EligibilityReasonCode.valueOf("QUALIFICATION_BELOW_MINIMUM"));
        assertEquals(EligibilityReasonCode.NOT_IN_FINAL_YEAR, EligibilityReasonCode.valueOf("NOT_IN_FINAL_YEAR"));
        assertEquals(EligibilityReasonCode.INSTITUTIONAL_NOC_UNVERIFIED, EligibilityReasonCode.valueOf("INSTITUTIONAL_NOC_UNVERIFIED"));
    }

    @Test
    @Order(14)
    @DisplayName("Case 14: Existing benchmark datasets load seamlessly with backward compatibility")
    void testExistingBenchmarkDataCompatibility() {
        // StartupSeeder loads standard showcase candidates on boot.
        List<CandidateProfile> allCandidates = candidateProfiles.findAll();
        assertFalse(allCandidates.isEmpty(), "Benchmark candidates should be present from StartupSeeder");

        // Candidates loaded from legacy benchmarks should cleanly have UNKNOWN employmentType
        for (CandidateProfile c : allCandidates) {
            assertNotNull(c.employmentType, "Candidate employmentType must not be null");
            // Also verify that absence of academic record or evidence does not crash queries
            Optional<CandidateAcademicRecord> ac = academicRecords.findByCandidateId(c.id);
            assertTrue(ac.isEmpty() || ac.get().candidateId.equals(c.id));

            List<CandidateEvidence> evidences = candidateEvidences.findByCandidateId(c.id);
            assertNotNull(evidences);
        }
    }

    @Test
    @Order(15)
    @DisplayName("Case 15: Restrictive referential action prevents accidental deletion of historical runs or candidates referenced by snapshots")
    void testSnapshotSurvivesParentDeletionAttempts() {
        TransactionTemplate tx = new TransactionTemplate(transactionManager);
        tx.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);

        // 1. Setup run, candidate, evidence, and eligibility snapshot in a committed transaction
        Long[] ids = tx.execute(status -> {
            CandidateProfile c = createTestCandidate("Protected History Candidate");
            AllocationRun r = createTestRun("Protected History Run");

            CandidateEvidence ev = new CandidateEvidence();
            ev.candidateId = c.id;
            ev.evidenceType = "INSTITUTIONAL_NOC";
            ev.verificationStatus = EvidenceStatus.VERIFIED;
            ev.documentReference = "s3://pragati-evidence/2026/noc_protected.pdf";
            ev.createdAt = Instant.now();
            ev.updatedAt = Instant.now();
            ev = candidateEvidences.save(ev);

            AllocationEligibilitySnapshot snap = new AllocationEligibilitySnapshot();
            snap.runId = r.id;
            snap.candidateId = c.id;
            snap.decision = EligibilityDecision.ELIGIBLE;
            snap.reasonCodesJson = "[\"FINAL_YEAR_VERIFIED\",\"NOC_VERIFIED\"]";
            snap.evidenceStatusSnapshot = "VERIFIED";
            snap.evidenceIdRef = ev.id;
            snap.evaluatedAt = Instant.now();
            snap = eligibilitySnapshots.save(snap);

            return new Long[]{r.id, c.id, ev.id, snap.id};
        });

        Long runId = ids[0];
        Long candidateId = ids[1];
        Long evidenceId = ids[2];
        Long snapshotId = ids[3];

        // 2. Attempt to delete parent AllocationRun -> MUST be rejected by ON DELETE RESTRICT (fk_eligsanp_run)
        assertThrows(DataIntegrityViolationException.class, () -> {
            tx.execute(status -> {
                allocationRuns.deleteById(runId);
                allocationRuns.flush();
                return null;
            });
        }, "Hard deletion of AllocationRun referenced by eligibility snapshot must be rejected by ON DELETE RESTRICT");

        // 3. Attempt to delete parent CandidateProfile -> MUST be rejected by ON DELETE RESTRICT (fk_eligsanp_cand)
        assertThrows(DataIntegrityViolationException.class, () -> {
            tx.execute(status -> {
                candidateProfiles.deleteById(candidateId);
                candidateProfiles.flush();
                return null;
            });
        }, "Hard deletion of CandidateProfile referenced by eligibility snapshot must be rejected by ON DELETE RESTRICT");

        // 4. Assert snapshot survives failed deletion attempts completely intact
        AllocationEligibilitySnapshot reloadedSnap = eligibilitySnapshots.findById(snapshotId).orElseThrow();
        assertEquals(runId, reloadedSnap.runId);
        assertEquals(candidateId, reloadedSnap.candidateId);
        assertEquals(EligibilityDecision.ELIGIBLE, reloadedSnap.decision);
        assertEquals("VERIFIED", reloadedSnap.evidenceStatusSnapshot);
        assertEquals(evidenceId, reloadedSnap.evidenceIdRef);

        // 5. Mutate the evidence record (e.g. revoke or reject later)
        tx.execute(status -> {
            CandidateEvidence ev = candidateEvidences.findById(evidenceId).orElseThrow();
            ev.verificationStatus = EvidenceStatus.REJECTED;
            ev.rejectionNotes = "Post-allocation audit discovered revocation.";
            candidateEvidences.saveAndFlush(ev);
            return null;
        });

        // 6. Verify snapshot point-in-time record is IMMUTABLE and NOT silently rewritten
        AllocationEligibilitySnapshot postMutationSnap = eligibilitySnapshots.findById(snapshotId).orElseThrow();
        assertEquals("VERIFIED", postMutationSnap.evidenceStatusSnapshot, "Snapshot evidence_status_snapshot must retain historical state 'VERIFIED' even if evidence table is mutated later");
        assertEquals(EligibilityDecision.ELIGIBLE, postMutationSnap.decision);
    }
}
