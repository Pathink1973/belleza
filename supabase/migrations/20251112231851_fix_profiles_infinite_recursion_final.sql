/*
  # Fix Infinite Recursion in Profiles RLS Policies - Definitive Solution

  ## Critical Issue
  Multiple policies on the profiles table cause infinite recursion by querying
  the profiles table within their own policy definitions:

  1. "Profiles update access" - uses EXISTS (SELECT 1 FROM profiles p WHERE...)
  2. "Super admins can delete profiles" - uses EXISTS (SELECT 1 FROM profiles WHERE...)
  3. Other policies reference profiles indirectly through complex JOINs

  ## Root Cause
  When a policy on table X queries table X in its USING/WITH CHECK clause,
  it creates infinite recursion: policy → query X → trigger policy → query X → ...

  ## Solution Strategy
  1. Use SECURITY DEFINER functions that bypass RLS for role checks
  2. Simplify policies to avoid self-referencing queries
  3. Use auth.uid() and auth.jwt() directly where possible
  4. Separate concerns: each policy should have ONE clear purpose

  ## Changes
  1. Ensure is_professional_or_admin() function exists
  2. Drop ALL problematic policies
  3. Create new, simplified, non-recursive policies
  4. Add proper comments for maintainability
*/

-- Ensure the security definer function exists and is correct
CREATE OR REPLACE FUNCTION public.is_professional_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('professional', 'admin', 'super_admin')
  );
$$;

COMMENT ON FUNCTION public.is_professional_or_admin() IS
  'SECURITY DEFINER function to check if auth.uid() is a professional/admin. Bypasses RLS to prevent infinite recursion.';

-- Drop all existing policies on profiles table
DROP POLICY IF EXISTS "profiles_select_simple" ON profiles;
DROP POLICY IF EXISTS "profiles_select_all_cases" ON profiles;
DROP POLICY IF EXISTS "profiles_select_with_review_authors" ON profiles;
DROP POLICY IF EXISTS "Profiles update access" ON profiles;
DROP POLICY IF EXISTS "Professionals can update guest clients" ON profiles;
DROP POLICY IF EXISTS "Super admins can delete profiles" ON profiles;
DROP POLICY IF EXISTS "Professionals can delete guest clients" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_guest_clients" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_anonymous_guests" ON profiles;

-- ============================================================================
-- SELECT POLICIES
-- ============================================================================

-- Policy 1: Public can view professional/admin profiles (for marketplace)
CREATE POLICY "profiles_select_professionals_public"
  ON profiles FOR SELECT
  TO public
  USING (
    role IN ('professional', 'admin', 'super_admin')
  );

COMMENT ON POLICY "profiles_select_professionals_public" ON profiles IS
  'Allows anyone (including anonymous) to view professional/admin profiles for marketplace listing';

-- Policy 2: Users can view their own profile
CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
  );

COMMENT ON POLICY "profiles_select_own" ON profiles IS
  'Allows authenticated users to view their own profile';

-- Policy 3: Professionals/admins can view all client profiles
CREATE POLICY "profiles_select_clients_by_professionals"
  ON profiles FOR SELECT
  TO authenticated
  USING (
    role = 'client'
    AND is_professional_or_admin()
  );

COMMENT ON POLICY "profiles_select_clients_by_professionals" ON profiles IS
  'Allows professionals/admins to view all client profiles (including guests). Uses SECURITY DEFINER function to avoid recursion.';

-- Policy 4: Anyone can view profiles that have reviews (review authors)
CREATE POLICY "profiles_select_review_authors"
  ON profiles FOR SELECT
  TO public
  USING (
    EXISTS (
      SELECT 1
      FROM reviews r
      WHERE r.client_id = profiles.id
    )
  );

COMMENT ON POLICY "profiles_select_review_authors" ON profiles IS
  'Allows anyone to view profiles of users who have written reviews (for displaying review author info)';

-- ============================================================================
-- INSERT POLICIES
-- ============================================================================

-- Policy 5: Users can insert their own profile during registration
CREATE POLICY "profiles_insert_own"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND is_guest = false
  );

COMMENT ON POLICY "profiles_insert_own" ON profiles IS
  'Allows authenticated users to create their own profile during registration';

-- Policy 6: Professionals/admins can create guest client profiles
CREATE POLICY "profiles_insert_guest_by_professional"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    is_guest = true
    AND role = 'client'
    AND is_professional_or_admin()
  );

COMMENT ON POLICY "profiles_insert_guest_by_professional" ON profiles IS
  'Allows professionals/admins to create guest client profiles. Uses SECURITY DEFINER function to avoid recursion.';

-- Policy 7: Anonymous users can create guest profiles for booking
CREATE POLICY "profiles_insert_anonymous_guest"
  ON profiles FOR INSERT
  TO public
  WITH CHECK (
    auth.uid() IS NULL
    AND is_guest = true
    AND role = 'client'
    AND email IS NOT NULL
    AND mobile_number IS NOT NULL
    AND full_name IS NOT NULL
  );

COMMENT ON POLICY "profiles_insert_anonymous_guest" ON profiles IS
  'Allows anonymous users to create guest client profiles for bookings (requires email, phone, name)';

-- ============================================================================
-- UPDATE POLICIES
-- ============================================================================

-- Policy 8: Users can update their own profile
CREATE POLICY "profiles_update_own"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id
  )
  WITH CHECK (
    auth.uid() = id
  );

COMMENT ON POLICY "profiles_update_own" ON profiles IS
  'Allows authenticated users to update their own profile';

-- Policy 9: Professionals can update guest client profiles they created
CREATE POLICY "profiles_update_guest_by_professional"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    is_guest = true
    AND role = 'client'
    AND EXISTS (
      SELECT 1
      FROM client_notes cn
      WHERE cn.client_id = profiles.id
        AND cn.professional_id = auth.uid()
    )
  )
  WITH CHECK (
    is_guest = true
    AND role = 'client'
  );

COMMENT ON POLICY "profiles_update_guest_by_professional" ON profiles IS
  'Allows professionals to update guest client profiles they created (verified via client_notes)';

-- Policy 10: Super admins can update any profile
-- We need a separate SECURITY DEFINER function for super admin check
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'super_admin'
  );
$$;

COMMENT ON FUNCTION public.is_super_admin() IS
  'SECURITY DEFINER function to check if auth.uid() is a super admin. Bypasses RLS to prevent infinite recursion.';

CREATE POLICY "profiles_update_by_super_admin"
  ON profiles FOR UPDATE
  TO authenticated
  USING (
    is_super_admin()
  )
  WITH CHECK (
    is_super_admin()
  );

COMMENT ON POLICY "profiles_update_by_super_admin" ON profiles IS
  'Allows super admins to update any profile. Uses SECURITY DEFINER function to avoid recursion.';

-- ============================================================================
-- DELETE POLICIES
-- ============================================================================

-- Policy 11: Professionals can delete guest client profiles they created
CREATE POLICY "profiles_delete_guest_by_professional"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    is_guest = true
    AND role = 'client'
    AND EXISTS (
      SELECT 1
      FROM client_notes cn
      WHERE cn.client_id = profiles.id
        AND cn.professional_id = auth.uid()
    )
  );

COMMENT ON POLICY "profiles_delete_guest_by_professional" ON profiles IS
  'Allows professionals to delete guest client profiles they created (verified via client_notes)';

-- Policy 12: Super admins can delete any profile
CREATE POLICY "profiles_delete_by_super_admin"
  ON profiles FOR DELETE
  TO authenticated
  USING (
    is_super_admin()
  );

COMMENT ON POLICY "profiles_delete_by_super_admin" ON profiles IS
  'Allows super admins to delete any profile. Uses SECURITY DEFINER function to avoid recursion.';

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- Verify RLS is enabled
DO $$
BEGIN
  IF NOT (SELECT relrowsecurity FROM pg_class WHERE relname = 'profiles' AND relnamespace = 'public'::regnamespace) THEN
    ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
    RAISE NOTICE 'RLS enabled on profiles table';
  ELSE
    RAISE NOTICE 'RLS already enabled on profiles table';
  END IF;
END $$;
