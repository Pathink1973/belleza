/*
  # Allow Professionals to Create Client Profiles

  ## Problem
  Service owners (professionals) were unable to add clients to their list due to
  RLS policy violations. The existing INSERT policy only allowed users to create
  their own profile (auth.uid() = id), but professionals need to create client
  profiles with different UUIDs.

  ## Solution
  Add a new RLS policy that allows authenticated professionals to create client
  profiles while maintaining security.

  ## Changes
  1. Add new INSERT policy: "Professionals can insert client profiles"
     - Allows authenticated users with professional privileges to create client profiles
     - Only permits creation of profiles with role = 'client'
     - Prevents professionals from creating admin or super_admin profiles

  2. Keep existing policy: "Users can insert own profile"
     - Maintains backward compatibility with user registration flow
     - Users can still create their own profiles during signup

  ## Security Model
  - Professionals (role: professional, admin, super_admin) can create client profiles
  - Professionals cannot elevate privileges (cannot create admin profiles)
  - Only client role profiles can be created by professionals
  - Regular users can still create their own profiles
  - All operations require authentication

  ## Tables Affected
  - profiles (new INSERT policy)
*/

-- Drop the existing restrictive INSERT policy if it conflicts
-- We'll keep "Users can insert own profile" and add a new one for professionals
DROP POLICY IF EXISTS "Professionals can insert client profiles" ON profiles;

-- Create new policy: Professionals can insert client profiles
-- This policy allows authenticated professionals to create client profiles
CREATE POLICY "Professionals can insert client profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- The new profile must be a client role
    role = 'client'
    AND
    -- The authenticated user must be a professional, admin, or super_admin
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = auth.uid()
      AND p.role IN ('professional', 'admin', 'super_admin')
    )
  );

-- Verify the existing "Users can insert own profile" policy exists
-- This ensures backward compatibility with user registration
DO $$
BEGIN
  -- Check if the policy exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'profiles'
    AND policyname = 'Users can insert own profile'
  ) THEN
    -- Recreate it if it doesn't exist
    CREATE POLICY "Users can insert own profile"
      ON profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;

-- Add helpful comment to the profiles table
COMMENT ON TABLE profiles IS 'User profiles with RLS policies: users can create their own profiles, professionals can create client profiles';
