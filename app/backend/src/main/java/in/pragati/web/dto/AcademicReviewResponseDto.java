package in.pragati.web.dto;

import java.time.Instant;
import java.time.LocalDate;

import in.pragati.domain.enums.EnrollmentStatus;
import in.pragati.domain.enums.FinalYearStatus;

public record AcademicReviewResponseDto(
        Long candidateId,
        Long academicRecordId,
        EnrollmentStatus enrollmentStatus,
        String degreeProgram,
        String institutionName,
        String institutionAisheCode,
        Integer currentAcademicYear,
        Integer programDurationYears,
        FinalYearStatus finalYearStatus,
        LocalDate expectedCompletionDate,
        Instant updatedAt,
        Long version,
        Long supportingEvidenceId,
        String reviewNotes,
        Long reviewedByUserId,
        String reviewerName,
        Instant reviewedAt
) {
}
