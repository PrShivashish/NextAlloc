package in.nextalloc.web.dto;

import java.time.LocalDate;
import in.nextalloc.domain.enums.EligibilityReasonCode;

public record NocReviewDecisionInput(
        Integer expectedVersion,
        EligibilityReasonCode reasonCode,
        String notes,
        LocalDate validFrom,
        LocalDate validUntil
) {}
