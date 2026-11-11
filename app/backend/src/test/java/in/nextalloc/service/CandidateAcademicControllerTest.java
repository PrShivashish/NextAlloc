package in.nextalloc.service;

import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

import com.fasterxml.jackson.databind.ObjectMapper;

import in.nextalloc.domain.AllocationEligibilitySnapshot;
import in.nextalloc.domain.AllocationRun;
import in.nextalloc.domain.CandidateAcademicRecord;
import in.nextalloc.domain.CandidateEvidence;
import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.User;
import in.nextalloc.domain.enums.EligibilityDecision;
import in.nextalloc.domain.enums.EligibilityReasonCode;
import in.nextalloc.domain.enums.EnrollmentStatus;
import in.nextalloc.domain.enums.EvidenceStatus;
import in.nextalloc.domain.enums.FinalYearStatus;
import in.nextalloc.domain.enums.Role;
import in.nextalloc.domain.enums.SignatoryRole;
import in.nextalloc.repo.AllocationEligibilitySnapshotRepository;
import in.nextalloc.repo.AllocationRunRepository;
import in.nextalloc.repo.CandidateAcademicRecordRepository;
import in.nextalloc.repo.CandidateEvidenceRepository;
import in.nextalloc.repo.CandidateProfileRepository;
import in.nextalloc.repo.UserRepository;
import in.nextalloc.security.JwtService;
import in.nextalloc.web.dto.CandidateAcademicDto;
import in.nextalloc.web.dto.CandidateAcademicInput;

@SpringBootTest
@AutoConfigureMockMvc
@DisplayName("Phase 4A-2C Commit 3A: Candidate Academic Self-Service & Trust Boundary Tests")
public class CandidateAcademicControllerTest {

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
    private AllocationEligibilitySnapshotRepository snapshotRepo;

    @Autowired
    private AllocationRunRepository runRepo;

    @Autowired
    private EligibilityEvaluator eligibilityEvaluator;

    @Autowired
    private ObjectMapper objectMapper;

    private User candUser1;
    private CandidateProfile profile1;
    private String token1;

    private User candUser2;
    private CandidateProfile profile2;
    private String token2;

    private User adminUser;
    private String adminToken;

    @BeforeEach
    void setUp() {
        academicRepo.deleteAll();

        candUser1 = userRepo.findByEmail("acad-cand1-" + UUID.randomUUID() + "@test.in").orElseGet(() -> {
            User u = new User();
            u.email = "acad-cand1-" + UUID.randomUUID() + "@test.in";
            u.passwordHash = "hash1";
            u.name = "Candidate One";
            u.role = Role.CANDIDATE;
            return userRepo.save(u);
        });

        profile1 = new CandidateProfile();
        profile1.userId = candUser1.id;
        profile1.fullName = "Candidate One";
        profile1.phone = "9876543210";
        profile1 = profileRepo.save(profile1);
        token1 = jwtService.issue(candUser1.id, candUser1.email, candUser1.name, "CANDIDATE");

        candUser2 = userRepo.findByEmail("acad-cand2-" + UUID.randomUUID() + "@test.in").orElseGet(() -> {
            User u = new User();
            u.email = "acad-cand2-" + UUID.randomUUID() + "@test.in";
            u.passwordHash = "hash2";
            u.name = "Candidate Two";
            u.role = Role.CANDIDATE;
            return userRepo.save(u);
        });

        profile2 = new CandidateProfile();
        profile2.userId = candUser2.id;
        profile2.fullName = "Candidate Two";
        profile2.phone = "9876543211";
        profile2 = profileRepo.save(profile2);
        token2 = jwtService.issue(candUser2.id, candUser2.email, candUser2.name, "CANDIDATE");

        adminUser = userRepo.findByEmail("acad-admin@pragati.gov.in").orElseGet(() -> {
            User u = new User();
            u.email = "acad-admin@pragati.gov.in";
            u.passwordHash = "adminHash";
            u.name = "Admin Reviewer";
            u.role = Role.ADMIN;
            return userRepo.save(u);
        });
        adminToken = jwtService.issue(adminUser.id, adminUser.email, adminUser.name, "ADMIN");
    }

    @AfterEach
    void tearDown() {
        academicRepo.deleteAll();
    }

    @Test
    @DisplayName("Case 1: Candidate creates their academic declaration (final year -> CLAIMED_FINAL_YEAR)")
    void candidateCreatesAcademicDeclaration() throws Exception {
        CandidateAcademicInput input = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.Tech Computer Science",
                "National Technology Institute",
                "U-12345",
                4,
                4,
                LocalDate.of(2026, 6, 30)
        );

        MvcResult res = mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk())
                .andReturn();

        CandidateAcademicDto dto = objectMapper.readValue(res.getResponse().getContentAsString(), CandidateAcademicDto.class);
        assertNotNull(dto.id());
        assertEquals(profile1.id, dto.candidateId());
        assertEquals(EnrollmentStatus.ENROLLED_FULL_TIME, dto.enrollmentStatus());
        assertEquals("B.Tech Computer Science", dto.degreeProgram());
        assertEquals("National Technology Institute", dto.institutionName());
        assertEquals("U-12345", dto.institutionAisheCode());
        assertEquals(4, dto.currentAcademicYear());
        assertEquals(4, dto.programDurationYears());
        // Crucial security boundary: self-declaration in final year sets CLAIMED_FINAL_YEAR, NOT VERIFIED_FINAL_YEAR
        assertEquals(FinalYearStatus.CLAIMED_FINAL_YEAR, dto.finalYearStatus());
        assertNotNull(dto.updatedAt());
    }

    @Test
    @DisplayName("Case 2: Candidate retrieves own declaration")
    void candidateRetrievesOwnDeclaration() throws Exception {
        // Initially empty
        mockMvc.perform(get("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1))
                .andExpect(status().isOk())
                .andExpect(content().string(""));

        // Create declaration
        CandidateAcademicInput input = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "M.Sc Data Science",
                "Indian Institute of Science",
                "U-99999",
                2,
                2,
                LocalDate.of(2026, 7, 31)
        );

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk());

        // Now retrieve
        MvcResult res = mockMvc.perform(get("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1))
                .andExpect(status().isOk())
                .andReturn();

        CandidateAcademicDto dto = objectMapper.readValue(res.getResponse().getContentAsString(), CandidateAcademicDto.class);
        assertEquals("M.Sc Data Science", dto.degreeProgram());
        assertEquals(FinalYearStatus.CLAIMED_FINAL_YEAR, dto.finalYearStatus());
    }

    @Test
    @DisplayName("Case 3: Candidate updates permitted fields")
    void candidateUpdatesPermittedFields() throws Exception {
        CandidateAcademicInput input1 = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.Tech Information Technology",
                "Delhi Technological University",
                "U-11111",
                3,
                4,
                LocalDate.of(2027, 6, 30)
        );

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input1)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentAcademicYear").value(3))
                .andExpect(jsonPath("$.programDurationYears").value(4))
                .andExpect(jsonPath("$.finalYearStatus").value("UNKNOWN"));

        // Advance to final year
        CandidateAcademicInput input2 = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.Tech Information Technology",
                "Delhi Technological University",
                "U-11111",
                4,
                4,
                LocalDate.of(2027, 6, 30)
        );

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input2)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentAcademicYear").value(4))
                .andExpect(jsonPath("$.finalYearStatus").value("CLAIMED_FINAL_YEAR"));
    }

    @Test
    @DisplayName("Case 4: Another candidate cannot modify the first candidate's record (Strict self-scope)")
    void candidateCannotModifyOtherCandidate() throws Exception {
        CandidateAcademicInput input1 = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.E. Mechanical",
                "Anna University",
                "U-22222",
                4,
                4,
                LocalDate.of(2026, 5, 30)
        );

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input1)))
                .andExpect(status().isOk());

        // Candidate 2 submits their own record
        CandidateAcademicInput input2 = new CandidateAcademicInput(
                EnrollmentStatus.NOT_ENROLLED,
                "B.Com",
                "Delhi University",
                null,
                null,
                null,
                null
        );

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token2)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input2)))
                .andExpect(status().isOk());

        // Candidate 1's record remains unaffected
        CandidateAcademicRecord ar1 = academicRepo.findByCandidateId(profile1.id).orElseThrow();
        assertEquals("B.E. Mechanical", ar1.degreeProgram);
        assertEquals("Anna University", ar1.institutionName);

        // Candidate 2's record is distinct
        CandidateAcademicRecord ar2 = academicRepo.findByCandidateId(profile2.id).orElseThrow();
        assertEquals("B.Com", ar2.degreeProgram);
        assertEquals("Delhi University", ar2.institutionName);
    }

    @Test
    @DisplayName("Case 5: Candidate cannot self-assign verified final-year status (Rejected with 400)")
    void candidateCannotSelfAssignVerifiedFinalYear() throws Exception {
        // Attempting to send privilege-escalating finalYearStatus field in JSON
        String maliciousPayload = """
            {
                "enrollmentStatus": "ENROLLED_FULL_TIME",
                "degreeProgram": "B.Tech CS",
                "institutionName": "Fake University",
                "currentAcademicYear": 4,
                "programDurationYears": 4,
                "finalYearStatus": "VERIFIED_FINAL_YEAR"
            }
            """;

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(maliciousPayload))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Case 6: Candidate cannot change candidateId or owner metadata (Rejected with 400)")
    void candidateCannotInjectCandidateId() throws Exception {
        String maliciousPayload = """
            {
                "candidateId": 99999,
                "enrollmentStatus": "ENROLLED_FULL_TIME",
                "degreeProgram": "B.Tech CS",
                "institutionName": "Fake University",
                "currentAcademicYear": 4,
                "programDurationYears": 4
            }
            """;

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(maliciousPayload))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Case 7: Invalid academic year exceeding program duration is rejected (400)")
    void invalidYearExceedingDurationRejected() throws Exception {
        CandidateAcademicInput input = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.Tech CS",
                "Test Institute",
                "U-12345",
                5, // Year 5 in a 4-year program!
                4,
                LocalDate.of(2026, 6, 30)
        );

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Case 8: Invalid or inconsistent dates rejected (400)")
    void invalidDatesRejected() throws Exception {
        CandidateAcademicInput input = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.Tech CS",
                "Test Institute",
                "U-12345",
                4,
                4,
                LocalDate.of(2010, 1, 1) // 16 years in the past!
        );

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Case 9: Duplicate and concurrent updates remain safe (idempotent PUT)")
    void duplicateUpdatesIdempotent() throws Exception {
        CandidateAcademicInput input = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.Tech CS",
                "IIT Bombay",
                "U-10001",
                4,
                4,
                LocalDate.of(2026, 6, 30)
        );

        // Put once
        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk());

        // Put twice
        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk());

        // Exactly one row exists in DB for this candidate
        List<CandidateAcademicRecord> records = academicRepo.findAll().stream()
                .filter(r -> r.candidateId.equals(profile1.id))
                .toList();
        assertEquals(1, records.size());
    }

    @Test
    @DisplayName("Case 10a: Exact no-op update preserves an existing verified status")
    void exactNoOpPreservesVerifiedStatus() throws Exception {
        // Precondition: Candidate had previously achieved VERIFIED_FINAL_YEAR
        CandidateAcademicRecord verified = new CandidateAcademicRecord();
        verified.candidateId = profile1.id;
        verified.enrollmentStatus = EnrollmentStatus.ENROLLED_FULL_TIME;
        verified.institutionName = "BITS Pilani";
        verified.institutionAisheCode = "U-40001";
        verified.degreeProgram = "B.E. Computer Science";
        verified.currentAcademicYear = 4;
        verified.programDurationYears = 4;
        verified.expectedCompletionDate = LocalDate.of(2026, 6, 30);
        verified.finalYearStatus = FinalYearStatus.VERIFIED_FINAL_YEAR;
        academicRepo.save(verified);

        // Candidate submits exact unchanged data: VERIFIED_FINAL_YEAR preserved
        CandidateAcademicInput inputSame = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.E. Computer Science",
                "BITS Pilani",
                "U-40001",
                4,
                4,
                LocalDate.of(2026, 6, 30)
        );

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(inputSame)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.finalYearStatus").value("VERIFIED_FINAL_YEAR"));
    }

    @Test
    @DisplayName("Case 10b: Changing institution or AISHE code invalidates a previous academic verification")
    void changingInstitutionOrAisheInvalidatesVerification() throws Exception {
        CandidateAcademicRecord verified = new CandidateAcademicRecord();
        verified.candidateId = profile1.id;
        verified.enrollmentStatus = EnrollmentStatus.ENROLLED_FULL_TIME;
        verified.institutionName = "BITS Pilani";
        verified.institutionAisheCode = "U-40001";
        verified.degreeProgram = "B.E. Computer Science";
        verified.currentAcademicYear = 4;
        verified.programDurationYears = 4;
        verified.expectedCompletionDate = LocalDate.of(2026, 6, 30);
        verified.finalYearStatus = FinalYearStatus.VERIFIED_FINAL_YEAR;
        academicRepo.save(verified);

        // 1. Changing institution name resets to CLAIMED_FINAL_YEAR
        CandidateAcademicInput diffInst = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.E. Computer Science",
                "Different University",
                "U-40001",
                4,
                4,
                LocalDate.of(2026, 6, 30)
        );
        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(diffInst)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.finalYearStatus").value("CLAIMED_FINAL_YEAR"));

        // Re-establish verified status
        verified = academicRepo.findByCandidateId(profile1.id).orElseThrow();
        verified.institutionName = "BITS Pilani";
        verified.finalYearStatus = FinalYearStatus.VERIFIED_FINAL_YEAR;
        academicRepo.save(verified);

        // 2. Changing AISHE code resets to CLAIMED_FINAL_YEAR
        CandidateAcademicInput diffAishe = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.E. Computer Science",
                "BITS Pilani",
                "U-99999",
                4,
                4,
                LocalDate.of(2026, 6, 30)
        );
        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(diffAishe)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.finalYearStatus").value("CLAIMED_FINAL_YEAR"));
    }

    @Test
    @DisplayName("Case 10c: Changing enrollment status invalidates applicable verification")
    void changingEnrollmentStatusInvalidatesVerification() throws Exception {
        CandidateAcademicRecord verified = new CandidateAcademicRecord();
        verified.candidateId = profile1.id;
        verified.enrollmentStatus = EnrollmentStatus.ENROLLED_FULL_TIME;
        verified.institutionName = "BITS Pilani";
        verified.institutionAisheCode = "U-40001";
        verified.degreeProgram = "B.E. Computer Science";
        verified.currentAcademicYear = 4;
        verified.programDurationYears = 4;
        verified.expectedCompletionDate = LocalDate.of(2026, 6, 30);
        verified.finalYearStatus = FinalYearStatus.VERIFIED_FINAL_YEAR;
        academicRepo.save(verified);

        // Change enrollment status to NOT_ENROLLED
        CandidateAcademicInput unEnrolled = new CandidateAcademicInput(
                EnrollmentStatus.NOT_ENROLLED,
                "B.E. Computer Science",
                "BITS Pilani",
                "U-40001",
                null,
                null,
                null
        );

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(unEnrolled)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.enrollmentStatus").value("NOT_ENROLLED"))
                .andExpect(jsonPath("$.finalYearStatus").value("UNKNOWN"));
    }

    @Test
    @DisplayName("Case 10d: Changing expected completion date triggers re-evaluation and invalidates previous verification")
    void changingExpectedCompletionDateInvalidatesVerification() throws Exception {
        CandidateAcademicRecord verified = new CandidateAcademicRecord();
        verified.candidateId = profile1.id;
        verified.enrollmentStatus = EnrollmentStatus.ENROLLED_FULL_TIME;
        verified.institutionName = "BITS Pilani";
        verified.institutionAisheCode = "U-40001";
        verified.degreeProgram = "B.E. Computer Science";
        verified.currentAcademicYear = 4;
        verified.programDurationYears = 4;
        verified.expectedCompletionDate = LocalDate.of(2026, 6, 30);
        verified.finalYearStatus = FinalYearStatus.VERIFIED_FINAL_YEAR;
        academicRepo.save(verified);

        // Change expected completion date
        CandidateAcademicInput diffDate = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.E. Computer Science",
                "BITS Pilani",
                "U-40001",
                4,
                4,
                LocalDate.of(2027, 6, 30)
        );

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(diffDate)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.finalYearStatus").value("CLAIMED_FINAL_YEAR"));
    }

    @Test
    @DisplayName("Case 10e: A student claiming non-final year receives UNKNOWN rather than authoritative VERIFIED_NOT_FINAL_YEAR")
    void nonFinalYearDeclarationDoesNotCreateVerifiedNotFinalYear() throws Exception {
        CandidateAcademicInput input = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.Tech Mechanical",
                "IIT Delhi",
                "U-10002",
                2, // Year 2 of 4
                4,
                LocalDate.of(2028, 5, 31)
        );

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.currentAcademicYear").value(2))
                .andExpect(jsonPath("$.programDurationYears").value(4))
                .andExpect(jsonPath("$.finalYearStatus").value("UNKNOWN"));
    }

    @Test
    @DisplayName("Case 11 & 13: Unauthorized callers receive correct HTTP responses")
    void unauthorizedAccessHandling() throws Exception {
        CandidateAcademicInput input = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.Tech CS",
                "Test Institute",
                "U-12345",
                4,
                4,
                LocalDate.of(2026, 6, 30)
        );

        // No token -> 401
        mockMvc.perform(get("/api/candidates/me/academic"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(put("/api/candidates/me/academic")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isUnauthorized());

        // Admin token on candidate endpoint -> 403 Forbidden
        mockMvc.perform(get("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken))
                .andExpect(status().isForbidden());

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + adminToken)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Case 12: Previous allocation eligibility snapshots remain unchanged when academic declaration updates")
    void snapshotsRemainUnchangedOnAcademicUpdate() throws Exception {
        // Pre-create an actual allocation run to satisfy foreign key FK_ELIGSANP_RUN
        AllocationRun testRun = new AllocationRun();
        testRun.scenario = in.nextalloc.domain.enums.ScenarioKey.STANDARD_SHOWCASE;
        testRun.status = in.nextalloc.domain.enums.RunStatus.COMPLETED;
        testRun.policyKey = "balanced";
        testRun.policyName = "Balanced";
        testRun.policyVersion = "v2";
        testRun.weightsJson = "{}";
        testRun.number = 1;
        testRun.snapshotId = 1L;
        testRun.runCode = "RUN-TEST-" + UUID.randomUUID().toString().substring(0, 8);
        testRun = runRepo.save(testRun);

        // Pre-create historical snapshot for candidate 1
        AllocationEligibilitySnapshot snap = new AllocationEligibilitySnapshot();
        snap.runId = testRun.id;
        snap.candidateId = profile1.id;
        snap.decision = EligibilityDecision.INELIGIBLE;
        snap.reasonCodesJson = "[\"INSTITUTIONAL_NOC_UNVERIFIED\"]";
        snap.evidenceIdRef = 123L;
        snap.evidenceStatusSnapshot = "SUBMITTED";
        snap.evaluatedAt = java.time.Instant.now();
        snapshotRepo.save(snap);

        // Candidate updates academic declaration
        CandidateAcademicInput input = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.Tech Mechanical",
                "IIT Delhi",
                "U-10002",
                4,
                4,
                LocalDate.of(2026, 6, 30)
        );

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk());

        // Snapshot in database remains immutable
        AllocationEligibilitySnapshot loadedSnap = snapshotRepo.findByRunIdAndCandidateId(testRun.id, profile1.id).orElseThrow();
        assertEquals(EligibilityDecision.INELIGIBLE, loadedSnap.decision);
        assertEquals("SUBMITTED", loadedSnap.evidenceStatusSnapshot);
        assertEquals(123L, loadedSnap.evidenceIdRef);
    }

    @Test
    @DisplayName("Case 14: Existing NOC evidence remains untouched when academic declaration updates")
    void existingNocEvidenceUntouched() throws Exception {
        CandidateEvidence ev = new CandidateEvidence();
        ev.candidateId = profile1.id;
        ev.evidenceType = "INSTITUTIONAL_NOC";
        ev.documentReference = "noc/test.pdf";
        ev.documentSha256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        ev.issuingInstitution = "Initial College";
        ev.signatoryRole = SignatoryRole.PRINCIPAL;
        ev.signatoryName = "Dr. Principal";
        ev.signatoryEmail = "prin@init.ac.in";
        ev.declaresNoAcademicConflict = true;
        ev.verificationStatus = EvidenceStatus.SUBMITTED;
        CandidateEvidence savedEv = evidenceRepo.save(ev);

        // Candidate updates academic declaration
        CandidateAcademicInput input = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.Tech CS",
                "Updated College Name",
                "U-55555",
                4,
                4,
                LocalDate.of(2026, 6, 30)
        );

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk());

        // Candidate evidence was not altered
        CandidateEvidence loadedEv = evidenceRepo.findById(savedEv.id).orElseThrow();
        assertEquals("Initial College", loadedEv.issuingInstitution);
        assertEquals(EvidenceStatus.SUBMITTED, loadedEv.verificationStatus);
    }

    @Test
    @DisplayName("Case 15: Candidate with self-declared CLAIMED_FINAL_YEAR is rejected by EligibilityEvaluator")
    void claimedFinalYearRejectedByEvaluator() throws Exception {
        // Candidate declares final year via API
        CandidateAcademicInput input = new CandidateAcademicInput(
                EnrollmentStatus.ENROLLED_FULL_TIME,
                "B.Tech CS",
                "State Tech University",
                "U-77777",
                4,
                4,
                LocalDate.of(2026, 6, 30)
        );

        mockMvc.perform(put("/api/candidates/me/academic")
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + token1)
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(input)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.finalYearStatus").value("CLAIMED_FINAL_YEAR"));

        CandidateAcademicRecord acad = academicRepo.findByCandidateId(profile1.id).orElseThrow();

        // Also add a verified NOC
        CandidateEvidence ev = new CandidateEvidence();
        ev.candidateId = profile1.id;
        ev.evidenceType = "INSTITUTIONAL_NOC";
        ev.documentReference = "noc/test.pdf";
        ev.documentSha256 = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
        ev.issuingInstitution = "State Tech University";
        ev.signatoryRole = SignatoryRole.PRINCIPAL;
        ev.signatoryName = "Dr. Principal";
        ev.signatoryEmail = "prin@state.ac.in";
        ev.declaresNoAcademicConflict = true;
        ev.verificationStatus = EvidenceStatus.VERIFIED;
        evidenceRepo.save(ev);

        profile1.candidateState = in.nextalloc.domain.enums.CandidateState.ACTIVE;
        profile1.dob = LocalDate.of(2003, 1, 1);
        profile1.employmentType = in.nextalloc.domain.enums.EmploymentType.UNEMPLOYED;
        profileRepo.save(profile1);

        // Evaluate candidate under pmis-2026-expansion-demo-v1
        EligibilityEvaluator.CandidateEvaluation eval = eligibilityEvaluator.evaluateCandidate(
                "pmis-2026-expansion-demo-v1",
                "1.0.0",
                profile1,
                acad,
                List.of(ev),
                LocalDate.of(2026, 5, 1)
        );

        // Result: INELIGIBLE because CLAIMED_FINAL_YEAR is unverified!
        assertFalse(eval.isEligible(), "Candidate with CLAIMED_FINAL_YEAR must NOT be eligible");
        assertEquals(EligibilityDecision.INELIGIBLE, eval.decision());
        assertTrue(eval.reasonCodes().contains(EligibilityReasonCode.ACADEMIC_STANDING_UNVERIFIED),
                "Expected ACADEMIC_STANDING_UNVERIFIED reason code");
    }
}
