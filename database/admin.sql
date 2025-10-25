-- ========== Seed: single admin user (safe) ==========
-- Attempts to create one admin user. If pgcrypto exists it bcrypt-hashes the password.
-- Default seeded password (if pgcrypto present): ChangeMe123!
-- IMPORTANT: Change this password immediately after restore.

DO $$
BEGIN
  -- If pgcrypto is installed, use crypt() + gen_salt('bf') to hash a safe default password.
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto') THEN
    INSERT INTO public.users (name, email, phone, password_hash, role, created_at, is_verified, status)
    VALUES (
      'Platform Admin',
      'admin@mypadicrib.com',
      '',
      crypt('ChangeMe123!', gen_salt('bf', 10)),
      'admin',
      now(),
      true,
      'active'
    )
    ON CONFLICT (email) DO UPDATE
      SET name = EXCLUDED.name,
          password_hash = EXCLUDED.password_hash,
          role = 'admin',
          is_verified = true,
          status = 'active';
  ELSE
    -- Fallback: create the user with a placeholder hash. You MUST replace this value manually
    -- with a bcrypt hash before going live (or install pgcrypto and re-run).
    INSERT INTO public.users (name, email, phone, password_hash, role, created_at, is_verified, status)
    VALUES (
      'Platform Admin',
      'admin@mypadicrib.com',
      '',
      '<REPLACE_WITH_BCRYPT_HASH>',
      'admin',
      now(),
      true,
      'active'
    )
    ON CONFLICT (email) DO NOTHING;
    RAISE NOTICE 'pgcrypto extension not found. Admin user created with placeholder password_hash. Replace with a bcrypt hash and update password immediately.';
  END IF;
END
$$;