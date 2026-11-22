-- Idempotently create or update the primary administrator account (ryzite_admin)
-- with its salted scrypt password hash and super_admin role. Never stores plaintext passwords.

UPDATE users
SET email = 'ryziteonline@gmail.com',
    password_hash = 'scrypt:85741a762e932a8775248aa62e6b0b7e:d7e5dfd1be4c12ce5f456f813053edbc40fb2b611044028ef9e2af082d1a4b1d154a28cbe182f5dbeccad463472761625ea5d31fd900c653489d313cedf32928',
    banned_until = NULL
WHERE id IN (SELECT id FROM profiles WHERE username = 'ryzite_admin')
   OR email = 'ryziteonline@gmail.com';

INSERT INTO users (id, email, password_hash, banned_until, created_at)
SELECT
  '11111111-1111-4111-8111-111111111111',
  'ryziteonline@gmail.com',
  'scrypt:85741a762e932a8775248aa62e6b0b7e:d7e5dfd1be4c12ce5f456f813053edbc40fb2b611044028ef9e2af082d1a4b1d154a28cbe182f5dbeccad463472761625ea5d31fd900c653489d313cedf32928',
  NULL,
  '2026-01-01T00:00:00.000Z'
WHERE NOT EXISTS (SELECT 1 FROM profiles WHERE username = 'ryzite_admin')
  AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'ryziteonline@gmail.com');

UPDATE profiles
SET email = 'ryziteonline@gmail.com', updated_at = '2026-11-22T00:00:00.000Z'
WHERE username = 'ryzite_admin';

INSERT INTO profiles (
  id,
  username,
  full_name,
  email,
  job_title,
  avatar_url,
  last_sign_in_at,
  created_at,
  updated_at
)
SELECT
  u.id,
  'ryzite_admin',
  'RYZITE Administrator',
  u.email,
  'Super Administrator',
  NULL,
  NULL,
  u.created_at,
  '2026-01-01T00:00:00.000Z'
FROM users u
WHERE u.email = 'ryziteonline@gmail.com'
  AND NOT EXISTS (SELECT 1 FROM profiles WHERE username = 'ryzite_admin')
ON CONFLICT(id) DO UPDATE SET
  username = 'ryzite_admin',
  email = excluded.email,
  updated_at = excluded.updated_at;

INSERT OR IGNORE INTO user_roles (id, user_id, role, created_at)
SELECT
  'role-' || p.id,
  p.id,
  'super_admin',
  p.created_at
FROM profiles p
WHERE p.username = 'ryzite_admin';
