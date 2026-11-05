package in.pragati.web.dto;

import java.time.LocalDate;
import in.pragati.domain.enums.SignatoryRole;

public record NocSubmissionInput(
        String issuingInstitution,
        SignatoryRole signatoryRole,
        String signatoryName,
        String signatoryEmail,
        boolean declaresNoAcademicConflict,
        LocalDate validFrom,
        LocalDate validUntil
) {}
