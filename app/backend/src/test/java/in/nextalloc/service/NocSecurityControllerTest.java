package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.ObjectMapper;

import in.nextalloc.config.AppProperties;
import in.nextalloc.domain.*;
import in.nextalloc.domain.enums.*;
import in.nextalloc.repo.*;
import in.nextalloc.security.JwtService;
import in.nextalloc.web.dto.NocEvidenceDto;
import in.nextalloc.web.dto.NocReviewDecisionInput;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Phase 4A-2C Check 4: Authenticated MockMvc NOC API Security Boundary Tests")
public class NocSecurityControllerTest {

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
    private ObjectMapper objectMapper;

    @Autowired
    private AppProperties props;

    private User candidateUser1;
    private CandidateProfile profile1;
    private String candidateToken1;

    private User candidateUser2;
    private CandidateProfile profile2;
    private String candidateToken2;

    private User adminUser;
    private String adminToken;

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

    private byte[] createSyntheticPdfOfSize(int totalBytes) {
        String header = "%PDF-1.4\n%padding\n";
        String trailer = "\n%%EOF\n";
        byte[] headBytes = header.getBytes(StandardCharsets.ISO_8859_1);
        byte[] tailBytes = trailer.getBytes(StandardCharsets.ISO_8859_1);
        byte[] out = new byte[totalBytes];
        System.arraycopy(headBytes, 0, out, 0, headBytes.length);
        Arrays.fill(out, headBytes.length, totalBytes - tailBytes.length, (byte) 'A');
        System.arraycopy(tailBytes, 0, out, totalBytes - tailBytes.length, tailBytes.length);
        return out;
    }

    @BeforeEach
    void setUp() {
        cleanBaseline();

        // 1. Candidate 1
        candidateUser1 = new User();
        candidateUser1.email = "applicant1_" + UUID.randomUUID() + "@vtu.edu.in";
        candidateUser1.passwordHash = "hash1";
        candidateUser1.name = "Priya Candidate";
        candidateUser1.role = Role.CANDIDATE;
        candidateUser1 = userRepo.save(candidateUser1);

        profile1 = new CandidateProfile();
        profile1.userId = candidateUser1.id;
        profile1.fullName = candidateUser1.name;
        profile1.qualification = Qualification.BACHELORS;
        profile1.candidateStatus = CandidateStatus.STUDENT;
        profile1.state = "Karnataka";
        profile1.district = "Bengaluru Urban";
        profile1 = profileRepo.save(profile1);

        CandidateAcademicRecord acad1 = new CandidateAcademicRecord();
        acad1.candidateId = profile1.id;
        acad1.enrollmentStatus = EnrollmentStatus.ENROLLED_FULL_TIME;
        acad1.degreeProgram = "B.E. Computer Science";
        acad1.institutionName = "Visvesvaraya Technological University";
        acad1.finalYearStatus = FinalYearStatus.VERIFIED_FINAL_YEAR;
        acad1.currentAcademicYear = 4;
        acad1.programDurationYears = 4;
        acad1.expectedCompletionDate = LocalDate.of(2027, 6, 30);
        academicRepo.save(acad1);

        candidateToken1 = jwtService.issue(candidateUser1.id, candidateUser1.email, candidateUser1.name, "CANDIDATE");

        // 2. Candidate 2
        candidateUser2 = new User();
        candidateUser2.email = "applicant2_" + UUID.randomUUID() + "@college.edu.in";
        candidateUser2.passwordHash = "hash2";
        candidateUser2.name = "Rahul Candidate";
        candidateUser2.role = Role.CANDIDATE;
        candidateUser2 = userRepo.save(candidateUser2);

        profile2 = new CandidateProfile();
        profile2.userId = candidateUser2.id;
        profile2.fullName = candidateUser2.name;
        profile2.qualification = Qualification.BACHELORS;
        profile2.candidateStatus = CandidateStatus.STUDENT;
        profile2.state = "Maharashtra";
        profile2.district = "Pune";
        profile2 = profileRepo.save(profile2);

        candidateToken2 = jwtService.issue(candidateUser2.id, candidateUser2.email, candidateUser2.name, "CANDIDATE");

        // 3. Admin User
        adminUser = new User();
        adminUser.email = "officer_" + UUID.randomUUID() + "@pmis.gov.in";
        adminUser.passwordHash = "adminhash";
        adminUser.name = "Reviewing Officer";
        adminUser.role = Role.ADMIN;
        adminUser = userRepo.save(adminUser);

        adminToken = jwtService.issue(adminUser.id, adminUser.email, adminUser.name, "ADMIN");
    }

    private void cleanBaseline() {
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

    @Test
    @DisplayName("Security 1: Candidate uploads their own NOC successfully")
    void sec1_candidateUploadsOwnNoc() throws Exception {
        byte[] pdf = createSamplePdfContent("Candidate 1 Submission");
        MockMultipartFile file = new MockMultipartFile("file", "valid-noc.pdf", "application/pdf", pdf);

        mockMvc.perform(multipart("/api/candidates/me/evidence/noc")
                        .file(file)
                        .param("issuingInstitution", "Visvesvaraya Technological University")
                        .param("signatoryRole", "DEAN")
                        .param("signatoryName", "Dr. Rao")
                        .param("signatoryEmail", "dean@vtu.edu.in")
                        .param("declaresNoAcademicConflict", "true")
                        .header("Authorization", "Bearer " + candidateToken1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.candidateId").value(profile1.id))
                .andExpect(jsonPath("$.evidenceType").value("INSTITUTIONAL_NOC"))
                .andExpect(jsonPath("$.verificationStatus").value("SUBMITTED"))
                .andExpect(jsonPath("$.documentSha256").isNotEmpty());
    }

    @Test
    @DisplayName("Security 2: Candidate cannot download another candidate's NOC by ID (403 Forbidden)")
    void sec2_candidateCannotDownloadOtherCandidateNoc() throws Exception {
        // Upload NOC for Candidate 1
        byte[] pdf = createSamplePdfContent("Candidate 1 Private NOC");
        MockMultipartFile file = new MockMultipartFile("file", "c1.pdf", "application/pdf", pdf);

        MvcResult res = mockMvc.perform(multipart("/api/candidates/me/evidence/noc")
                        .file(file)
                        .param("issuingInstitution", "Visvesvaraya Technological University")
                        .param("signatoryRole", "DEAN")
                        .param("signatoryName", "Dr. Rao")
                        .param("signatoryEmail", "dean@vtu.edu.in")
                        .param("declaresNoAcademicConflict", "true")
                        .header("Authorization", "Bearer " + candidateToken1))
                .andExpect(status().isOk())
                .andReturn();

        NocEvidenceDto dto = objectMapper.readValue(res.getResponse().getContentAsString(), NocEvidenceDto.class);

        // Candidate 2 attempts to download Candidate 1's NOC by ID
        mockMvc.perform(get("/api/candidates/me/evidence/noc/" + dto.id() + "/download")
                        .header("Authorization", "Bearer " + candidateToken2))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security 3: Candidate cannot access admin review endpoints (403 Forbidden)")
    void sec3_candidateCannotAccessAdminReviewEndpoints() throws Exception {
        mockMvc.perform(get("/api/admin/evidence/noc/pending")
                        .header("Authorization", "Bearer " + candidateToken1))
                .andExpect(status().isForbidden());

        mockMvc.perform(post("/api/admin/evidence/noc/1/verify")
                        .header("Authorization", "Bearer " + candidateToken1)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Security 4: Unauthenticated requests fail appropriately (401 Unauthorized)")
    void sec4_unauthenticatedRequestsFail() throws Exception {
        mockMvc.perform(get("/api/candidates/me/evidence/noc"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/admin/evidence/noc/pending"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Security 5: Authorized administrator can review a current submission (200 OK)")
    void sec5_authorizedAdminCanReviewCurrentSubmission() throws Exception {
        // Candidate 1 uploads NOC
        byte[] pdf = createSamplePdfContent("Candidate 1 Submission for Review");
        MockMultipartFile file = new MockMultipartFile("file", "c1.pdf", "application/pdf", pdf);

        MvcResult uploadRes = mockMvc.perform(multipart("/api/candidates/me/evidence/noc")
                        .file(file)
                        .param("issuingInstitution", "Visvesvaraya Technological University")
                        .param("signatoryRole", "DEAN")
                        .param("signatoryName", "Dr. Rao")
                        .param("signatoryEmail", "dean@vtu.edu.in")
                        .param("declaresNoAcademicConflict", "true")
                        .header("Authorization", "Bearer " + candidateToken1))
                .andExpect(status().isOk())
                .andReturn();

        NocEvidenceDto dto = objectMapper.readValue(uploadRes.getResponse().getContentAsString(), NocEvidenceDto.class);

        NocReviewDecisionInput decision = new NocReviewDecisionInput(
                dto.version(),
                null,
                "Approved after reviewing institutional credentials",
                LocalDate.of(2026, 7, 1),
                LocalDate.of(2027, 6, 30)
        );

        mockMvc.perform(post("/api/admin/evidence/noc/" + dto.id() + "/verify")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(decision)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(dto.id()))
                .andExpect(jsonPath("$.verificationStatus").value("VERIFIED"))
                .andExpect(jsonPath("$.verifiedByUserId").value(adminUser.id));
    }

    @Test
    @DisplayName("Security 6: Superseded evidence review returns controlled conflict (409 Conflict)")
    void sec6_supersededEvidenceReviewReturnsConflict() throws Exception {
        // Upload v1
        byte[] pdf1 = createSamplePdfContent("Candidate 1 NOC v1");
        MockMultipartFile file1 = new MockMultipartFile("file", "v1.pdf", "application/pdf", pdf1);

        MvcResult res1 = mockMvc.perform(multipart("/api/candidates/me/evidence/noc")
                        .file(file1)
                        .param("issuingInstitution", "Visvesvaraya Technological University")
                        .param("signatoryRole", "DEAN")
                        .param("signatoryName", "Dr. Rao")
                        .param("signatoryEmail", "dean@vtu.edu.in")
                        .param("declaresNoAcademicConflict", "true")
                        .header("Authorization", "Bearer " + candidateToken1))
                .andExpect(status().isOk())
                .andReturn();
        NocEvidenceDto v1 = objectMapper.readValue(res1.getResponse().getContentAsString(), NocEvidenceDto.class);

        // Upload v2 (superseding v1)
        byte[] pdf2 = createSamplePdfContent("Candidate 1 NOC v2");
        MockMultipartFile file2 = new MockMultipartFile("file", "v2.pdf", "application/pdf", pdf2);

        mockMvc.perform(multipart("/api/candidates/me/evidence/noc")
                        .file(file2)
                        .param("issuingInstitution", "Visvesvaraya Technological University")
                        .param("signatoryRole", "DEAN")
                        .param("signatoryName", "Dr. Rao")
                        .param("signatoryEmail", "dean@vtu.edu.in")
                        .param("declaresNoAcademicConflict", "true")
                        .header("Authorization", "Bearer " + candidateToken1))
                .andExpect(status().isOk());

        // Reviewer attempts to verify superseded v1
        NocReviewDecisionInput decision = new NocReviewDecisionInput(v1.version(), null, "Approve old v1", null, null);
        mockMvc.perform(post("/api/admin/evidence/noc/" + v1.id() + "/verify")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(decision)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.message").value("Evidence ID " + v1.id() + " is not the current active submission for candidate " + profile1.id + "."));
    }

    @Test
    @DisplayName("Security 7: Evidence download does not expose filesystem paths")
    void sec7_evidenceDownloadDoesNotExposeFilesystemPaths() throws Exception {
        byte[] pdf = createSamplePdfContent("Candidate 1 Submission Safe Download");
        MockMultipartFile file = new MockMultipartFile("file", "c1-doc.pdf", "application/pdf", pdf);

        mockMvc.perform(multipart("/api/candidates/me/evidence/noc")
                        .file(file)
                        .param("issuingInstitution", "Visvesvaraya Technological University")
                        .param("signatoryRole", "DEAN")
                        .param("signatoryName", "Dr. Rao")
                        .param("signatoryEmail", "dean@vtu.edu.in")
                        .param("declaresNoAcademicConflict", "true")
                        .header("Authorization", "Bearer " + candidateToken1))
                .andExpect(status().isOk());

        MvcResult dl = mockMvc.perform(get("/api/candidates/me/evidence/noc/download")
                        .header("Authorization", "Bearer " + candidateToken1))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_PDF_VALUE))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andReturn();

        String cdHeader = dl.getResponse().getHeader(HttpHeaders.CONTENT_DISPOSITION);
        assertNotNull(cdHeader);
        // Ensure no absolute Windows or Unix path is leaked in Content-Disposition
        assertFalse(cdHeader.contains("C:"), "Content-Disposition must not leak Windows drive path");
        assertFalse(cdHeader.contains("uploads"), "Content-Disposition must not leak uploads path");
        assertFalse(cdHeader.contains("/"), "Content-Disposition must not contain path separators");
        assertFalse(cdHeader.contains("\\"), "Content-Disposition must not contain backslash path separators");
        assertTrue(cdHeader.startsWith("attachment; filename=\"noc-"));
    }

    @Test
    @DisplayName("Security 8: Upload larger than 5 MB is rejected appropriately")
    void sec8_uploadLargerThan5MbRejected() throws Exception {
        // Create 5.5 MB payload
        byte[] oversized = createSyntheticPdfOfSize((int) (5.5 * 1024 * 1024));
        MockMultipartFile file = new MockMultipartFile("file", "oversized.pdf", "application/pdf", oversized);

        mockMvc.perform(multipart("/api/candidates/me/evidence/noc")
                        .file(file)
                        .param("issuingInstitution", "Visvesvaraya Technological University")
                        .param("signatoryRole", "DEAN")
                        .param("signatoryName", "Dr. Rao")
                        .param("signatoryEmail", "dean@vtu.edu.in")
                        .param("declaresNoAcademicConflict", "true")
                        .header("Authorization", "Bearer " + candidateToken1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("The NOC document must not exceed 5 MB."));
    }

    @Test
    @DisplayName("Security 9: Valid PDF larger than former 1 MB default but within 5 MB (2 MB) is accepted")
    void sec9_validPdfBetween1MbAnd5MbAccepted() throws Exception {
        // Create 2.2 MB valid synthetic PDF
        byte[] validLargePdf = createSyntheticPdfOfSize((int) (2.2 * 1024 * 1024));
        MockMultipartFile file = new MockMultipartFile("file", "large-valid.pdf", "application/pdf", validLargePdf);

        mockMvc.perform(multipart("/api/candidates/me/evidence/noc")
                        .file(file)
                        .param("issuingInstitution", "Visvesvaraya Technological University")
                        .param("signatoryRole", "DEAN")
                        .param("signatoryName", "Dr. Rao")
                        .param("signatoryEmail", "dean@vtu.edu.in")
                        .param("declaresNoAcademicConflict", "true")
                        .header("Authorization", "Bearer " + candidateToken1))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verificationStatus").value("SUBMITTED"));
    }

    @Test
    @DisplayName("Security 10: Invalid PDF content is rejected (400 Bad Request)")
    void sec10_invalidPdfContentRejected() throws Exception {
        // 1. Non-PDF magic header
        byte[] nonPdf = "Not a PDF document at all".getBytes(StandardCharsets.UTF_8);
        MockMultipartFile file1 = new MockMultipartFile("file", "fake.pdf", "application/pdf", nonPdf);

        mockMvc.perform(multipart("/api/candidates/me/evidence/noc")
                        .file(file1)
                        .param("issuingInstitution", "Visvesvaraya Technological University")
                        .param("signatoryRole", "DEAN")
                        .param("signatoryName", "Dr. Rao")
                        .param("signatoryEmail", "dean@vtu.edu.in")
                        .param("declaresNoAcademicConflict", "true")
                        .header("Authorization", "Bearer " + candidateToken1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("The uploaded file does not have a valid PDF header (%PDF)."));

        // 2. Corrupted PDF missing EOF
        byte[] missingEof = "%PDF-1.4\nSome random content without trailer".getBytes(StandardCharsets.ISO_8859_1);
        MockMultipartFile file2 = new MockMultipartFile("file", "corrupt.pdf", "application/pdf", missingEof);

        mockMvc.perform(multipart("/api/candidates/me/evidence/noc")
                        .file(file2)
                        .param("issuingInstitution", "Visvesvaraya Technological University")
                        .param("signatoryRole", "DEAN")
                        .param("signatoryName", "Dr. Rao")
                        .param("signatoryEmail", "dean@vtu.edu.in")
                        .param("declaresNoAcademicConflict", "true")
                        .header("Authorization", "Bearer " + candidateToken1))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("The uploaded PDF is corrupted or incomplete (missing %%EOF marker)."));
    }

    @Test
    @DisplayName("Security 11: No review event can be forged with caller-supplied reviewer ID")
    void sec11_noReviewEventCanBeForgedWithCallerSuppliedReviewerId() throws Exception {
        byte[] pdf = createSamplePdfContent("Audit Reviewer Proof");
        MockMultipartFile file = new MockMultipartFile("file", "audit.pdf", "application/pdf", pdf);

        MvcResult uploadRes = mockMvc.perform(multipart("/api/candidates/me/evidence/noc")
                        .file(file)
                        .param("issuingInstitution", "Visvesvaraya Technological University")
                        .param("signatoryRole", "DEAN")
                        .param("signatoryName", "Dr. Rao")
                        .param("signatoryEmail", "dean@vtu.edu.in")
                        .param("declaresNoAcademicConflict", "true")
                        .header("Authorization", "Bearer " + candidateToken1))
                .andExpect(status().isOk())
                .andReturn();

        NocEvidenceDto dto = objectMapper.readValue(uploadRes.getResponse().getContentAsString(), NocEvidenceDto.class);

        // Even if caller injects extra malicious JSON attributes (e.g. "reviewerId": 99999, "verifiedByUserId": 99999)
        String maliciousPayload = "{\"expectedVersion\":" + dto.version() + ",\"notes\":\"Approved\",\"reviewerId\":99999,\"verifiedByUserId\":99999}";

        mockMvc.perform(post("/api/admin/evidence/noc/" + dto.id() + "/verify")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(maliciousPayload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.verifiedByUserId").value(adminUser.id)); // Must match adminUser.id from token, never 99999

        // Verify in DB audit trail that actor is authenticated admin, never forged ID
        List<AuditEvent> audits = auditRepo.findAll();
        AuditEvent verifyAudit = audits.stream()
                .filter(a -> a.action == AuditAction.NOC_VERIFIED && dto.id().toString().equals(a.targetId))
                .findFirst()
                .orElseThrow();
        assertEquals(adminUser.id, verifyAudit.actorUserId);
        assertEquals(adminUser.name, verifyAudit.actorName);
        assertTrue(verifyAudit.detailsJson.contains("\"reviewerId\":" + adminUser.id));
        assertFalse(verifyAudit.detailsJson.contains("99999"));
    }
}
