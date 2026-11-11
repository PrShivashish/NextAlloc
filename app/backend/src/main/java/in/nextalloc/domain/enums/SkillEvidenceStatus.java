package in.nextalloc.domain.enums;

/**
 * Verification status of a candidate's skill claim.
 * Represents the authoritative verification decision independently of the claim source or evidence medium.
 */
public enum SkillEvidenceStatus {
    /** Claim has no verified external documentary proof (default for self-declared and extracted skills). */
    UNVERIFIED,

    /** Documentary evidence or coursework has been attached, awaiting authoritative review. */
    PENDING_VERIFICATION,

    /** Formally validated and confirmed by an authorized verification authority/reviewer against valid evidence. */
    VERIFIED,

    /** Attached evidence was formally reviewed and rejected as insufficient, invalid, or unconfirmed. */
    REJECTED
}
