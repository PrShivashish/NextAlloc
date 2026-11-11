package in.nextalloc.web.dto;

import java.time.Instant;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record AcademicReviewInput(
        @NotNull(message = "Review decision is required.")
        AcademicReviewDecision decision,

        @NotBlank(message = "Review notes/comments are required.")
        @Size(max = 1000, message = "Review notes must not exceed 1000 characters.")
        String notes,

        Long supportingEvidenceId,

        Instant expectedUpdatedAt,

        Long expectedVersion
) {
}
