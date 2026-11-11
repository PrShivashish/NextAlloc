package in.nextalloc.web.dto;

import java.time.LocalDate;

import com.fasterxml.jackson.annotation.JsonAnySetter;
import in.nextalloc.common.ApiException;
import in.nextalloc.domain.enums.EnrollmentStatus;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Candidate academic enrollment declaration payload.
 *
 * Security: Property-level authorization strictly prevents client-side
 * injection of verification or audit properties. Unknown properties (such as
 * finalYearStatus, candidateId, id, or verifiedByUserId) are rejected with HTTP 400.
 */
public class CandidateAcademicInput {

    @NotNull(message = "Enrollment status is required.")
    public EnrollmentStatus enrollmentStatus;

    @NotBlank(message = "Degree program is required.")
    @Size(max = 120, message = "Degree program must not exceed 120 characters.")
    public String degreeProgram;

    @NotBlank(message = "Institution name is required.")
    @Size(max = 200, message = "Institution name must not exceed 200 characters.")
    public String institutionName;

    @Size(max = 30, message = "Institution AISHE code must not exceed 30 characters.")
    public String institutionAisheCode;

    @Min(value = 1, message = "Current academic year must be at least 1.")
    @Max(value = 6, message = "Current academic year must not exceed 6.")
    public Integer currentAcademicYear;

    @Min(value = 1, message = "Program duration must be at least 1 year.")
    @Max(value = 6, message = "Program duration must not exceed 6 years.")
    public Integer programDurationYears;

    public LocalDate expectedCompletionDate;
    public Long expectedVersion;

    public CandidateAcademicInput() {}

    public CandidateAcademicInput(EnrollmentStatus enrollmentStatus,
                                  String degreeProgram,
                                  String institutionName,
                                  String institutionAisheCode,
                                  Integer currentAcademicYear,
                                  Integer programDurationYears,
                                  LocalDate expectedCompletionDate) {
        this(enrollmentStatus, degreeProgram, institutionName, institutionAisheCode,
             currentAcademicYear, programDurationYears, expectedCompletionDate, null);
    }

    public CandidateAcademicInput(EnrollmentStatus enrollmentStatus,
                                  String degreeProgram,
                                  String institutionName,
                                  String institutionAisheCode,
                                  Integer currentAcademicYear,
                                  Integer programDurationYears,
                                  LocalDate expectedCompletionDate,
                                  Long expectedVersion) {
        this.enrollmentStatus = enrollmentStatus;
        this.degreeProgram = degreeProgram;
        this.institutionName = institutionName;
        this.institutionAisheCode = institutionAisheCode;
        this.currentAcademicYear = currentAcademicYear;
        this.programDurationYears = programDurationYears;
        this.expectedCompletionDate = expectedCompletionDate;
        this.expectedVersion = expectedVersion;
    }

    public EnrollmentStatus enrollmentStatus() { return enrollmentStatus; }
    public String degreeProgram() { return degreeProgram; }
    public String institutionName() { return institutionName; }
    public String institutionAisheCode() { return institutionAisheCode; }
    public Integer currentAcademicYear() { return currentAcademicYear; }
    public Integer programDurationYears() { return programDurationYears; }
    public LocalDate expectedCompletionDate() { return expectedCompletionDate; }
    public Long expectedVersion() { return expectedVersion; }

    @JsonAnySetter
    public void handleUnknown(String key, Object value) {
        throw ApiException.badRequest("Unknown or unauthorized property: '" + key + "'. Candidate self-service cannot set server-controlled or verified fields.");
    }
}
