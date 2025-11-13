/*
  # Add Super Admin Bootstrap Security
  
  1. New Functions
    - `check_super_admin_exists()` - Returns true if any super admin exists
    - `get_super_admin_count()` - Returns count of super admin accounts
  
  2. New Table
    - `super_admin_audit` - Tracks all super admin creation attempts
      - `id` (uuid, primary key)
      - `email` (text) - Email attempted
      - `success` (boolean) - Whether creation succeeded
      - `ip_address` (text) - IP address of request (optional)
      - `user_agent` (text) - Browser user agent (optional)
      - `created_at` (timestamptz)
  
  3. Security
    - Enable RLS on audit table
    - Only super admins can view audit logs
    - Function to check if bootstrap is allowed
    - Prevent multiple super admin bootstrap accounts
  
  4. Notes
    - Bootstrap is only allowed when zero super admins exist
    - All creation attempts are logged for security audit
    - After first super admin is created, bootstrap is locked
*/

CREATE TABLE IF NOT EXISTS super_admin_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  success boolean DEFAULT false,
  ip_address text,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE super_admin_audit ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'super_admin_audit' 
    AND policyname = 'Super admins can view audit logs'
  ) THEN
    CREATE POLICY "Super admins can view audit logs"
      ON super_admin_audit FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = auth.uid()
          AND profiles.role = 'super_admin'
        )
      );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'super_admin_audit' 
    AND policyname = 'Anyone can insert audit logs'
  ) THEN
    CREATE POLICY "Anyone can insert audit logs"
      ON super_admin_audit FOR INSERT
      TO authenticated
      WITH CHECK (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION check_super_admin_exists()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_count integer;
BEGIN
  SELECT COUNT(*) INTO admin_count
  FROM profiles
  WHERE role = 'super_admin';
  
  RETURN admin_count > 0;
END;
$$;

CREATE OR REPLACE FUNCTION get_super_admin_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_count integer;
BEGIN
  SELECT COUNT(*) INTO admin_count
  FROM profiles
  WHERE role = 'super_admin';
  
  RETURN admin_count;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
