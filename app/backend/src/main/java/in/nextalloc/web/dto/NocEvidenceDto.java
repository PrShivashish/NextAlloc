package in.nextalloc.web.dto;

import java.time.Instant;
import java.time.LocalDate;

import in.nextalloc.domain.CandidateEvidence;
import in.nextalloc.domain.enums.EligibilityReasonCode;
import in.nextalloc.domain.enums.EvidenceStatus;
import in.nextalloc.domain.enums.SignatoryRole;

public record NocEvidenceDto(
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
        Instant updatedAt
) {
    public static NocEvidenceDto from(CandidateEvidence e) {
        if (e == null) return null;
        return new NocEvidenceDto(
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
                e.updatedAt
        );
    }
}
