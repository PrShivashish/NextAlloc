package in.nextalloc.web.dto;

import java.time.Instant;
import java.time.LocalDate;

import in.nextalloc.domain.CandidateAcademicRecord;
import in.nextalloc.domain.enums.EnrollmentStatus;
import in.nextalloc.domain.enums.FinalYearStatus;

public record CandidateAcademicDto(
        Long id,
        Long candidateId,
        EnrollmentStatus enrollmentStatus,
        String degreeProgram,
        String institutionName,
        String institutionAisheCode,
        Integer currentAcademicYear,
        Integer programDurationYears,
        FinalYearStatus finalYearStatus,
        LocalDate expectedCompletionDate,
        Instant updatedAt,
        Long version
) {
    public static CandidateAcademicDto from(CandidateAcademicRecord ar) {
        if (ar == null) return null;
        return new CandidateAcademicDto(
                ar.id,
                ar.candidateId,
                ar.enrollmentStatus,
                ar.degreeProgram,
                ar.institutionName,
                ar.institutionAisheCode,
                ar.currentAcademicYear,
                ar.programDurationYears,
                ar.finalYearStatus,
                ar.expectedCompletionDate,
                ar.updatedAt,
                ar.version
        );
    }
}
