-- V8: Update administrator display name to Shivashish Prusty
-- Idempotent: targets only the admin account by email, not by name.
-- Historical audit records retain the name that was current at the time.
UPDATE users
SET name = 'Shivashish Prusty'
WHERE email IN ('admin@pragati.gov.in', 'admin@nextalloc.in')
  AND name = 'Asha Iyer';
