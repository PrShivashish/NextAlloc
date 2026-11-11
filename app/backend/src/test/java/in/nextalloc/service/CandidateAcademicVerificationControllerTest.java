package in.nextalloc.service;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.ObjectMapper;

import in.nextalloc.domain.AllocationEligibilitySnapshot;
import in.nextalloc.domain.AllocationRun;
import in.nextalloc.domain.AuditEvent;
import in.nextalloc.domain.CandidateAcademicRecord;
import in.nextalloc.domain.CandidateEvidence;
import in.nextalloc.domain.CandidateEvidenceCurrent;
import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.User;
import in.nextalloc.domain.enums.AuditAction;
import in.nextalloc.domain.enums.EligibilityDecision;
import in.nextalloc.domain.enums.EligibilityReasonCode;
import in.nextalloc.domain.enums.EnrollmentStatus;
import in.nextalloc.domain.enums.EvidenceStatus;
import in.nextalloc.domain.enums.FinalYearStatus;
import in.nextalloc.domain.enums.Role;
import in.nextalloc.domain.enums.SignatoryRole;
import in.nextalloc.repo.AllocationEligibilitySnapshotRepository;
import in.nextalloc.repo.AllocationRunRepository;
import in.nextalloc.repo.AuditEventRepository;
import in.nextalloc.repo.CandidateAcademicRecordRepository;
import in.nextalloc.repo.CandidateEvidenceCurrentRepository;
import in.nextalloc.repo.CandidateEvidenceRepository;
import in.nextalloc.repo.CandidateProfileRepository;
import in.nextalloc.repo.UserRepository;
import in.nextalloc.security.JwtService;
import in.nextalloc.web.dto.AcademicReviewDecision;
import in.nextalloc.web.dto.AcademicReviewInput;
import in.nextalloc.web.dto.AcademicReviewResponseDto;
import in.nextalloc.web.dto.CandidateAcademicDetailDto;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Phase 4A-2C Commit 3B: Administrator Academic Verification & Integrity Tests")
public class CandidateAcademicVerificationControllerTest {

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
    private AuditEventRepository auditRepo;

    @Autowired
    private AllocationEligibilitySnapshotRepository snapshotRepo;

    @Autowired
    private AllocationRunRepository runRepo;

    @Autowired
    private EligibilityEvaluator eligibilityEvaluator;

    @Autowired
    private ObjectMapper objectMapper;

    private User candUser1;
    private CandidateProfile profile1;
    private String candidateToken;

    private User adminUser;
    private String adminToken;

    @BeforeEach
    void setUp() {
        academicRepo.deleteAll();
        currentEvidenceRepo.deleteAll();
        evidenceRepo.deleteAll();

        candUser1 = new User();
        candUser1.email = "admin-review-cand-" + UUID.randomUUID() + "@test.in";
        candUser1.passwordHash = "hash1";
        candUser1.name = "Review Test Candidate";
        candUser1.role = Role.CANDIDATE;
        candUser1 = userRepo.save(candUser1);

        profile1 = new CandidateProfile();
        profile1.userId = candUser1.id;
        profile1.fullName = "Review Test Candidate";
        profile1.phone = "9876543210";
        profile1 = profileRepo.save(profile1);
        candidateToken = jwtService.issue(candUser1.id, candUser1.email, candUser1.name, "CANDIDATE");

        adminUser = new User();
        adminUser.email = "admin-reviewer-" + UUID.randomUUID() + "@test.in";
        adminUser.passwordHash = "adminhash";
        adminUser.name = "Academic Reviewer Admin";
        adminUser.role = Role.ADMIN;
        adminUser = userRepo.save(adminUser);
        adminToken = jwtService.issue(adminUser.id, adminUser.email, adminUser.name, "ADMIN");
    }

    private CandidateAcademicRecord seedClaimedFinalYear(CandidateProfile profile) {
        CandidateAcademicRecord ar = new CandidateAcademicRecord();
        ar.candidateId = profile.id;
        ar.enrollmentStatus = EnrollmentStatus.ENROLLED_FULL_TIME;
        ar.degreeProgram = "B.Tech Computer Science";
        ar.institutionName = "National Institute of Technology";
        ar.institutionAisheCode = "U-55555";
        ar.currentAcademicYear = 4;
        ar.programDurationYears = 4;
        ar.finalYearStatus = FinalYearStatus.CLAIMED_FINAL_YEAR;
        ar.expectedCompletionDate = LocalDate.of(2026, 6, 30);
        return academicRepo.save(ar);
    }

    private CandidateEvidence seedInstitutionalNoc(CandidateProfile profile, EvidenceStatus status) {
        CandidateEvidence ev = new CandidateEvidence();
        ev.candidateId = profile.id;
        ev.evidenceType = EvidenceService.EVIDENCE_TYPE_NOC;
        ev.documentReference = "noc/test-" + UUID.randomUUID() + ".pdf";
        ev.documentSha256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        ev.issuingInstitution = "National Institute of Technology";
        ev.signatoryRole = SignatoryRole.PRINCIPAL;
        ev.signatoryName = "Dr. Test Principal";
        ev.signatoryEmail = "principal@nit.ac.in";
        ev.declaresNoAcademicConflict = true;
        ev.verificationStatus = status;
        ev = evidenceRepo.save(ev);

        CandidateEvidenceCurrent cur = new CandidateEvidenceCurrent(profile.id, EvidenceService.EVIDENCE_TYPE_NOC, ev.id);
        currentEvidenceRepo.save(cur);

        return ev;
    }

    @Test
    @DisplayName("Case 1: Authorized administrator approves valid record with supporting NOC -> VERIFIED_FINAL_YEAR")
    void authorizedAdminApprovesValidRecord() throws Exception {
        CandidateAcademicRecord ar = seedClaimedFinalYear(profile1);
        CandidateEvidence noc = seedInstitutionalNoc(profile1, EvidenceStatus.SUBMITTED);

        AcademicReviewInput input = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Approved after reviewing institutional NOC consistency.",
                noc.id,
                ar.updatedAt,
                ar.version
        );

        MvcResult res = mockMvc.perform(post("/api/admin/candidates/" + profile1.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.finalYearStatus").value("VERIFIED_FINAL_YEAR"))
                .andExpect(jsonPath("$.supportingEvidenceId").value(noc.id))
                .andExpect(jsonPath("$.reviewerName").value("Academic Reviewer Admin"))
                .andReturn();

        AcademicReviewResponseDto dto = objectMapper.readValue(res.getResponse().getContentAsString(), AcademicReviewResponseDto.class);
        assertEquals(FinalYearStatus.VERIFIED_FINAL_YEAR, dto.finalYearStatus());

        CandidateAcademicRecord saved = academicRepo.findByCandidateId(profile1.id).orElseThrow();
        assertEquals(FinalYearStatus.VERIFIED_FINAL_YEAR, saved.finalYearStatus);
    }

    @Test
    @DisplayName("Case 2: Candidate role attempting administrator verification is rejected (403 Forbidden)")
    void candidateRoleCannotExecuteAdminVerification() throws Exception {
        seedClaimedFinalYear(profile1);

        AcademicReviewInput input = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Candidate self-approval attempt",
                null,
                null,
                null
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile1.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + candidateToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Case 3: Unauthenticated request is rejected (401 Unauthorized)")
    void unauthenticatedRequestRejected() throws Exception {
        AcademicReviewInput input = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Unauthenticated attempt",
                null,
                null,
                null
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile1.id + "/academic/verify")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Case 4: Non-existent candidate ID returns 404 Not Found")
    void nonExistentCandidateReturns404() throws Exception {
        AcademicReviewInput input = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Review for missing candidate",
                null,
                null,
                null
        );

        mockMvc.perform(post("/api/admin/candidates/999999/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Case 5: Missing academic record returns 404 Not Found")
    void missingAcademicRecordReturns404() throws Exception {
        // profile1 exists, but no academic record seeded
        AcademicReviewInput input = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Review when record absent",
                null,
                null,
                null
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile1.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Case 6: Approval without supporting institutional NOC is rejected (400 Bad Request)")
    void approvalWithoutSupportingNocRejected() throws Exception {
        CandidateAcademicRecord ar = seedClaimedFinalYear(profile1);
        // No evidence seeded

        AcademicReviewInput input = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Attempting approval without NOC",
                null,
                ar.updatedAt,
                null
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile1.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("supporting institutional evidence")));
    }

    @Test
    @DisplayName("Case 7: Approval with REJECTED supporting NOC is rejected (400 Bad Request)")
    void approvalWithRejectedNocRejected() throws Exception {
        CandidateAcademicRecord ar = seedClaimedFinalYear(profile1);
        CandidateEvidence rejectedNoc = seedInstitutionalNoc(profile1, EvidenceStatus.REJECTED);

        AcademicReviewInput input = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Attempting approval with rejected NOC",
                rejectedNoc.id,
                ar.updatedAt,
                null
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile1.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("supporting institutional evidence is REJECTED")));
    }

    @Test
    @DisplayName("Case 8: Approval with another candidate's evidence is rejected (400 Bad Request)")
    void approvalWithOtherCandidateEvidenceRejected() throws Exception {
        CandidateAcademicRecord ar = seedClaimedFinalYear(profile1);

        // Seed evidence for another candidate
        User otherUser = new User();
        otherUser.email = "other-" + UUID.randomUUID() + "@test.in";
        otherUser.passwordHash = "hashother";
        otherUser.name = "Other User";
        otherUser.role = Role.CANDIDATE;
        otherUser = userRepo.save(otherUser);
        CandidateProfile otherProfile = new CandidateProfile();
        otherProfile.userId = otherUser.id;
        otherProfile.fullName = "Other Candidate";
        otherProfile = profileRepo.save(otherProfile);

        CandidateEvidence foreignNoc = seedInstitutionalNoc(otherProfile, EvidenceStatus.SUBMITTED);

        AcademicReviewInput input = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Attempting approval with foreign NOC",
                foreignNoc.id,
                ar.updatedAt,
                null
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile1.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("belongs to candidate ID")));
    }

    @Test
    @DisplayName("Case 9: Approval rejected if candidate is not in final year (year < duration)")
    void approvalRejectedIfCandidateNotInFinalYear() throws Exception {
        CandidateAcademicRecord ar = seedClaimedFinalYear(profile1);
        ar.currentAcademicYear = 2; // Year 2 of 4
        ar.touch();
        ar = academicRepo.save(ar);
        CandidateEvidence noc = seedInstitutionalNoc(profile1, EvidenceStatus.SUBMITTED);

        AcademicReviewInput input = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Attempting final-year approval on year 2 student",
                noc.id,
                ar.updatedAt,
                null
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile1.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("does not equal program duration")));
    }

    @Test
    @DisplayName("Case 10: Optimistic Concurrency Control — stale expectedUpdatedAt triggers 409 Conflict")
    void staleExpectedUpdatedAtTriggersConflict() throws Exception {
        CandidateAcademicRecord ar = seedClaimedFinalYear(profile1);
        CandidateEvidence noc = seedInstitutionalNoc(profile1, EvidenceStatus.SUBMITTED);

        Instant staleTimestamp = ar.updatedAt.minusSeconds(3600); // 1 hour stale

        AcademicReviewInput input = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Review with stale timestamp",
                noc.id,
                staleTimestamp,
                null
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile1.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value(org.hamcrest.Matchers.containsString("modified concurrently")));
    }

    @Test
    @DisplayName("Case 11: Optimistic Concurrency Control — concurrent candidate update invalidates reviewer approval")
    void concurrentCandidateUpdateInvalidatesReviewerApproval() throws Exception {
        CandidateAcademicRecord ar = seedClaimedFinalYear(profile1);
        CandidateEvidence noc = seedInstitutionalNoc(profile1, EvidenceStatus.SUBMITTED);

        Instant capturedTimestamp = ar.updatedAt;

        // Concurrent candidate action: candidate updates degree program
        ar.degreeProgram = "B.Tech Electrical";
        ar.touch();
        academicRepo.save(ar);

        // Admin submits review with old capturedTimestamp
        AcademicReviewInput input = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Admin approves stale declaration",
                noc.id,
                capturedTimestamp,
                null
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile1.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isConflict());

        // Academic record remains unapproved
        CandidateAcademicRecord current = academicRepo.findByCandidateId(profile1.id).orElseThrow();
        assertNotEquals(FinalYearStatus.VERIFIED_FINAL_YEAR, current.finalYearStatus);
    }

    @Test
    @DisplayName("Case 12: Controlled Non-Approval path — REJECT transitions to UNKNOWN (does not misuse VERIFIED_NOT_FINAL_YEAR)")
    void adminRejectionTransitionsToUnknown() throws Exception {
        CandidateAcademicRecord ar = seedClaimedFinalYear(profile1);

        AcademicReviewInput input = new AcademicReviewInput(
                AcademicReviewDecision.REJECT,
                "Supporting documents inconsistent with university registry.",
                null,
                ar.updatedAt,
                null
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile1.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.finalYearStatus").value("UNKNOWN"));

        CandidateAcademicRecord current = academicRepo.findByCandidateId(profile1.id).orElseThrow();
        assertEquals(FinalYearStatus.UNKNOWN, current.finalYearStatus);
    }

    @Test
    @DisplayName("Case 13: Authoritative Verification of Non-Final Year — VERIFY_NOT_FINAL_YEAR")
    void adminVerifiesNotFinalYear() throws Exception {
        CandidateAcademicRecord ar = seedClaimedFinalYear(profile1);

        AcademicReviewInput input = new AcademicReviewInput(
                AcademicReviewDecision.VERIFY_NOT_FINAL_YEAR,
                "Institutional inquiry confirms student is enrolled in 2nd semester (Year 1).",
                null,
                ar.updatedAt,
                null
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile1.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.finalYearStatus").value("VERIFIED_NOT_FINAL_YEAR"));

        CandidateAcademicRecord current = academicRepo.findByCandidateId(profile1.id).orElseThrow();
        assertEquals(FinalYearStatus.VERIFIED_NOT_FINAL_YEAR, current.finalYearStatus);
    }

    @Test
    @DisplayName("Case 14: Review action produces immutable audit log with ADMIN_ACTION and details")
    void auditEventLoggedOnVerification() throws Exception {
        CandidateAcademicRecord ar = seedClaimedFinalYear(profile1);
        CandidateEvidence noc = seedInstitutionalNoc(profile1, EvidenceStatus.SUBMITTED);

        AcademicReviewInput input = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Audited and approved.",
                noc.id,
                ar.updatedAt,
                null
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile1.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk());

        List<AuditEvent> events = auditRepo.findAll().stream()
                .filter(e -> e.action == AuditAction.ADMIN_ACTION && e.targetId.equals(ar.id.toString()))
                .toList();

        assertFalse(events.isEmpty(), "Audit log should record ADMIN_ACTION event");
        AuditEvent last = events.get(events.size() - 1);
        assertEquals(adminUser.name, last.actorName);
        assertTrue(last.summary.contains("VERIFIED_FINAL_YEAR"));
    }

    @Test
    @DisplayName("Case 15: Historical eligibility snapshots remain immutable across reviews")
    void snapshotsRemainImmutableAcrossReviews() throws Exception {
        CandidateAcademicRecord ar = seedClaimedFinalYear(profile1);
        CandidateEvidence noc = seedInstitutionalNoc(profile1, EvidenceStatus.SUBMITTED);

        AllocationRun testRun = new AllocationRun();
        testRun.scenario = in.nextalloc.domain.enums.ScenarioKey.STANDARD_SHOWCASE;
        testRun.status = in.nextalloc.domain.enums.RunStatus.COMPLETED;
        testRun.policyKey = "balanced";
        testRun.policyName = "Balanced";
        testRun.policyVersion = "v2";
        testRun.weightsJson = "{}";
        testRun.number = 1;
        testRun.snapshotId = 1L;
        testRun.runCode = "RUN-HIST-" + UUID.randomUUID().toString().substring(0, 8);
        testRun = runRepo.save(testRun);

        AllocationEligibilitySnapshot snap = new AllocationEligibilitySnapshot();
        snap.runId = testRun.id;
        snap.candidateId = profile1.id;
        snap.decision = EligibilityDecision.INELIGIBLE;
        snap.reasonCodesJson = "[\"ACADEMIC_STANDING_UNVERIFIED\"]";
        snap.evidenceIdRef = noc.id;
        snap.evidenceStatusSnapshot = "SUBMITTED";
        snap.evaluatedAt = Instant.now().minusSeconds(7200);
        snapshotRepo.save(snap);

        // Perform admin review
        AcademicReviewInput input = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Approved in run 2 cycle",
                noc.id,
                ar.updatedAt,
                null
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile1.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk());

        // Snapshot is completely unchanged
        AllocationEligibilitySnapshot loaded = snapshotRepo.findById(snap.id).orElseThrow();
        assertEquals(EligibilityDecision.INELIGIBLE, loaded.decision);
        assertEquals("[\"ACADEMIC_STANDING_UNVERIFIED\"]", loaded.reasonCodesJson);
        assertEquals("SUBMITTED", loaded.evidenceStatusSnapshot);
    }

    @Test
    @DisplayName("Case 16: Academic verification enables candidate eligibility in new allocation evaluation")
    void academicVerificationEnablesEligibility() throws Exception {
        CandidateAcademicRecord ar = seedClaimedFinalYear(profile1);
        CandidateEvidence noc = seedInstitutionalNoc(profile1, EvidenceStatus.VERIFIED);

        profile1.candidateState = in.nextalloc.domain.enums.CandidateState.ACTIVE;
        profile1.dob = LocalDate.of(2003, 1, 1);
        profile1.employmentType = in.nextalloc.domain.enums.EmploymentType.UNEMPLOYED;
        profileRepo.save(profile1);

        // 1. Before review: candidate has CLAIMED_FINAL_YEAR -> INELIGIBLE
        EligibilityEvaluator.CandidateEvaluation evalBefore = eligibilityEvaluator.evaluateCandidate(
                "pmis-2026-expansion-demo-v1",
                "1.0.0",
                profile1,
                ar,
                List.of(noc),
                LocalDate.of(2026, 5, 1)
        );
        assertFalse(evalBefore.isEligible());
        assertTrue(evalBefore.reasonCodes().contains(EligibilityReasonCode.ACADEMIC_STANDING_UNVERIFIED));

        // 2. Admin performs review -> APPROVE
        AcademicReviewInput input = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Authorized administrator verified final-year standing",
                noc.id,
                ar.updatedAt,
                null
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile1.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk());

        CandidateAcademicRecord updatedAr = academicRepo.findByCandidateId(profile1.id).orElseThrow();
        assertEquals(FinalYearStatus.VERIFIED_FINAL_YEAR, updatedAr.finalYearStatus);

        // 3. New evaluation: candidate is now ELIGIBLE
        EligibilityEvaluator.CandidateEvaluation evalAfter = eligibilityEvaluator.evaluateCandidate(
                "pmis-2026-expansion-demo-v1",
                "1.0.0",
                profile1,
                updatedAr,
                List.of(noc),
                LocalDate.of(2026, 5, 1)
        );
        assertTrue(evalAfter.isEligible(), "Candidate must be eligible after academic verification and verified NOC");
        assertEquals(EligibilityDecision.ELIGIBLE, evalAfter.decision());
        assertTrue(evalAfter.reasonCodes().contains(EligibilityReasonCode.ELIGIBLE));
    }

    @Test
    @DisplayName("Case 17: NOC and Academic verification are separate mandatory requirements")
    void nocAndAcademicVerificationAreSeparateRequirements() throws Exception {
        CandidateAcademicRecord ar = seedClaimedFinalYear(profile1);
        // NOC is unverified (SUBMITTED)
        CandidateEvidence unverifiedNoc = seedInstitutionalNoc(profile1, EvidenceStatus.SUBMITTED);

        profile1.candidateState = in.nextalloc.domain.enums.CandidateState.ACTIVE;
        profile1.dob = LocalDate.of(2003, 1, 1);
        profile1.employmentType = in.nextalloc.domain.enums.EmploymentType.UNEMPLOYED;
        profileRepo.save(profile1);

        // Admin verifies academic standing only
        AcademicReviewInput input = new AcademicReviewInput(
                AcademicReviewDecision.APPROVE,
                "Academic verified",
                unverifiedNoc.id,
                ar.updatedAt,
                null
        );

        mockMvc.perform(post("/api/admin/candidates/" + profile1.id + "/academic/verify")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk());

        CandidateAcademicRecord updatedAr = academicRepo.findByCandidateId(profile1.id).orElseThrow();
        assertEquals(FinalYearStatus.VERIFIED_FINAL_YEAR, updatedAr.finalYearStatus);

        // Evaluation: Academic is verified, but NOC is still unverified!
        EligibilityEvaluator.CandidateEvaluation eval = eligibilityEvaluator.evaluateCandidate(
                "pmis-2026-expansion-demo-v1",
                "1.0.0",
                profile1,
                updatedAr,
                List.of(unverifiedNoc),
                LocalDate.of(2026, 5, 1)
        );

        assertFalse(eval.isEligible(), "Candidate should NOT be eligible if NOC is unverified");
        assertTrue(eval.reasonCodes().contains(EligibilityReasonCode.INSTITUTIONAL_NOC_UNVERIFIED));
        assertFalse(eval.reasonCodes().contains(EligibilityReasonCode.ACADEMIC_STANDING_UNVERIFIED),
                "Academic standing should no longer be marked unverified");
    }

    @Test
    @DisplayName("Case 18: Administrator retrieves candidate academic detail with active NOC context")
    void adminRetrievesCandidateAcademicDetail() throws Exception {
        CandidateAcademicRecord ar = seedClaimedFinalYear(profile1);
        CandidateEvidence noc = seedInstitutionalNoc(profile1, EvidenceStatus.SUBMITTED);

        MvcResult res = mockMvc.perform(get("/api/admin/candidates/" + profile1.id + "/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.candidateId").value(profile1.id))
                .andExpect(jsonPath("$.candidateName").value("Review Test Candidate"))
                .andExpect(jsonPath("$.institutionName").value("National Institute of Technology"))
                .andExpect(jsonPath("$.activeNocEvidenceId").value(noc.id))
                .andExpect(jsonPath("$.activeNocStatus").value("SUBMITTED"))
                .andReturn();

        CandidateAcademicDetailDto detail = objectMapper.readValue(res.getResponse().getContentAsString(), CandidateAcademicDetailDto.class);
        assertEquals(ar.id, detail.id());
        assertEquals("B.Tech Computer Science", detail.degreeProgram());
    }
}
