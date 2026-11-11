package in.nextalloc.domain.enums;

/**
 * Provenance tracking for candidate skill claims.
 * Distinguishes self-declarations from resume extraction and legacy migrated records.
 */
public enum SkillClaimSource {
    SELF_DECLARED,
    RESUME_EXTRACTED,
    LEGACY_UNSPECIFIED
}

