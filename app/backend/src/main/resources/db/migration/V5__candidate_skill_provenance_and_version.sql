-- V5__candidate_skill_provenance_and_version.sql
-- Additive, non-destructive migration for NextAlloc Phase 4B-2B.2A
-- Adds version-aware skill persistence, provenance metadata, evidence verification status, and optimistic locking.

ALTER TABLE candidate_skills
ADD COLUMN IF NOT EXISTS concept_id VARCHAR(64);

ALTER TABLE candidate_skills
ADD COLUMN IF NOT EXISTS taxonomy_version VARCHAR(32);

ALTER TABLE candidate_skills
ADD COLUMN IF NOT EXISTS original_input VARCHAR(120);

ALTER TABLE candidate_skills
ADD COLUMN IF NOT EXISTS claim_source VARCHAR(32) DEFAULT 'LEGACY_UNSPECIFIED' NOT NULL;

ALTER TABLE candidate_skills
ADD COLUMN IF NOT EXISTS evidence_status VARCHAR(32) DEFAULT 'UNVERIFIED' NOT NULL;

ALTER TABLE candidate_skills
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP;

ALTER TABLE candidate_skills
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP;

ALTER TABLE candidate_skills
ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0 NOT NULL;

CREATE INDEX IF NOT EXISTS idx_skill_candidate_concept ON candidate_skills(candidate_id, concept_id);
