package in.pragati.web.dto;

import java.time.LocalDate;
import in.pragati.domain.enums.EligibilityReasonCode;

public record NocReviewDecisionInput(
        Integer expectedVersion,
        EligibilityReasonCode reasonCode,
        String notes,
        LocalDate validFrom,
        LocalDate validUntil
) {}
