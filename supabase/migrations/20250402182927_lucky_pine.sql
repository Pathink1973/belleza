/*
  # Fix Security Settings

  1. Changes
    - Add comment to document that leaked password protection must be enabled manually
    - This setting cannot be changed via migration due to transaction limitations
    
  2. Security
    - Document required manual configuration
*/

-- NOTE: The leaked password protection setting must be enabled manually
-- by a superuser using:
--   ALTER SYSTEM SET auth.enable_leaked_password_protection = 'true';
--
-- This cannot be done in a migration because ALTER SYSTEM commands
-- cannot run inside transaction blocks.

-- Instead, we'll add a comment to the database to document this requirement
COMMENT ON DATABASE postgres IS 'Leaked password protection should be enabled using ALTER SYSTEM SET auth.enable_leaked_password_protection = true';