package in.nextalloc.web.dto;

import com.fasterxml.jackson.annotation.JsonCreator;

public enum AcademicReviewDecision {
    APPROVE,
    REJECT,
    VERIFY_NOT_FINAL_YEAR;

    @JsonCreator
    public static AcademicReviewDecision fromString(String val) {
        if (val == null) {
            return null;
        }
        String normalized = val.trim().toUpperCase();
        if (normalized.equals("APPROVE_FINAL_YEAR") || normalized.equals("APPROVE")) {
            return APPROVE;
        }
        if (normalized.equals("REJECT_FINAL_YEAR") || normalized.equals("REJECT")) {
            return REJECT;
        }
        if (normalized.equals("VERIFY_NOT_FINAL_YEAR")) {
            return VERIFY_NOT_FINAL_YEAR;
        }
        throw new IllegalArgumentException("Unknown academic review decision: " + val);
    }
}
