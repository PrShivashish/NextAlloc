package in.nextalloc.web.dto;

import java.time.Instant;
import java.time.LocalDate;

import in.nextalloc.domain.CandidateAcademicRecord;
import in.nextalloc.domain.CandidateEvidence;
import in.nextalloc.domain.CandidateProfile;
import in.nextalloc.domain.User;
import in.nextalloc.domain.enums.EligibilityReasonCode;
import in.nextalloc.domain.enums.EnrollmentStatus;
import in.nextalloc.domain.enums.EvidenceStatus;
import in.nextalloc.domain.enums.FinalYearStatus;
import in.nextalloc.domain.enums.SignatoryRole;

public record NocReviewQueueItemDto(
        Long id,
        Long candidateId,
        String evidenceType,
        String documentSha256,
        String issuingInstitution,
        SignatoryRole signatoryRole,
        String signatoryName,
        String signatoryEmail,
        boolean declaresNoAcademicConflict,
        LocalDate validFrom,
        LocalDate validUntil,
        EvidenceStatus verificationStatus,
        Instant verifiedAt,
        Long verifiedByUserId,
        EligibilityReasonCode rejectionReasonCode,
        String rejectionNotes,
        Integer version,
        Instant createdAt,
        Instant updatedAt,

        // Candidate academic & identity context
        String candidateName,
        String candidateEmail,
        String candidatePhone,
        EnrollmentStatus academicEnrollmentStatus,
        String academicDegreeProgram,
        String academicInstitutionName,
        String academicInstitutionAisheCode,
        FinalYearStatus academicFinalYearStatus,
        Integer currentAcademicYear,
        Integer programDurationYears,
        LocalDate expectedCompletionDate,
        String signatoryValidationWarning
) {
    public static NocReviewQueueItemDto from(CandidateEvidence e, CandidateProfile p, User u, CandidateAcademicRecord acad, String warning) {
        if (e == null) return null;
        return new NocReviewQueueItemDto(
                e.id,
                e.candidateId,
                e.evidenceType,
                e.documentSha256,
                e.issuingInstitution,
                e.signatoryRole,
                e.signatoryName,
                e.signatoryEmail,
                e.declaresNoAcademicConflict,
                e.validFrom,
                e.validUntil,
                e.verificationStatus,
                e.verifiedAt,
                e.verifiedByUserId,
                e.rejectionReasonCode,
                e.rejectionNotes,
                e.version,
                e.createdAt,
                e.updatedAt,

                p != null ? p.fullName : (u != null ? u.name : null),
                u != null ? u.email : null,
                p != null ? p.phone : null,
                acad != null ? acad.enrollmentStatus : null,
                acad != null ? acad.degreeProgram : null,
                acad != null ? acad.institutionName : null,
                acad != null ? acad.institutionAisheCode : null,
                acad != null ? acad.finalYearStatus : null,
                acad != null ? acad.currentAcademicYear : null,
                acad != null ? acad.programDurationYears : null,
                acad != null ? acad.expectedCompletionDate : null,
                warning
        );
    }
}
