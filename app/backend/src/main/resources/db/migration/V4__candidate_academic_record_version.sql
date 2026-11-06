-- V4__candidate_academic_record_version.sql
-- Additive, non-destructive migration for NextAlloc Phase 4A-2C Commit 3B
-- Adds version column for Jakarta Persistence optimistic locking (@Version) on candidate_academic_records.

ALTER TABLE candidate_academic_records
ADD COLUMN IF NOT EXISTS version BIGINT DEFAULT 0 NOT NULL;