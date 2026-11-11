package in.nextalloc.service;

import java.time.LocalDate;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.OptimisticLockingFailureException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import com.fasterxml.jackson.databind.ObjectMapper;

import in.nextalloc.domain.AllocationEligibilitySnapshot;
import in.nextalloc.domain.AllocationRun;
import in.nextalloc.domain.CandidateAcademicRecord;
import in.nextalloc.domain.CandidateEvidence;
import in.nextalloc.domain.CandidateEvidenceCurrent;
import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.User;
import in.nextalloc.domain.enums.EligibilityDecision;
import in.nextalloc.domain.enums.EnrollmentStatus;
import in.nextalloc.domain.enums.EvidenceStatus;
import in.nextalloc.domain.enums.FinalYearStatus;
import in.nextalloc.domain.enums.Role;
import in.nextalloc.domain.enums.SignatoryRole;
import in.nextalloc.repo.AllocationEligibilitySnapshotRepository;
import in.nextalloc.repo.AllocationRunRepository;
import in.nextalloc.repo.CandidateAcademicRecordRepository;
import in.nextalloc.repo.CandidateEvidenceCurrentRepository;
import in.nextalloc.repo.CandidateEvidenceRepository;
import in.nextalloc.repo.CandidateProfileRepository;
import in.nextalloc.repo.UserRepository;
import in.nextalloc.security.JwtService;
import in.nextalloc.web.dto.AcademicReviewDecision;
import in.nextalloc.web.dto.AcademicReviewInput;
import in.nextalloc.web.dto.CandidateAcademicInput;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Phase 4A-2C Commit 3B: Database-Enforced Optimistic Concurrency (@Version) Tests")
public class CandidateAcademicConcurrencyTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private UserRepository userRepo;

    @Autowired
    private CandidateProfileRepository profileRepo;

    @Autowired
    private CandidateAcademicRecordRepository academicRepo;

    @Autowired
    private CandidateEvidenceRepository evidenceRepo;

    @Autowired
    private CandidateEvidenceCurrentRepository currentEvidenceRepo;

    @Autowired
    private AllocationEligibilitySnapshotRepository snapshotRepo;

    @Autowired
    private AllocationRunRepository runRepo;

    @Autowired
    private PlatformTransactionManager transactionManager;

    @Autowired
    private ObjectMapper objectMapper;

    private User candidateUser;
    private CandidateProfile profile;
    private String candidateToken;

    private User adminUser1;
    private String adminToken1;

    private User adminUser2;
    private String adminToken2;

    @BeforeEach
    void setUp() {
        academicRepo.deleteAll();
        currentEvidenceRepo.deleteAll();
        evidenceRepo.deleteAll();

        candidateUser = new User();
        candidateUser.email = "cand-occ-" + UUID.randomUUID() + "@test.in";
        candidateUser.passwordHash = "hash1";
        candidateUser.name = "OCC Candidate";
        candidateUser.role = Role.CANDIDATE;
        candidateUser = userRepo.save(candidateUser);

        profile = new CandidateProfile();
        profile.userId = candidateUser.id;
        profile.fullName = "OCC Candidate";
        profile.phone = "9876543210";
        profile = profileRepo.save(profile);
        candidateToken = jwtService.issue(candidateUser.id, candidateUser.email, candidateUser.name, "CANDIDATE");

        adminUser1 = new User();
        adminUser1.email = "admin1-occ-" + UUID.randomUUID() + "@test.in";
        adminUser1.passwordHash = "hashadmin1";
        adminUser1.name = "OCC Admin One";
        adminUser1.role = Role.ADMIN;
        adminUser1 = userRepo.save(adminUser1);
        adminToken1 = jwtService.issue(adminUser1.id, adminUser1.email, adminUser1.name, "ADMIN");

        adminUser2 = new User();
        adminUser2.email = "admin2-occ-" + UUID.randomUUID() + "@test.in";
        adminUser2.passwordHash = "hashadmin2";
        adminUser2.name = "OCC Admin Two";
        adminUser2.role = Role.ADMIN;
        adminUser2 = userRepo.save(adminUser2);
        adminToken2 = jwtService.issue(adminUser2.id, adminUser2.email, adminUser2.name, "ADMIN");
    }

    private CandidateAcademicRecord seedRecord(CandidateProfile p) {
        CandidateAcademicRecord ar = new CandidateAcademicRecord();
        ar.candidateId = p.id;
        ar.enrollmentStatus = EnrollmentStatus.ENROLLED_FULL_TIME;
        ar.degreeProgram = "B.Tech Computer Science";
        ar.institutionName = "IIT Delhi";
        ar.institutionAisheCode = "U-0001";
        ar.currentAcademicYear = 4;
        ar.programDurationYears = 4;
        ar.finalYearStatus = FinalYearStatus.CLAIMED_FINAL_YEAR;
        ar.expectedCompletionDate = LocalDate.of(2026, 6, 30);
        return academicRepo.save(ar);
    }

    private CandidateEvidence seedNoc(CandidateProfile p) {
        CandidateEvidence ev = new CandidateEvidence();
        ev.candidateId = p.id;
        ev.evidenceType = EvidenceService.EVIDENCE_TYPE_NOC;
        ev.documentReference = "noc/occ-test-" + UUID.randomUUID() + ".pdf";
        ev.documentSha256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        ev.issuingInstitution = "IIT Delhi";
        ev.signatoryRole = SignatoryRole.PRINCIPAL;
        ev.signatoryName = "Dr. Director";
        ev.signatoryEmail = "director@iitd.ac.in";
        ev.declaresNoAcademicConflict = true;
        ev.verificationStatus = EvidenceStatus.SUBMITTED;
        ev = evidenceRepo.save(ev);

        CandidateEvidenceCurrent cur = new CandidateEvidenceCurrent(p.id, EvidenceService.EVIDENCE_TYPE_NOC, ev.id);
        currentEvidenceRepo.save(cur);
        return ev;
    }

    @Test
    @DisplayName("Gate E Scenario 1: Two concurrent database transactions on same entity — second transaction fails with OptimisticLockingFailureException")
    void twoConcurrentTransactions_secondFailsWithOptimisticLockException() throws Exception {
        CandidateAcademicRecord initial = seedRecord(profile);
        assertNotNull(initial.version, "JPA @Version must be initialized on save");
        assertEquals(0L, initial.version, "Initial version must be 0");

        TransactionTemplate tx1 = new TransactionTemplate(transactionManager);
        tx1.setPropagationBehavior(TransactionTemplate.PROPAGATION_REQUIRES_NEW);

        TransactionTemplate tx2 = new TransactionTemplate(transactionManager);
        tx2.setPropagationBehavior(TransactionTemplate.PROPAGATION_REQUIRES_NEW);

        CountDownLatch tx1Ready = new CountDownLatch(1);
        CountDownLatch tx2Ready = new CountDownLatch(1);
        CountDownLatch tx1Done = new CountDownLatch(1);

        AtomicBoolean tx2FailedWithLockException = new AtomicBoolean(false);

        Thread thread1 = new Thread(() -> {
            tx1.execute(status -> {
                CandidateAcademicRecord r1 = academicRepo.findByCandidateId(profile.id).orElseThrow();
                tx1Ready.countDown();
                try {
                    tx2Ready.await(5, TimeUnit.SECONDS);
                } catch (InterruptedException ignored) {}
                r1.degreeProgram = "B.Tech Electrical Engineering";
                r1.touch();
                academicRepo.save(r1);
                return null;
            });
            tx1Done.countDown();
        });

        Thread thread2 = new Thread(() -> {
            try {
                tx1Ready.await(5, TimeUnit.SECONDS);
            } catch (InterruptedException ignored) {}

            try {
                tx2.execute(status -> {
                    CandidateAcademicRecord r2 = academicRepo.findByCandidateId(profile.id).orElseThrow();
                    tx2Ready.countDown();
                    try {
                        tx1Done.await(5, TimeUnit.SECONDS);
                    } catch (InterruptedException ignored) {}

                    r2.degreeProgram = "B.Tech Mechanical Engineering";
                    r2.touch();
                    academicRepo.saveAndFlush(r2);
                    return null;
                });
            } catch (OptimisticLockingFailureException ex) {
                tx2FailedWithLockException.set(true);
            }
        });

        thread1.start();
        thread2.start();

        thread1.join(10000);
        thread2.join(10000);

        assertTrue(tx2FailedWithLockException.get(),
                "Transaction 2 must throw OptimisticLockingFailureException when updating a stale version");

        CandidateAcademicRecord finalRecord = academicRepo.findByCandidateId(profile.id).orElseThrow();
        assertEquals("B.Tech Electrical Engineering", finalRecord.degreeProgram,
                "Final record must reflect Transaction 1 update (no lost update)");
        assertEquals(1L, finalRecord.version, "Version must advance to 1");
    }

    @Test
    @DisplayName("Gate E Scenario 2: Candidate vs Administrator — candidate updates details while admin prepares review; admin review rejected with 409 Conflict")
    void candidateUpdateInvalidatesAdminStaleReview() throws Exception {
        CandidateAcademicRecord ar = seedRecord(profile);
        CandidateEvidence noc = seedNoc(profile);
        assertEquals(0L, ar.version);

        // 1. Admin reads current state (version 0)
        mockMvc.perform(get("/api/admin/candidates/" + profile.id + "/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(0));

        // 2. Candidate changes their institution via self-service PUT
        CandidateAcademicInput candInput = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.Tech Computer Science",
                "IIT Bombay", // Changed institution
                "U-0002",
                4,
                4,
                LocalDate.of(2026, 6, 30),
                0L
        );

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + candidateToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(candInput)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1))
                .andExpect(jsonPath("$.institutionName").value("IIT Bombay"));

        // 3. Admin submits approval using stale expectedVersion = 0
        AcademicReviewInput adminInput = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Approve based on IIT Delhi inspection",
                noc.id,
                ar.updatedAt,
                0L // Stale version!
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(adminInput)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("Stale academic record")));

        // 4. Verify candidate's update was not overwritten and status was not falsely approved
        CandidateAcademicRecord current = academicRepo.findByCandidateId(profile.id).orElseThrow();
        assertEquals("IIT Bombay", current.institutionName);
        assertEquals(FinalYearStatus.CLAIMED_FINAL_YEAR, current.finalYearStatus);
        assertEquals(1L, current.version);
    }

    @Test
    @DisplayName("Gate E Scenario 3: Two Administrators — Admin 1 approves, Admin 2 concurrently attempts stale review; Admin 2 receives 409 Conflict")
    void twoAdministrators_concurrentReviews_secondReceivesConflict() throws Exception {
        CandidateAcademicRecord ar = seedRecord(profile);
        CandidateEvidence noc = seedNoc(profile);
        assertEquals(0L, ar.version);

        // Admin 1 approves with expectedVersion = 0
        AcademicReviewInput review1 = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Admin 1 approves final year",
                noc.id,
                ar.updatedAt,
                0L
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(review1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.finalYearStatus").value("VERIFIED_FINAL_YEAR"))
                .andExpect(jsonPath("$.version").value(1));

        // Admin 2 attempts reject using stale expectedVersion = 0
        AcademicReviewInput review2 = new AcademicReviewInput(
                AcademicReviewDecision.REJECT,
                "Admin 2 rejects based on stale view",
                noc.id,
                ar.updatedAt,
                0L
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken2)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(review2)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409));

        // Outcome: Admin 1's decision remains authoritative
        CandidateAcademicRecord current = academicRepo.findByCandidateId(profile.id).orElseThrow();
        assertEquals(FinalYearStatus.VERIFIED_FINAL_YEAR, current.finalYearStatus);
        assertEquals(1L, current.version);
    }

    @Test
    @DisplayName("Gate E Scenario 4: Fresh application data — initial creation assigns valid version 0")
    void freshApplicationData_initialCreationAssignsVersionZero() throws Exception {
        CandidateAcademicInput input = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.Sc Physics",
                "St. Stephen's College",
                "U-1122",
                3,
                3,
                LocalDate.of(2026, 5, 31)
        );

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + candidateToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(0))
                .andExpect(jsonPath("$.finalYearStatus").value("CLAIMED_FINAL_YEAR"));

        CandidateAcademicRecord rec = academicRepo.findByCandidateId(profile.id).orElseThrow();
        assertNotNull(rec.version);
        assertEquals(0L, rec.version);
    }

    @Test
    @DisplayName("Gate E Scenario 5: Existing Migrated Data — records with version 0 update and advance version correctly")
    void migratedData_canBeRetrievedUpdatedAndVerified() throws Exception {
        // Simulate a pre-existing record migrated with version = 0
        CandidateAcademicRecord ar = seedRecord(profile);
        CandidateEvidence noc = seedNoc(profile);
        assertEquals(0L, ar.version);

        // Candidate performs an update
        CandidateAcademicInput update = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.Tech Computer Science",
                "IIT Delhi",
                "U-0001",
                4,
                4,
                LocalDate.of(2026, 7, 15),
                0L
        );

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + candidateToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(update)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(1));

        // Admin verifies with expectedVersion = 1
        AcademicReviewInput review = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Admin verification after update",
                noc.id,
                null,
                1L
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(review)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.version").value(2))
                .andExpect(jsonPath("$.finalYearStatus").value("VERIFIED_FINAL_YEAR"));

        CandidateAcademicRecord saved = academicRepo.findByCandidateId(profile.id).orElseThrow();
        assertEquals(2L, saved.version);
    }

    @Test
    @DisplayName("Gate E Scenario 6: Historical Preservation — rejected concurrent review does not modify snapshots or evidence")
    void historicalPreservation_rejectedConcurrentReviewDoesNotModifySnapshotsOrEvidence() throws Exception {
        CandidateAcademicRecord ar = seedRecord(profile);
        CandidateEvidence noc = seedNoc(profile);

        AllocationRun run = new AllocationRun();
        run.scenario = in.nextalloc.domain.enums.ScenarioKey.STANDARD_SHOWCASE;
        run.status = in.nextalloc.domain.enums.RunStatus.COMPLETED;
        run.policyKey = "balanced";
        run.policyName = "Balanced";
        run.policyVersion = "v2";
        run.weightsJson = "{}";
        run.number = 1;
        run.snapshotId = 1L;
        run.runCode = "RUN-HIST-OCC-" + UUID.randomUUID().toString().substring(0, 8);
        run = runRepo.save(run);

        AllocationEligibilitySnapshot snapshot = new AllocationEligibilitySnapshot();
        snapshot.runId = run.id;
        snapshot.candidateId = profile.id;
        snapshot.decision = EligibilityDecision.INELIGIBLE;
        snapshot.reasonCodesJson = "[\"ACADEMIC_STANDING_UNVERIFIED\"]";
        snapshot.evidenceIdRef = noc.id;
        snapshot.evidenceStatusSnapshot = "SUBMITTED";
        snapshot.evaluatedAt = java.time.Instant.now();
        snapshotRepo.save(snapshot);

        // Attempt review with stale expectedVersion = 999
        AcademicReviewInput review = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Stale attempt",
                noc.id,
                ar.updatedAt,
                999L
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(review)))
                .andExpect(status().isConflict());

        // Snapshot is completely unchanged
        AllocationEligibilitySnapshot currentSnapshot = snapshotRepo.findById(snapshot.id).orElseThrow();
        assertEquals(EligibilityDecision.INELIGIBLE, currentSnapshot.decision);
        assertEquals("SUBMITTED", currentSnapshot.evidenceStatusSnapshot);

        // Evidence and current pointer are completely unchanged
        CandidateEvidence currentNoc = evidenceRepo.findById(noc.id).orElseThrow();
        assertEquals(EvidenceStatus.SUBMITTED, currentNoc.verificationStatus);

        CandidateEvidenceCurrent currentPointer = currentEvidenceRepo
                .findByCandidateIdAndEvidenceType(profile.id, EvidenceService.EVIDENCE_TYPE_NOC)
                .orElseThrow();
        assertEquals(noc.id, currentPointer.evidenceId);
    }
}
