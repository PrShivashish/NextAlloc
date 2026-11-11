package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;

import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.core.io.Resource;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.transaction.annotation.Transactional;

import in.nextalloc.common.ApiException;
import in.nextalloc.config.AppProperties;
import in.nextalloc.domain.*;
import in.nextalloc.domain.enums.*;
import in.nextalloc.repo.*;
import in.nextalloc.security.AuthUser;
import in.nextalloc.web.dto.NocEvidenceDto;
import in.nextalloc.web.dto.NocReviewDecisionInput;
import in.nextalloc.web.dto.NocReviewQueueItemDto;
import in.nextalloc.web.dto.NocSubmissionInput;

@SpringBootTest
@DisplayName("Phase 4A-2C: Institutional NOC Verification & Versioning Lifecycle Tests")
public class EvidenceServiceTest {

    @Autowired
    private EvidenceService evidenceService;

    @Autowired
    private CandidateProfileRepository profileRepo;

    @Autowired
    private CandidateAcademicRecordRepository academicRepo;

    @Autowired
    private CandidateEvidenceRepository evidenceRepo;

    @Autowired
    private CandidateEvidenceCurrentRepository currentEvidenceRepo;

    @Autowired
    private UserRepository userRepo;

    @Autowired
    private AuditEventRepository auditRepo;

    @Autowired
    private ScenarioService scenarioService;

    @Autowired
    private AllocationEligibilitySnapshotRepository eligSnapshotRepo;

    @Autowired
    private AssignmentRepository assignmentRepo;

    @Autowired
    private AllocationRunRepository runRepo;

    @Autowired
    private AppProperties props;

    @Autowired
    private jakarta.persistence.EntityManager entityManager;

    private User candidateUser1;
    private User candidateUser2;
    private User adminDbUser;
    private CandidateProfile profile1;
    private CandidateProfile profile2;
    private AuthUser candidateAuth1;
    private AuthUser candidateAuth2;
    private AuthUser adminAuth;

    private byte[] createSamplePdfContent(String marker) {
        String pdf = "%PDF-1.4\n" +
                     "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n" +
                     "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n" +
                     "3 0 obj\n<< /Type /Page /Parent 2 0 R /Contents 4 0 R >>\nendobj\n" +
                     "4 0 obj\n<< /Length 44 >>\nstream\nBT /F1 12 Tf 72 712 Td (" + marker + ") Tj ET\nendstream\nendobj\n" +
                     "xref\n0 5\n0000000000 65535 f \n" +
                     "trailer\n<< /Root 1 0 R /Size 5 >>\n" +
                     "startxref\n300\n%%EOF\n";
        return pdf.getBytes(StandardCharsets.ISO_8859_1);
    }

    @BeforeEach
    void setUp() {
        cleanBaseline();

        // 1. Create candidate user 1 & profile 1
        candidateUser1 = new User();
        candidateUser1.email = "applicant1_" + UUID.randomUUID() + "@university.edu.in";
        candidateUser1.passwordHash = "hash";
        candidateUser1.name = "Priya Sharma";
        candidateUser1.role = Role.CANDIDATE;
        candidateUser1 = userRepo.save(candidateUser1);

        profile1 = new CandidateProfile();
        profile1.userId = candidateUser1.id;
        profile1.fullName = "Priya Sharma";
        profile1.qualification = Qualification.BACHELORS;
        profile1.candidateStatus = CandidateStatus.STUDENT;
        profile1.state = "Karnataka";
        profile1.district = "Bengaluru Urban";
        profile1 = profileRepo.save(profile1);

        // Academic record for candidate 1
        CandidateAcademicRecord acad1 = new CandidateAcademicRecord();
        acad1.candidateId = profile1.id;
        acad1.enrollmentStatus = EnrollmentStatus.ENROLLED_FULL_TIME;
        acad1.degreeProgram = "B.Tech Computer Science";
        acad1.institutionName = "Visvesvaraya Technological University";
        acad1.finalYearStatus = FinalYearStatus.VERIFIED_FINAL_YEAR;
        acad1.currentAcademicYear = 4;
        acad1.programDurationYears = 4;
        acad1.expectedCompletionDate = LocalDate.of(2027, 6, 30);
        academicRepo.save(acad1);

        // 2. Create candidate user 2 & profile 2
        candidateUser2 = new User();
        candidateUser2.email = "applicant2_" + UUID.randomUUID() + "@college.edu.in";
        candidateUser2.passwordHash = "hash";
        candidateUser2.name = "Rahul Verma";
        candidateUser2.role = Role.CANDIDATE;
        candidateUser2 = userRepo.save(candidateUser2);

        profile2 = new CandidateProfile();
        profile2.userId = candidateUser2.id;
        profile2.fullName = "Rahul Verma";
        profile2.qualification = Qualification.BACHELORS;
        profile2.candidateStatus = CandidateStatus.STUDENT;
        profile2.state = "Maharashtra";
        profile2.district = "Pune";
        profile2 = profileRepo.save(profile2);

        // 3. Create admin user
        adminDbUser = new User();
        adminDbUser.email = "admin_" + UUID.randomUUID() + "@pragati.gov.in";
        adminDbUser.passwordHash = "hash";
        adminDbUser.name = "Shivashish Prusty";
        adminDbUser.role = Role.ADMIN;
        adminDbUser = userRepo.save(adminDbUser);

        // AuthUser wrappers
        candidateAuth1 = new AuthUser(candidateUser1.id, candidateUser1.email, candidateUser1.name, "ROLE_CANDIDATE");
        candidateAuth2 = new AuthUser(candidateUser2.id, candidateUser2.email, candidateUser2.name, "ROLE_CANDIDATE");
        adminAuth = new AuthUser(adminDbUser.id, adminDbUser.email, adminDbUser.name, "ROLE_ADMIN");
    }

    private void cleanBaseline() {
        eligSnapshotRepo.deleteAll();
        assignmentRepo.deleteAll();
        runRepo.deleteAll();
        currentEvidenceRepo.deleteAll();
        evidenceRepo.deleteAll();
        academicRepo.deleteAll();

        try {
            Path baseDir = Path.of(props.getUploads().getDir()).toAbsolutePath().normalize();
            Path nocDir = baseDir.resolve("noc");
            if (Files.exists(nocDir)) {
                try (var s = Files.list(nocDir)) {
                    for (Path p : s.toList()) {
                        Files.deleteIfExists(p);
                    }
                }
            }
            Path stagingDir = baseDir.resolve("staging");
            if (Files.exists(stagingDir)) {
                try (var s = Files.list(stagingDir)) {
                    for (Path p : s.toList()) {
                        Files.deleteIfExists(p);
                    }
                }
            }
        } catch (Exception ignored) {}
    }

    @AfterEach
    void tearDown() {
        cleanBaseline();
    }

    // ------------------------------------------------------------------
    // 1. Candidate Submission & Active Pointer Tests
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Test 1: Valid PDF submission stores record, sets active pointer, and logs audit")
    void test1_successfulNocSubmission_createsEvidenceAndSetsActivePointer() throws IOException {
        byte[] pdfBytes = createSamplePdfContent("Official Institutional NOC 2026");
        MockMultipartFile file = new MockMultipartFile(
                "file", "institutional-noc.pdf", "application/pdf", pdfBytes);

        NocSubmissionInput input = new NocSubmissionInput(
                "Visvesvaraya Technological University",
                SignatoryRole.DEAN,
                "Dr. S. K. Rao",
                "dean.engg@vtu.ac.in",
                true,
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2027, 6, 30)
        );

        NocEvidenceDto dto = evidenceService.submitNoc(candidateAuth1, file, input);

        assertNotNull(dto);
        assertNotNull(dto.id());
        assertEquals(profile1.id, dto.candidateId());
        assertEquals(EvidenceStatus.SUBMITTED, dto.verificationStatus());
        assertEquals("Visvesvaraya Technological University", dto.issuingInstitution());
        assertEquals(SignatoryRole.DEAN, dto.signatoryRole());
        assertTrue(dto.declaresNoAcademicConflict());
        assertNotNull(dto.documentSha256());
        assertEquals(64, dto.documentSha256().length());

        // Verify CandidateEvidenceCurrent points to this record
        CandidateEvidenceCurrent current = currentEvidenceRepo
                .findByCandidateIdAndEvidenceType(profile1.id, EvidenceService.EVIDENCE_TYPE_NOC)
                .orElse(null);
        assertNotNull(current);
        assertEquals(dto.id(), current.evidenceId);

        // Verify CandidateEvidenceRepository custom queries return this active evidence
        List<CandidateEvidence> inList = evidenceRepo.findByCandidateIdIn(List.of(profile1.id));
        assertEquals(1, inList.size());
        assertEquals(dto.id(), inList.get(0).id);

        // Verify audit event
        List<AuditEvent> audits = auditRepo.findAll();
        boolean audited = audits.stream().anyMatch(a -> a.action == AuditAction.NOC_SUBMITTED &&
                dto.id().toString().equals(a.targetId));
        assertTrue(audited, "NOC_SUBMITTED audit event must be logged");
    }

    // ------------------------------------------------------------------
    // 2. Upload Validation Tests
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Test 2: Non-PDF file extension rejected")
    void test2_uploadValidation_rejectsNonPdfExtension() {
        MockMultipartFile file = new MockMultipartFile(
                "file", "noc.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "non-pdf-bytes".getBytes());

        NocSubmissionInput input = new NocSubmissionInput(
                "VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);

        ApiException ex = assertThrows(ApiException.class, () ->
                evidenceService.submitNoc(candidateAuth1, file, input));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("Only PDF documents (.pdf) are accepted"));
    }

    @Test
    @DisplayName("Test 3: File exceeding 5MB is rejected")
    void test3_uploadValidation_rejectsOversizedFile() {
        byte[] largeBytes = new byte[6 * 1024 * 1024]; // 6 MB
        MockMultipartFile file = new MockMultipartFile(
                "file", "large-noc.pdf", "application/pdf", largeBytes);

        NocSubmissionInput input = new NocSubmissionInput(
                "VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);

        ApiException ex = assertThrows(ApiException.class, () ->
                evidenceService.submitNoc(candidateAuth1, file, input));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("must not exceed 5 MB"));
    }

    @Test
    @DisplayName("Test 4: Corrupted file without %PDF magic bytes is rejected")
    void test4_uploadValidation_rejectsCorruptedPdfHeader() {
        byte[] fakeBytes = "NOT A VALID PDF HEADER CONTENT".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile(
                "file", "fake.pdf", "application/pdf", fakeBytes);

        NocSubmissionInput input = new NocSubmissionInput(
                "VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);

        ApiException ex = assertThrows(ApiException.class, () ->
                evidenceService.submitNoc(candidateAuth1, file, input));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("valid PDF header (%PDF)"));
    }

    @Test
    @DisplayName("Test 5: Truncated PDF missing %%EOF trailer is rejected")
    void test5_uploadValidation_rejectsMissingEofTrailer() {
        byte[] truncatedPdf = "%PDF-1.4\nsome content without trailer\n".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file = new MockMultipartFile(
                "file", "truncated.pdf", "application/pdf", truncatedPdf);

        NocSubmissionInput input = new NocSubmissionInput(
                "VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);

        ApiException ex = assertThrows(ApiException.class, () ->
                evidenceService.submitNoc(candidateAuth1, file, input));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("missing %%EOF marker"));
    }

    // ------------------------------------------------------------------
    // 3. Reviewer Workflow & OCC Tests
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Test 6: Admin pending queue enriches applicant academic context")
    void test6_adminPendingQueue_enrichesAcademicContextAndSignatory() throws IOException {
        byte[] pdfBytes = createSamplePdfContent("Official NOC Candidate 1");
        MockMultipartFile file = new MockMultipartFile(
                "file", "noc1.pdf", "application/pdf", pdfBytes);

        NocSubmissionInput input = new NocSubmissionInput(
                "Visvesvaraya Technological University",
                SignatoryRole.DEAN,
                "Dr. Rao",
                "dean@vtu.ac.in",
                true,
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2027, 6, 30)
        );

        evidenceService.submitNoc(candidateAuth1, file, input);

        Page<NocReviewQueueItemDto> page = evidenceService.getPendingQueue(adminAuth, PageRequest.of(0, 10));
        assertEquals(1, page.getTotalElements());

        NocReviewQueueItemDto item = page.getContent().get(0);
        assertEquals("Priya Sharma", item.candidateName());
        assertEquals(candidateUser1.email, item.candidateEmail());
        assertEquals("B.Tech Computer Science", item.academicDegreeProgram());
        assertEquals(FinalYearStatus.VERIFIED_FINAL_YEAR, item.academicFinalYearStatus());
        assertEquals(EnrollmentStatus.ENROLLED_FULL_TIME, item.academicEnrollmentStatus());
    }

    @Test
    @DisplayName("Test 7: Admin verification approves NOC and logs reviewer audit")
    void test7_adminVerification_approvesSubmittedNoc() throws IOException {
        byte[] pdfBytes = createSamplePdfContent("Official NOC Approval Test");
        MockMultipartFile file = new MockMultipartFile("file", "noc.pdf", "application/pdf", pdfBytes);

        NocSubmissionInput input = new NocSubmissionInput(
                "Visvesvaraya Technological University",
                SignatoryRole.DEAN,
                "Dr. Rao",
                "dean@vtu.ac.in",
                true,
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2027, 6, 30)
        );
        NocEvidenceDto submitted = evidenceService.submitNoc(candidateAuth1, file, input);

        NocReviewDecisionInput decision = new NocReviewDecisionInput(
                submitted.version(),
                null,
                "Duly verified against university registrar records",
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2027, 6, 30)
        );

        NocReviewQueueItemDto verified = evidenceService.verifyNoc(adminAuth, submitted.id(), decision);

        assertEquals(EvidenceStatus.VERIFIED, verified.verificationStatus());
        assertNotNull(verified.verifiedAt());
        assertEquals(adminDbUser.id, verified.verifiedByUserId());
        assertNull(verified.rejectionReasonCode());
        assertEquals("Duly verified against university registrar records", verified.rejectionNotes());

        // Verify audit event
        List<AuditEvent> audits = auditRepo.findAll();
        boolean verifiedAudited = audits.stream().anyMatch(a -> a.action == AuditAction.NOC_VERIFIED &&
                submitted.id().toString().equals(a.targetId));
        assertTrue(verifiedAudited, "NOC_VERIFIED audit must be logged");
    }

    @Test
    @DisplayName("Test 8: Admin rejection stores reason code and notes")
    void test8_adminRejection_withReasonAndNotes() throws IOException {
        byte[] pdfBytes = createSamplePdfContent("Official NOC Rejection Test");
        MockMultipartFile file = new MockMultipartFile("file", "noc.pdf", "application/pdf", pdfBytes);

        NocSubmissionInput input = new NocSubmissionInput(
                "Visvesvaraya Technological University",
                SignatoryRole.DEAN,
                "Dr. Rao",
                "dean@vtu.ac.in",
                true,
                null, null
        );
        NocEvidenceDto submitted = evidenceService.submitNoc(candidateAuth1, file, input);

        NocReviewDecisionInput decision = new NocReviewDecisionInput(
                submitted.version(),
                EligibilityReasonCode.INSTITUTIONAL_NOC_REJECTED,
                "Official seal missing from document page 2",
                null, null
        );

        NocReviewQueueItemDto rejected = evidenceService.rejectNoc(adminAuth, submitted.id(), decision);

        assertEquals(EvidenceStatus.REJECTED, rejected.verificationStatus());
        assertEquals(EligibilityReasonCode.INSTITUTIONAL_NOC_REJECTED, rejected.rejectionReasonCode());
        assertEquals("Official seal missing from document page 2", rejected.rejectionNotes());
        assertEquals(adminDbUser.id, rejected.verifiedByUserId());

        List<AuditEvent> audits = auditRepo.findAll();
        boolean rejectedAudited = audits.stream().anyMatch(a -> a.action == AuditAction.NOC_REJECTED &&
                submitted.id().toString().equals(a.targetId));
        assertTrue(rejectedAudited, "NOC_REJECTED audit must be logged");
    }

    @Test
    @DisplayName("Test 9: Admin request clarification sets PENDING_ADDITIONAL_INFO")
    void test9_adminRequestClarification_transitionsToPendingAdditionalInfo() throws IOException {
        byte[] pdfBytes = createSamplePdfContent("Official NOC Clarification Test");
        MockMultipartFile file = new MockMultipartFile("file", "noc.pdf", "application/pdf", pdfBytes);

        NocSubmissionInput input = new NocSubmissionInput(
                "Visvesvaraya Technological University",
                SignatoryRole.DEAN,
                "Dr. Rao",
                "dean@vtu.ac.in",
                true,
                null, null
        );
        NocEvidenceDto submitted = evidenceService.submitNoc(candidateAuth1, file, input);

        NocReviewDecisionInput decision = new NocReviewDecisionInput(
                submitted.version(),
                null,
                "Please upload a clearer scan of the signatory signature",
                null, null
        );

        NocReviewQueueItemDto res = evidenceService.requestClarification(adminAuth, submitted.id(), decision);

        assertEquals(EvidenceStatus.PENDING_ADDITIONAL_INFO, res.verificationStatus());
        assertEquals("Please upload a clearer scan of the signatory signature", res.rejectionNotes());

        List<AuditEvent> audits = auditRepo.findAll();
        boolean clarifiedAudited = audits.stream().anyMatch(a -> a.action == AuditAction.NOC_CLARIFICATION_REQUESTED);
        assertTrue(clarifiedAudited, "NOC_CLARIFICATION_REQUESTED audit must be logged");
    }

    @Test
    @DisplayName("Test 10: Optimistic Concurrency Control rejects stale version with HTTP 409 Conflict")
    void test10_optimisticConcurrency_rejectsStaleVersion() throws IOException {
        byte[] pdfBytes = createSamplePdfContent("OCC Test");
        MockMultipartFile file = new MockMultipartFile("file", "noc.pdf", "application/pdf", pdfBytes);

        NocSubmissionInput input = new NocSubmissionInput(
                "Visvesvaraya Technological University",
                SignatoryRole.DEAN,
                "Dr. Rao",
                "dean@vtu.ac.in",
                true,
                null, null
        );
        NocEvidenceDto submitted = evidenceService.submitNoc(candidateAuth1, file, input);

        NocReviewDecisionInput staleDecision = new NocReviewDecisionInput(
                999, // Stale version
                null,
                "Verify with stale version",
                null, null
        );

        ApiException ex = assertThrows(ApiException.class, () ->
                evidenceService.verifyNoc(adminAuth, submitted.id(), staleDecision));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("Stale evidence version"));
    }

    // ------------------------------------------------------------------
    // 4. Resubmission & Pointer Invariant Tests
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Test 11: Resubmission creates new evidence v2, leaves v1 intact, and moves active pointer to v2")
    void test11_candidateResubmission_v2CreatesNewRecordAndMovesActivePointer() throws IOException {
        // 1. Initial submission v1
        byte[] pdfV1 = createSamplePdfContent("NOC Version 1 - Flawed Document");
        MockMultipartFile fileV1 = new MockMultipartFile("file", "noc_v1.pdf", "application/pdf", pdfV1);
        NocSubmissionInput inputV1 = new NocSubmissionInput(
                "VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);
        NocEvidenceDto v1 = evidenceService.submitNoc(candidateAuth1, fileV1, inputV1);

        // Admin rejects v1
        NocReviewDecisionInput rejectDecision = new NocReviewDecisionInput(
                v1.version(),
                EligibilityReasonCode.INSTITUTIONAL_NOC_REJECTED,
                "Missing signature stamp",
                null, null
        );
        evidenceService.rejectNoc(adminAuth, v1.id(), rejectDecision);

        CandidateEvidence v1FromDb = evidenceRepo.findById(v1.id()).orElseThrow();
        assertEquals(EvidenceStatus.REJECTED, v1FromDb.verificationStatus);

        // 2. Candidate resubmits corrected NOC v2
        byte[] pdfV2 = createSamplePdfContent("NOC Version 2 - Corrected Document with Stamp");
        MockMultipartFile fileV2 = new MockMultipartFile("file", "noc_v2.pdf", "application/pdf", pdfV2);
        NocSubmissionInput inputV2 = new NocSubmissionInput(
                "VTU", SignatoryRole.DEAN, "Dean S. Rao", "dean@vtu.in", true,
                LocalDate.of(2026, 7, 1), LocalDate.of(2027, 6, 30));
        NocEvidenceDto v2 = evidenceService.submitNoc(candidateAuth1, fileV2, inputV2);

        assertNotNull(v2);
        assertNotEquals(v1.id(), v2.id(), "V2 must be a new distinct record");
        assertEquals(EvidenceStatus.SUBMITTED, v2.verificationStatus());

        // Verify v1 record is STILL preserved in the database exactly as rejected!
        CandidateEvidence v1Preserved = evidenceRepo.findById(v1.id()).orElseThrow();
        assertEquals(EvidenceStatus.REJECTED, v1Preserved.verificationStatus);
        assertEquals("Missing signature stamp", v1Preserved.rejectionNotes);

        // Verify CandidateEvidenceCurrent now points to v2
        CandidateEvidenceCurrent current = currentEvidenceRepo
                .findByCandidateIdAndEvidenceType(profile1.id, EvidenceService.EVIDENCE_TYPE_NOC).orElseThrow();
        assertEquals(v2.id(), current.evidenceId, "Active pointer must now point to v2");

        // Verify candidateEvidences.findByCandidateIdIn resolves ONLY v2!
        List<CandidateEvidence> activeList = evidenceRepo.findByCandidateIdIn(List.of(profile1.id));
        assertEquals(1, activeList.size());
        assertEquals(v2.id(), activeList.get(0).id);
        assertEquals(EvidenceStatus.SUBMITTED, activeList.get(0).verificationStatus);

        // Admin now verifies v2
        NocReviewDecisionInput approveDecision = new NocReviewDecisionInput(
                v2.version(), null, "Stamp verified successfully", null, null);
        NocReviewQueueItemDto v2Approved = evidenceService.verifyNoc(adminAuth, v2.id(), approveDecision);
        assertEquals(EvidenceStatus.VERIFIED, v2Approved.verificationStatus());

        // Active list now reflects VERIFIED
        List<CandidateEvidence> verifiedList = evidenceRepo.findByCandidateIdIn(List.of(profile1.id));
        assertEquals(1, verifiedList.size());
        assertEquals(EvidenceStatus.VERIFIED, verifiedList.get(0).verificationStatus);

        // Historical query returns all versions in reverse order
        List<CandidateEvidence> allHistory = evidenceRepo.findAllByCandidateIdOrderByIdDesc(profile1.id);
        assertEquals(2, allHistory.size());
        assertEquals(v2.id(), allHistory.get(0).id);
        assertEquals(v1.id(), allHistory.get(1).id);
    }

    // ------------------------------------------------------------------
    // 5. Security & Authorization Boundary Tests
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Test 12: Candidate cannot download another candidate's evidence document")
    void test12_crossCandidateAuthorization_candidateCannotAccessOtherCandidateNoc() throws IOException {
        // Candidate 1 uploads NOC
        byte[] pdfBytes = createSamplePdfContent("Candidate 1 Confidential NOC");
        MockMultipartFile file = new MockMultipartFile("file", "c1.pdf", "application/pdf", pdfBytes);
        NocSubmissionInput input = new NocSubmissionInput("VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);
        NocEvidenceDto c1Noc = evidenceService.submitNoc(candidateAuth1, file, input);

        // Candidate 2 attempts to download Candidate 1's NOC by ID
        ApiException ex = assertThrows(ApiException.class, () ->
                evidenceService.downloadMyNoc(candidateAuth2, c1Noc.id()));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
        assertTrue(ex.getMessage().contains("You do not have permission to access another applicant's evidence"));
    }

    @Test
    @DisplayName("Test 13: Non-admin candidate blocked from reviewer actions")
    void test13_unauthorizedReviewerBlocked() throws IOException {
        byte[] pdfBytes = createSamplePdfContent("NOC Authorization Check");
        MockMultipartFile file = new MockMultipartFile("file", "noc.pdf", "application/pdf", pdfBytes);
        NocSubmissionInput input = new NocSubmissionInput("VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);
        NocEvidenceDto submitted = evidenceService.submitNoc(candidateAuth1, file, input);

        NocReviewDecisionInput decision = new NocReviewDecisionInput(submitted.version(), null, "Self-approval attempt", null, null);

        // Candidate tries to verify NOC
        ApiException exVerify = assertThrows(ApiException.class, () ->
                evidenceService.verifyNoc(candidateAuth1, submitted.id(), decision));
        assertEquals(HttpStatus.FORBIDDEN, exVerify.getStatus());

        // Candidate tries to view reviewer pending queue
        ApiException exQueue = assertThrows(ApiException.class, () ->
                evidenceService.getPendingQueue(candidateAuth1, PageRequest.of(0, 10)));
        assertEquals(HttpStatus.FORBIDDEN, exQueue.getStatus());
    }

    @Test
    @DisplayName("Test 14: Signatory validation rejects OTHER_UNRECOGNIZED on verification")
    void test14_signatoryValidation_rejectsUnrecognizedRole() throws IOException {
        byte[] pdfBytes = createSamplePdfContent("NOC Unrecognized Role");
        MockMultipartFile file = new MockMultipartFile("file", "noc.pdf", "application/pdf", pdfBytes);
        NocSubmissionInput input = new NocSubmissionInput("VTU", SignatoryRole.OTHER_UNRECOGNIZED, "Clerk", "clerk@vtu.in", true, null, null);
        NocEvidenceDto submitted = evidenceService.submitNoc(candidateAuth1, file, input);

        NocReviewDecisionInput decision = new NocReviewDecisionInput(submitted.version(), null, "Approval", null, null);

        ApiException ex = assertThrows(ApiException.class, () ->
                evidenceService.verifyNoc(adminAuth, submitted.id(), decision));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("OTHER_UNRECOGNIZED is not an authorized institutional signatory"));
    }

    @Test
    @DisplayName("Test 15: Signatory validation rejects verification if academic conflict declared")
    void test15_signatoryValidation_rejectsAcademicConflict() throws IOException {
        byte[] pdfBytes = createSamplePdfContent("NOC Academic Conflict");
        MockMultipartFile file = new MockMultipartFile("file", "noc.pdf", "application/pdf", pdfBytes);
        // declaresNoAcademicConflict = false
        NocSubmissionInput input = new NocSubmissionInput("VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", false, null, null);
        NocEvidenceDto submitted = evidenceService.submitNoc(candidateAuth1, file, input);

        NocReviewDecisionInput decision = new NocReviewDecisionInput(submitted.version(), null, "Approval", null, null);

        ApiException ex = assertThrows(ApiException.class, () ->
                evidenceService.verifyNoc(adminAuth, submitted.id(), decision));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatus());
        assertTrue(ex.getMessage().contains("absence of academic conflict"));
    }

    @Test
    @DisplayName("Test 16: Safe file retrieval serves attachment and blocks traversal")
    void test16_safeFileResource_cannotEscapeUploadsDirectory() throws IOException {
        byte[] pdfBytes = createSamplePdfContent("Safe Document Download");
        MockMultipartFile file = new MockMultipartFile("file", "safe.pdf", "application/pdf", pdfBytes);
        NocSubmissionInput input = new NocSubmissionInput("VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);
        NocEvidenceDto submitted = evidenceService.submitNoc(candidateAuth1, file, input);

        Resource res = evidenceService.downloadMyNoc(candidateAuth1, submitted.id());
        assertNotNull(res);
        assertTrue(res.exists());
        assertTrue(res.isReadable());

        // Now test malicious documentReference path manipulation in DB
        CandidateEvidence doc = evidenceRepo.findById(submitted.id()).orElseThrow();
        doc.documentReference = "../../../../etc/passwd";
        evidenceRepo.save(doc);

        ApiException ex = assertThrows(ApiException.class, () ->
                evidenceService.downloadMyNoc(candidateAuth1, submitted.id()));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatus());
    }

    @Test
    @DisplayName("Test 17: Scenario lifecycle protection blocks reload when candidate evidence exists")
    void test17_scenarioProtection_preservesEvidenceDuringReload() throws IOException {
        byte[] pdfBytes = createSamplePdfContent("NOC Scenario Guard Test");
        MockMultipartFile file = new MockMultipartFile("file", "guard.pdf", "application/pdf", pdfBytes);
        NocSubmissionInput input = new NocSubmissionInput("VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);
        evidenceService.submitNoc(candidateAuth1, file, input);

        // Attempting to reload scenario should fail with 409 Conflict
        ApiException ex = assertThrows(ApiException.class, () ->
                scenarioService.load(ScenarioKey.MICRO_CONFLICT, adminAuth));
        assertEquals(HttpStatus.CONFLICT, ex.getStatus());
        assertTrue(ex.getMessage().contains("applicant academic or NOC evidence exists"));

        // Verify evidence count remains preserved
        assertEquals(1, evidenceRepo.count());
        assertEquals(1, currentEvidenceRepo.count());
    }

    // ------------------------------------------------------------------
    // 6. Gate 2 Composite Ownership & Ambiguous Migration Tests
    // ------------------------------------------------------------------

    @Test
    @DisplayName("Test 18: Database composite foreign key rejects cross-candidate pointer")
    void test18_databaseCompositeForeignKey_rejectsCrossCandidateCurrentPointer() throws IOException {
        byte[] pdfBytes = createSamplePdfContent("Composite FK Test");
        MockMultipartFile file = new MockMultipartFile("file", "c1.pdf", "application/pdf", pdfBytes);
        NocSubmissionInput input = new NocSubmissionInput("VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);
        NocEvidenceDto c1Noc = evidenceService.submitNoc(candidateAuth1, file, input);

        // Attempt direct database insert into candidate_evidence_current:
        // Point Candidate 2's pointer to Candidate 1's evidence ID!
        assertThrows(Exception.class, () -> {
            entityManager.createNativeQuery(
                    "INSERT INTO candidate_evidence_current (candidate_id, evidence_type, evidence_id, version, updated_at) " +
                    "VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)")
                    .setParameter(1, profile2.id) // Candidate 2
                    .setParameter(2, EvidenceService.EVIDENCE_TYPE_NOC)
                    .setParameter(3, c1Noc.id()) // Candidate 1's evidence
                    .executeUpdate();
            entityManager.flush();
        }, "Database must reject foreign key constraint when candidate_id in pointer does not match candidate_id in evidence");
    }

    @Test
    @DisplayName("Test 19: Database composite foreign key rejects mismatched evidence_type pointer")
    void test19_databaseCompositeForeignKey_rejectsMismatchedEvidenceType() throws IOException {
        byte[] pdfBytes = createSamplePdfContent("Type Mismatch Test");
        MockMultipartFile file = new MockMultipartFile("file", "c1.pdf", "application/pdf", pdfBytes);
        NocSubmissionInput input = new NocSubmissionInput("VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);
        NocEvidenceDto c1Noc = evidenceService.submitNoc(candidateAuth1, file, input);

        // Attempt direct database insert with mismatched evidence_type:
        assertThrows(Exception.class, () -> {
            entityManager.createNativeQuery(
                    "INSERT INTO candidate_evidence_current (candidate_id, evidence_type, evidence_id, version, updated_at) " +
                    "VALUES (?, ?, ?, 0, CURRENT_TIMESTAMP)")
                    .setParameter(1, profile1.id)
                    .setParameter(2, "RESUME_DOCUMENT") // Type mismatch (evidence is INSTITUTIONAL_NOC)
                    .setParameter(3, c1Noc.id())
                    .executeUpdate();
            entityManager.flush();
        }, "Database must reject foreign key constraint when evidence_type does not match referenced evidence row");
    }

    @Test
    @org.springframework.transaction.annotation.Transactional
    @DisplayName("Test 20: V3 backfill query migrates unambiguous single record and excludes ambiguous multiple records")
    void test20_v3Backfill_migratesUnambiguousCandidateAndSkipsAmbiguous() {
        cleanBaseline();

        // Candidate 1: Exactly 1 NOC submission (unambiguous)
        CandidateEvidence noc1 = new CandidateEvidence();
        noc1.candidateId = profile1.id;
        noc1.evidenceType = EvidenceService.EVIDENCE_TYPE_NOC;
        noc1.documentReference = "noc/c1.pdf";
        noc1.signatoryRole = SignatoryRole.DEAN;
        noc1.verificationStatus = EvidenceStatus.SUBMITTED;
        evidenceRepo.save(noc1);

        // Candidate 2: 2 conflicting legacy NOC submissions (ambiguous legacy data)
        CandidateEvidence noc2a = new CandidateEvidence();
        noc2a.candidateId = profile2.id;
        noc2a.evidenceType = EvidenceService.EVIDENCE_TYPE_NOC;
        noc2a.documentReference = "noc/c2a.pdf";
        noc2a.signatoryRole = SignatoryRole.PRINCIPAL;
        noc2a.verificationStatus = EvidenceStatus.REJECTED;
        evidenceRepo.save(noc2a);

        CandidateEvidence noc2b = new CandidateEvidence();
        noc2b.candidateId = profile2.id;
        noc2b.evidenceType = EvidenceService.EVIDENCE_TYPE_NOC;
        noc2b.documentReference = "noc/c2b.pdf";
        noc2b.signatoryRole = SignatoryRole.PRINCIPAL;
        noc2b.verificationStatus = EvidenceStatus.SUBMITTED;
        evidenceRepo.save(noc2b);

        assertEquals(0, currentEvidenceRepo.count(), "Precondition: zero current pointers exist");

        // Execute the exact V3 backfill SQL statement
        entityManager.createNativeQuery(
                "INSERT INTO candidate_evidence_current (candidate_id, evidence_type, evidence_id, version, updated_at) " +
                "SELECT ce.candidate_id, ce.evidence_type, ce.id, 0, CURRENT_TIMESTAMP " +
                "FROM candidate_evidences ce " +
                "WHERE (ce.candidate_id, ce.evidence_type) IN ( " +
                "    SELECT sub.candidate_id, sub.evidence_type " +
                "    FROM candidate_evidences sub " +
                "    GROUP BY sub.candidate_id, sub.evidence_type " +
                "    HAVING COUNT(sub.id) = 1 " +
                ")"
        ).executeUpdate();
        entityManager.flush();

        // Candidate 1 must be migrated
        assertTrue(currentEvidenceRepo.findByCandidateIdAndEvidenceType(profile1.id, EvidenceService.EVIDENCE_TYPE_NOC).isPresent(),
                "Candidate 1 has exactly 1 NOC and must be automatically migrated");
        assertEquals(noc1.id, currentEvidenceRepo.findByCandidateIdAndEvidenceType(profile1.id, EvidenceService.EVIDENCE_TYPE_NOC).get().evidenceId);

        // Candidate 2 must NOT be migrated (refuse to silently invent decisions)
        assertTrue(currentEvidenceRepo.findByCandidateIdAndEvidenceType(profile2.id, EvidenceService.EVIDENCE_TYPE_NOC).isEmpty(),
                "Candidate 2 has ambiguous multiple NOCs and must NOT be migrated automatically");

        // Active evidence resolution for Candidate 2 fails closed (returns empty)
        List<CandidateEvidence> cand2Active = evidenceRepo.findByCandidateIdIn(List.of(profile2.id));
        assertEquals(0, cand2Active.size(), "Ambiguous candidate evidence returns 0 active records until explicitly resolved");
    }

    @Test
    @DisplayName("Test 21: Pending review queue strictly excludes superseded submissions")
    void test21_pendingQueue_strictlyExcludesSupersededSubmissions() throws IOException {
        // Candidate 1 uploads v1
        byte[] pdfV1 = createSamplePdfContent("NOC v1");
        MockMultipartFile file1 = new MockMultipartFile("file", "v1.pdf", "application/pdf", pdfV1);
        NocSubmissionInput in1 = new NocSubmissionInput("VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);
        NocEvidenceDto v1 = evidenceService.submitNoc(candidateAuth1, file1, in1);

        // Candidate 1 resubmits v2 before review of v1
        byte[] pdfV2 = createSamplePdfContent("NOC v2");
        MockMultipartFile file2 = new MockMultipartFile("file", "v2.pdf", "application/pdf", pdfV2);
        NocSubmissionInput in2 = new NocSubmissionInput("VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);
        NocEvidenceDto v2 = evidenceService.submitNoc(candidateAuth1, file2, in2);

        Page<NocReviewQueueItemDto> pending = evidenceService.getPendingQueue(adminAuth, PageRequest.of(0, 10));
        assertEquals(1, pending.getTotalElements(), "Review queue must contain only the active current submission, never superseded submissions");
        assertEquals(v2.id(), pending.getContent().get(0).id(), "Active item in queue must be v2");
    }

    @Test
    @DisplayName("Test 22: Reviewer cannot verify or reject a superseded submission (returns HTTP 409 Conflict)")
    void test22_reviewerCannotReviewSupersededEvidence() throws IOException {
        byte[] pdfV1 = createSamplePdfContent("NOC v1");
        MockMultipartFile file1 = new MockMultipartFile("file", "v1.pdf", "application/pdf", pdfV1);
        NocSubmissionInput in1 = new NocSubmissionInput("VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);
        NocEvidenceDto v1 = evidenceService.submitNoc(candidateAuth1, file1, in1);

        byte[] pdfV2 = createSamplePdfContent("NOC v2");
        MockMultipartFile file2 = new MockMultipartFile("file", "v2.pdf", "application/pdf", pdfV2);
        NocSubmissionInput in2 = new NocSubmissionInput("VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);
        evidenceService.submitNoc(candidateAuth1, file2, in2);

        // Attempting to approve superseded v1 must fail with 409 CONFLICT
        NocReviewDecisionInput decision = new NocReviewDecisionInput(v1.version(), null, "Approve old v1", null, null);
        ApiException exVerify = assertThrows(ApiException.class, () ->
                evidenceService.verifyNoc(adminAuth, v1.id(), decision));
        assertEquals(HttpStatus.CONFLICT, exVerify.getStatus());
        assertTrue(exVerify.getMessage().contains("not the current active submission"));

        // Attempting to reject superseded v1 must also fail with 409 CONFLICT
        ApiException exReject = assertThrows(ApiException.class, () ->
                evidenceService.rejectNoc(adminAuth, v1.id(), decision));
        assertEquals(HttpStatus.CONFLICT, exReject.getStatus());
        assertTrue(exReject.getMessage().contains("not the current active submission"));
    }

    @Test
    @DisplayName("Test 23: Orphan reconciliation removes unreferenced files and preserves referenced")
    void test23_orphanReconciliation_cleansUnreferencedFiles() throws IOException {
        // Upload 1 legitimate referenced file
        byte[] pdfBytes = createSamplePdfContent("Referenced Legitimate File");
        MockMultipartFile file = new MockMultipartFile("file", "valid.pdf", "application/pdf", pdfBytes);
        NocSubmissionInput in = new NocSubmissionInput("VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);
        evidenceService.submitNoc(candidateAuth1, file, in);

        Path baseDir = Path.of(props.getUploads().getDir()).toAbsolutePath().normalize();
        Path nocDir = baseDir.resolve("noc");
        Path orphanFile = nocDir.resolve("orphan-crash-test-" + UUID.randomUUID() + ".pdf");
        Files.write(orphanFile, "orphan test content".getBytes(StandardCharsets.UTF_8));
        Files.setLastModifiedTime(orphanFile, java.nio.file.attribute.FileTime.from(Instant.now().minusSeconds(60)));

        assertTrue(Files.exists(orphanFile));

        // Reconcile with 0 duration to clean unreferenced files immediately
        int cleaned = evidenceService.reconcileOrphanFiles(java.time.Duration.ZERO);
        assertTrue(cleaned >= 1, "Orphan file must be cleaned up");
        assertFalse(Files.exists(orphanFile), "Orphan file must be deleted");

        // Verify referenced file remains intact
        assertEquals(1, evidenceRepo.count());
        Resource activeDoc = evidenceService.downloadMyNoc(candidateAuth1, null);
        assertTrue(activeDoc.exists());
    }

    @Test
    @Transactional
    @DisplayName("Test 24: Reviewer cannot verify/reject/clarify evidence without an active pointer (Risk A - HTTP 409)")
    void test24_ReviewerCannotReviewEvidenceWithoutActivePointer() throws IOException {
        // 1. Candidate submits NOC
        byte[] pdfBytes = createSamplePdfContent("Unpointed Legacy Candidate NOC");
        MockMultipartFile file = new MockMultipartFile("file", "legacy.pdf", "application/pdf", pdfBytes);
        NocSubmissionInput in = new NocSubmissionInput("VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);
        NocEvidenceDto submitted = evidenceService.submitNoc(candidateAuth1, file, in);

        // 2. Remove the active pointer simulating an ambiguous legacy candidate where migration skipped the candidate
        currentEvidenceRepo.findByCandidateIdAndEvidenceType(profile1.id, EvidenceService.EVIDENCE_TYPE_NOC)
                .ifPresent(currentEvidenceRepo::delete);
        entityManager.flush();
        entityManager.clear();
        assertTrue(currentEvidenceRepo.findByCandidateIdAndEvidenceType(profile1.id, EvidenceService.EVIDENCE_TYPE_NOC).isEmpty(),
                "Current pointer must be absent");

        NocReviewDecisionInput decision = new NocReviewDecisionInput(submitted.version(), null, "Attempt review without pointer", null, null);

        // verifyNoc must fail with 409 CONFLICT
        ApiException exVerify = assertThrows(ApiException.class, () ->
                evidenceService.verifyNoc(adminAuth, submitted.id(), decision));
        assertEquals(HttpStatus.CONFLICT, exVerify.getStatus());
        assertTrue(exVerify.getMessage().contains("not the current active submission"));

        // rejectNoc must fail with 409 CONFLICT
        ApiException exReject = assertThrows(ApiException.class, () ->
                evidenceService.rejectNoc(adminAuth, submitted.id(), decision));
        assertEquals(HttpStatus.CONFLICT, exReject.getStatus());
        assertTrue(exReject.getMessage().contains("not the current active submission"));

        // requestClarification must fail with 409 CONFLICT
        ApiException exClarify = assertThrows(ApiException.class, () ->
                evidenceService.requestClarification(adminAuth, submitted.id(), decision));
        assertEquals(HttpStatus.CONFLICT, exClarify.getStatus());
        assertTrue(exClarify.getMessage().contains("not the current active submission"));
    }

    @Test
    @DisplayName("Test 25: Candidate submits NOC v1 then v2 - orphan cleanup preserves both historical and active PDFs (Risk B)")
    void test25_HistoricalPdfsPreservedAcrossSubmissionsAndReconciliation() throws IOException {
        Path baseDir = Path.of(props.getUploads().getDir()).toAbsolutePath().normalize();
        Path nocDir = baseDir.resolve("noc");

        // 1. Candidate submits NOC v1
        byte[] pdfV1 = createSamplePdfContent("NOC Version 1 - Baseline Historical Audit");
        MockMultipartFile file1 = new MockMultipartFile("file", "v1.pdf", "application/pdf", pdfV1);
        NocSubmissionInput in1 = new NocSubmissionInput("VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);
        NocEvidenceDto v1 = evidenceService.submitNoc(candidateAuth1, file1, in1);

        // 2. Candidate submits NOC v2 (superseding v1)
        byte[] pdfV2 = createSamplePdfContent("NOC Version 2 - Active Current Submission");
        MockMultipartFile file2 = new MockMultipartFile("file", "v2.pdf", "application/pdf", pdfV2);
        NocSubmissionInput in2 = new NocSubmissionInput("VTU", SignatoryRole.DEAN, "Dean", "dean@vtu.in", true, null, null);
        NocEvidenceDto v2 = evidenceService.submitNoc(candidateAuth1, file2, in2);

        // 3. Create a synthetic orphan file
        Path orphanFile = nocDir.resolve("synthetic-crash-orphan-" + UUID.randomUUID() + ".pdf");
        Files.write(orphanFile, "synthetic unreferenced orphan".getBytes(StandardCharsets.UTF_8));
        Files.setLastModifiedTime(orphanFile, java.nio.file.attribute.FileTime.from(Instant.now().minusSeconds(120)));
        assertTrue(Files.exists(orphanFile));

        // 4. Test dry-run mode: orphan is identified but not deleted
        int dryRunCount = evidenceService.reconcileOrphanFiles(java.time.Duration.ofSeconds(30), true);
        assertEquals(1, dryRunCount, "Dry run must identify exactly 1 orphan file");
        assertTrue(Files.exists(orphanFile), "Dry run must NOT delete the orphan file");

        // 5. Test real reconciliation mode: orphan is purged
        int cleanedCount = evidenceService.reconcileOrphanFiles(java.time.Duration.ofSeconds(30), false);
        assertEquals(1, cleanedCount, "Reconciliation must clean exactly 1 orphan file");
        assertFalse(Files.exists(orphanFile), "Orphan file must be deleted");

        // 6. Verify BOTH v1 and v2 files still exist on the filesystem
        CandidateEvidence dbV1 = evidenceRepo.findById(v1.id()).orElseThrow();
        CandidateEvidence dbV2 = evidenceRepo.findById(v2.id()).orElseThrow();
        Path pathV1 = baseDir.resolve(dbV1.documentReference);
        Path pathV2 = baseDir.resolve(dbV2.documentReference);

        assertTrue(Files.exists(pathV1), "Historical NOC v1 PDF must be preserved on disk");
        assertTrue(Files.exists(pathV2), "Active NOC v2 PDF must be preserved on disk");

        // 7. Verify both records remain accessible to authorized history readers
        Resource docV1 = evidenceService.downloadMyNoc(candidateAuth1, v1.id());
        Resource docV2 = evidenceService.downloadMyNoc(candidateAuth1, v2.id());
        assertTrue(docV1.exists(), "Historical NOC v1 must be downloadable by candidate");
        assertTrue(docV2.exists(), "Active NOC v2 must be downloadable by candidate");
        assertEquals(pathV1.getFileName().toString(), docV1.getFilename());
        assertEquals(pathV2.getFileName().toString(), docV2.getFilename());
    }
}
