-- Rename only the primary administrator account; preserve editor accounts and roles.
UPDATE users
SET email = 'ryziteonline@gmail.com'
WHERE id IN (SELECT id FROM profiles WHERE username = 'ryzite_admin')
   OR email = 'admin@ryzite.com';

UPDATE profiles
SET email = 'ryziteonline@gmail.com',
    updated_at = '2026-11-22T00:00:00.000Z'
WHERE username = 'ryzite_admin';
