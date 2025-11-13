/*
  # Fix Client Creation - Remove Auth Foreign Key Constraint

  ## Problem
  Professionals cannot add clients to their client list because profiles.id 
  has a foreign key constraint requiring it to reference auth.users(id).
  When professionals try to create a client profile with a random UUID, 
  it violates this constraint.

  ## Solution
  1. Remove the foreign key constraint between profiles.id and auth.users.id
  2. Use the existing is_guest field to distinguish between:
     - Authenticated users (is_guest = false): have auth.users entry
     - Managed clients (is_guest = true): created by professionals, no auth
  3. Update RLS policies to handle both types of profiles
  4. Ensure data integrity through application logic and check constraints

  ## Changes Made
  1. Drop foreign key constraint: profiles_id_fkey
  2. Add check constraint to ensure is_guest clients have no email/password
  3. Update RLS policies to allow professionals to create guest client profiles
  4. Add index on is_guest for query performance

  ## Security Considerations
  - Guest profiles (is_guest = true) cannot login (no auth.users entry)
  - Only professionals can create guest client profiles
  - Guest profiles must have role = 'client'
  - Guest profiles cannot have email or password_hash set
  - Regular user registration flow unchanged

  ## Migration Safety
  - This migration is safe for existing data
  - Existing profiles with auth.users entries remain valid
  - No data loss or modification to existing records
*/

-- Step 1: Drop the foreign key constraint
ALTER TABLE profiles 
  DROP CONSTRAINT IF EXISTS profiles_id_fkey;

-- Step 2: Add check constraint for guest clients
-- Guest clients should not have email or password_hash
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS guest_client_no_auth;

ALTER TABLE profiles
  ADD CONSTRAINT guest_client_no_auth 
  CHECK (
    (is_guest = false) OR 
    (is_guest = true AND email IS NULL AND password_hash IS NULL)
  );

-- Step 3: Ensure is_guest defaults to false
ALTER TABLE profiles
  ALTER COLUMN is_guest SET DEFAULT false;

-- Step 4: Update constraint to ensure guest clients have client role
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS guest_must_be_client;

ALTER TABLE profiles
  ADD CONSTRAINT guest_must_be_client
  CHECK (
    (is_guest = false) OR 
    (is_guest = true AND role = 'client')
  );

-- Step 5: Add index on is_guest for performance
CREATE INDEX IF NOT EXISTS profiles_is_guest_idx ON profiles(is_guest);

-- Step 6: Update INSERT policy for professionals to create guest clients
DROP POLICY IF EXISTS "Professionals can insert guest client profiles" ON profiles;

CREATE POLICY "Professionals can insert guest client profiles"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Allow inserting guest client profiles
    (
      is_guest = true 
      AND role = 'client'
      AND EXISTS (
        SELECT 1 FROM profiles AS p
        WHERE p.id = auth.uid()
        AND p.role IN ('professional', 'admin', 'super_admin')
      )
    )
    OR
    -- Allow users to insert their own profile (standard registration)
    (
      is_guest = false 
      AND auth.uid() = id
    )
  );

-- Step 7: Update SELECT policy to allow professionals to see their guest clients
DROP POLICY IF EXISTS "Users can view guest clients they created" ON profiles;

CREATE POLICY "Users can view guest clients they created"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Users can see their own profile
    auth.uid() = id
    OR
    -- Professionals can see guest clients they're associated with via client_notes
    (
      is_guest = true 
      AND role = 'client'
      AND EXISTS (
        SELECT 1 FROM client_notes cn
        WHERE cn.client_id = profiles.id
        AND cn.professional_id = auth.uid()
      )
    )
    OR
    -- Professionals can see guest clients they have bookings with
    (
      is_guest = true
      AND role = 'client'
      AND EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.client_id = profiles.id
        AND b.professional_id = auth.uid()
      )
    )
  );

-- Step 8: Update UPDATE policy for professionals to modify guest clients
DROP POLICY IF EXISTS "Professionals can update guest clients" ON profiles;

CREATE POLICY "Professionals can update guest clients"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Users can update their own profile
    auth.uid() = id
    OR
    -- Professionals can update guest clients they manage
    (
      is_guest = true 
      AND role = 'client'
      AND EXISTS (
        SELECT 1 FROM client_notes cn
        WHERE cn.client_id = profiles.id
        AND cn.professional_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    -- Ensure updates maintain data integrity
    (auth.uid() = id) OR (is_guest = true AND role = 'client')
  );

-- Step 9: Update DELETE policy for professionals to remove guest clients
DROP POLICY IF EXISTS "Professionals can delete guest clients" ON profiles;

CREATE POLICY "Professionals can delete guest clients"
  ON profiles
  FOR DELETE
  TO authenticated
  USING (
    -- Professionals can delete guest clients they manage
    is_guest = true 
    AND role = 'client'
    AND EXISTS (
      SELECT 1 FROM client_notes cn
      WHERE cn.client_id = profiles.id
      AND cn.professional_id = auth.uid()
    )
  );

-- Step 10: Add helpful comments
COMMENT ON COLUMN profiles.is_guest IS 'True for clients created by professionals without auth accounts. False for users with auth.users entries.';
COMMENT ON CONSTRAINT guest_client_no_auth ON profiles IS 'Guest clients cannot have email or password_hash - they are not authentication accounts';
COMMENT ON CONSTRAINT guest_must_be_client ON profiles IS 'Guest profiles must have role = client';
