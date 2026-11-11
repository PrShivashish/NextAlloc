package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;

import java.time.LocalDate;
import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;

import in.nextalloc.common.ApiException;
import in.nextalloc.domain.*;
import in.nextalloc.domain.enums.*;
import in.nextalloc.repo.*;
import in.nextalloc.security.AuthUser;

@SpringBootTest
@DisplayName("Scenario Lifecycle Integrity & Deletion Protection Test")
public class ScenarioLifecycleIntegrityTest {

    @Autowired
    private ScenarioService scenarioService;

    @Autowired
    private AllocationService allocationService;

    @Autowired
    private AllocationRunRepository runRepo;

    @Autowired
    private AllocationEligibilitySnapshotRepository eligSnapshotRepo;

    @Autowired
    private CandidateProfileRepository profileRepo;

    @Autowired
    private DatasetSnapshotRepository snapshotRepo;

    @Autowired
    private AssignmentRepository assignmentRepo;

    @Autowired
    private OpportunityRepository oppRepo;

    @Autowired
    private CandidateEvidenceRepository evidenceRepo;

    @Autowired
    private CandidateAcademicRecordRepository academicRepo;

    @Autowired
    private CandidateRelatedSkillRepository relatedSkillRepo;

    private AuthUser adminUser;

    @BeforeEach
    void setUp() {
        adminUser = new AuthUser(1L, "admin@pragati.gov.in", "Shivashish Prusty", "ADMIN");
    }

    private void cleanBaseline() {
        eligSnapshotRepo.deleteAll();
        evidenceRepo.deleteAll();
        academicRepo.deleteAll();
        relatedSkillRepo.deleteAll();
        assignmentRepo.deleteAll();
        runRepo.deleteAll();
    }

    @Test
    @DisplayName("Gate 4 / Baseline: Full Scenario Lifecycle & Immutable Decision Preservation")
    void testScenarioLifecycle_andHistoricalDecisionPreservation() {
        cleanBaseline();

        // 1. Initial scenario loading succeeds
        DatasetSnapshot ds1 = scenarioService.load(ScenarioKey.MICRO_CONFLICT, adminUser);
        assertNotNull(ds1, "Requirement 1 & 8: Initial scenario loading on clean state must succeed");
        assertEquals(4, ds1.candidateCount);
        assertEquals(2, ds1.opportunityCount);

        // 2. Initial allocation succeeds
        AllocationService.StartRunRequest req = new AllocationService.StartRunRequest(
                "balanced", null, false, 0, "v2",
                EligibilityEvaluator.RULESET_PMIS_2026_DEMO, "1.0.0");
        AllocationRun run = allocationService.prepareRun(req, null, null, adminUser);
        run.status = RunStatus.COMPLETED;
        run = runRepo.save(run);

        CandidateProfile cand = profileRepo.findAll().stream().findFirst().orElseThrow();
        Opportunity opp = oppRepo.findAll().stream().findFirst().orElseThrow();

        // Create assignment and snapshot
        Assignment assignment = new Assignment();
        assignment.runId = run.id;
        assignment.candidateId = cand.id;
        assignment.opportunityId = opp.id;
        assignment.source = AssignmentSource.GLOBAL;
        assignment = assignmentRepo.save(assignment);

        AllocationEligibilitySnapshot snap = new AllocationEligibilitySnapshot();
        snap.runId = run.id;
        snap.candidateId = cand.id;
        snap.decision = EligibilityDecision.ELIGIBLE;
        snap.evidenceStatusSnapshot = "VERIFIED";
        snap = eligSnapshotRepo.save(snap);

        long beforeRunCount = runRepo.count();
        long beforeSnapCount = eligSnapshotRepo.count();
        long beforeAssignmentCount = assignmentRepo.count();
        long beforeCandidateCount = profileRepo.count();
        long beforeOpportunityCount = oppRepo.count();

        assertEquals(1, beforeSnapCount, "Requirement 3: Eligibility snapshot exists");
        assertEquals(1, beforeAssignmentCount, "Requirement 5: Historical assignment exists");

        // 4. Conflicting reload attempt is rejected safely BEFORE destructive operations
        ApiException ex = assertThrows(ApiException.class, () -> {
            scenarioService.load(ScenarioKey.MICRO_CONFLICT, adminUser);
        });

        assertEquals(HttpStatus.CONFLICT, ex.getStatus(), "Requirement 4: Must return HTTP 409 Conflict");
        assertTrue(ex.getMessage().contains("Cannot reload or reset demonstration scenarios while historical"),
                "Requirement 4: Error message must explain that historical decisions are preserved");

        // Attempting to load a DIFFERENT scenario is also rejected safely
        ApiException exDifferent = assertThrows(ApiException.class, () -> {
            scenarioService.load(ScenarioKey.STANDARD_SHOWCASE, adminUser);
        });
        assertEquals(HttpStatus.CONFLICT, exDifferent.getStatus(), "Requirement 4: Loading different scenario must also return 409");

        // 5 & 6. Verify zero data deleted or modified
        assertEquals(beforeSnapCount, eligSnapshotRepo.count(), "Requirement 6: Zero snapshots deleted");
        assertEquals(beforeAssignmentCount, assignmentRepo.count(), "Requirement 5: Zero assignments deleted");
        assertEquals(beforeRunCount, runRepo.count(), "Historical allocation runs preserved");
        assertEquals(beforeCandidateCount, profileRepo.count(), "Requirement 7: Candidate count unchanged (no partial deletion)");
        assertEquals(beforeOpportunityCount, oppRepo.count(), "Requirement 7: Opportunity count unchanged (no partial deletion)");

        // Verify snapshot values completely intact
        AllocationEligibilitySnapshot preservedSnap = eligSnapshotRepo.findById(snap.id).orElseThrow();
        assertEquals(EligibilityDecision.ELIGIBLE, preservedSnap.decision);
        assertEquals("VERIFIED", preservedSnap.evidenceStatusSnapshot);
        assertEquals(run.id, preservedSnap.runId);

        // Verify assignment values completely intact
        Assignment preservedAssign = assignmentRepo.findById(assignment.id).orElseThrow();
        assertEquals(run.id, preservedAssign.runId);
        assertEquals(cand.id, preservedAssign.candidateId);
    }

    @Test
    @DisplayName("Check A: Completed legacy allocation run without snapshots is safely protected from scenario reset")
    void testCheckA_legacyRunWithoutSnapshotsIsProtected() {
        cleanBaseline();

        // 1. Clean load scenario
        DatasetSnapshot ds = scenarioService.load(ScenarioKey.MICRO_CONFLICT, adminUser);
        assertNotNull(ds);

        // 2. Simulate a legacy completed run with assignments but NO eligibility snapshots
        AllocationService.StartRunRequest req = new AllocationService.StartRunRequest(
                "balanced", null, false, 0, "v1",
                EligibilityEvaluator.RULESET_LEGACY, "1.0.0");
        AllocationRun legacyRun = allocationService.prepareRun(req, null, null, adminUser);
        legacyRun.status = RunStatus.COMPLETED;
        legacyRun = runRepo.save(legacyRun);

        CandidateProfile cand = profileRepo.findAll().stream().findFirst().orElseThrow();
        Opportunity opp = oppRepo.findAll().stream().findFirst().orElseThrow();

        Assignment legacyAssign = new Assignment();
        legacyAssign.runId = legacyRun.id;
        legacyAssign.candidateId = cand.id;
        legacyAssign.opportunityId = opp.id;
        legacyAssign.source = AssignmentSource.GLOBAL;
        legacyAssign = assignmentRepo.save(legacyAssign);

        assertEquals(0, eligSnapshotRepo.count(), "Precondition: zero eligibility snapshots exist");
        assertEquals(1, runRepo.count(), "Precondition: 1 legacy run exists");
        assertEquals(1, assignmentRepo.count(), "Precondition: 1 legacy assignment exists");

        // 3. Attempt to reload scenario: must be rejected with HTTP 409 Conflict
        ApiException ex = assertThrows(ApiException.class, () -> {
            scenarioService.load(ScenarioKey.MICRO_CONFLICT, adminUser);
        });

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("Cannot reload or reset demonstration scenarios while historical allocation runs exist"),
                "Message must clearly explain legacy runs are protected");

        // 4. Verify legacy records were NOT destroyed
        assertEquals(1, runRepo.count(), "Legacy allocation run must remain preserved");
        assertEquals(1, assignmentRepo.count(), "Legacy assignment must remain preserved");
        assertEquals(legacyRun.id, assignmentRepo.findAll().get(0).runId);
    }

    @Test
    @DisplayName("Check B: Candidate-submitted academic & NOC evidence without allocation runs is protected from scenario reset")
    void testCheckB_candidateEvidenceWithoutRunsIsProtected() {
        cleanBaseline();

        // 1. Clean load scenario
        DatasetSnapshot ds = scenarioService.load(ScenarioKey.MICRO_CONFLICT, adminUser);
        assertNotNull(ds);

        // 2. Candidate submits academic record & NOC evidence (no allocation run yet)
        CandidateProfile cand = profileRepo.findAll().stream().findFirst().orElseThrow();

        CandidateAcademicRecord acad = new CandidateAcademicRecord();
        acad.candidateId = cand.id;
        acad.enrollmentStatus = EnrollmentStatus.ENROLLED_FULL_TIME;
        acad.finalYearStatus = FinalYearStatus.VERIFIED_FINAL_YEAR;
        acad = academicRepo.save(acad);

        CandidateEvidence noc = new CandidateEvidence();
        noc.candidateId = cand.id;
        noc.evidenceType = "INSTITUTIONAL_NOC";
        noc.documentReference = "NOC-UPLOAD-4A2C.pdf";
        noc.signatoryRole = SignatoryRole.PRINCIPAL;
        noc.verificationStatus = EvidenceStatus.SUBMITTED;
        noc = evidenceRepo.save(noc);

        assertEquals(0, runRepo.count(), "Precondition: zero allocation runs exist");
        assertEquals(0, eligSnapshotRepo.count(), "Precondition: zero snapshots exist");
        assertEquals(1, academicRepo.count(), "Precondition: 1 academic record exists");
        assertEquals(1, evidenceRepo.count(), "Precondition: 1 NOC evidence exists");

        // 3. Attempt to reload scenario: must be rejected with HTTP 409 Conflict
        ApiException ex = assertThrows(ApiException.class, () -> {
            scenarioService.load(ScenarioKey.MICRO_CONFLICT, adminUser);
        });

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("Cannot reload or reset demonstration scenarios while applicant academic or NOC evidence exists"),
                "Message must clearly explain applicant evidence is protected");

        // 4. Verify candidate evidence was NOT cascaded, deleted, or orphaned
        assertEquals(1, academicRepo.count(), "Academic record must remain preserved");
        assertEquals(1, evidenceRepo.count(), "NOC evidence document record must remain preserved");
        assertEquals(cand.id, evidenceRepo.findAll().get(0).candidateId);
        assertEquals("NOC-UPLOAD-4A2C.pdf", evidenceRepo.findAll().get(0).documentReference);
    }

    @Test
    @DisplayName("Check C & D: Clean scenario reloading works and switching before runs is permitted")
    void testCheckCD_cleanScenarioSwitchingPermittedBeforeRunsOrEvidence() {
        cleanBaseline();

        // 1. Clean load MICRO_CONFLICT
        DatasetSnapshot ds1 = scenarioService.load(ScenarioKey.MICRO_CONFLICT, adminUser);
        assertEquals(4, ds1.candidateCount);
        assertEquals(2, ds1.opportunityCount);

        // 2. Without running allocations or submitting candidate evidence, switching scenarios is permitted
        DatasetSnapshot ds2 = scenarioService.load(ScenarioKey.STANDARD_SHOWCASE, adminUser);
        assertNotNull(ds2);
        assertTrue(ds2.candidateCount > 4, "Showcase scenario loaded cleanly");

        // 3. Verify clean state transitions
        assertEquals(0, runRepo.count());
        assertEquals(0, eligSnapshotRepo.count());
        assertEquals(0, evidenceRepo.count());
        assertEquals(0, relatedSkillRepo.count());
    }

    @Test
    @DisplayName("Check E: Candidate-submitted related skills without allocation runs is protected from scenario reset")
    void testCheckE_candidateRelatedSkillsWithoutRunsIsProtected() {
        cleanBaseline();

        // 1. Clean load scenario
        DatasetSnapshot ds = scenarioService.load(ScenarioKey.MICRO_CONFLICT, adminUser);
        assertNotNull(ds);

        // 2. Candidate submits related skill claim
        CandidateProfile cand = profileRepo.findAll().stream().findFirst().orElseThrow();

        CandidateRelatedSkill relSkill = new CandidateRelatedSkill();
        relSkill.candidateId = cand.id;
        relSkill.rawLabel = "Spring Boot";
        relSkill.conceptId = "CONCEPT-REL-SPRING_BOOT";
        relSkill.relatedCanonical = "Java";
        relSkill.relationshipType = "FRAMEWORK";
        relSkill.taxonomyVersion = SkillTaxonomy.TAXONOMY_VERSION;
        relSkill.claimSource = SkillClaimSource.SELF_DECLARED;
        relSkill.evidenceStatus = SkillEvidenceStatus.UNVERIFIED;
        relSkill = relatedSkillRepo.save(relSkill);

        assertEquals(0, runRepo.count(), "Precondition: zero allocation runs exist");
        assertEquals(0, eligSnapshotRepo.count(), "Precondition: zero snapshots exist");
        assertEquals(1, relatedSkillRepo.count(), "Precondition: 1 related skill claim exists");

        // 3. Attempt to reload scenario: must be rejected with HTTP 409 Conflict
        ApiException ex = assertThrows(ApiException.class, () -> {
            scenarioService.load(ScenarioKey.MICRO_CONFLICT, adminUser);
        });

        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("Cannot reload or reset demonstration scenarios while candidate-submitted related skill records exist"),
                "Message must clearly explain related skill records are protected");

        // 4. Verify candidate related skill was NOT cascaded, deleted, or orphaned
        assertEquals(1, relatedSkillRepo.count(), "Related skill record must remain preserved");
        assertEquals(cand.id, relatedSkillRepo.findAll().get(0).candidateId);
        assertEquals("CONCEPT-REL-SPRING_BOOT", relatedSkillRepo.findAll().get(0).conceptId);
    }
}
