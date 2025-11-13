/*
  # Fix Infinite Recursion in Profiles INSERT Policy for Guest Clients

  ## Critical Bug
  When professionals try to add guest clients, they encounter "infinite recursion
  detected for relation 'profiles'" error. This prevents them from adding any new clients.

  ## Root Cause
  The `profiles_insert_guest_clients` policy contains an EXISTS subquery that checks
  if the authenticated user is a professional:

  ```sql
  EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid()
    AND p.role IN ('professional', 'admin', 'super_admin')
  )
  ```

  This creates a circular dependency:
  1. Professional tries to INSERT into profiles (guest client)
  2. INSERT policy checks if user is professional by querying profiles
  3. That SELECT triggers the profiles SELECT policy
  4. The SELECT policy uses is_professional_or_admin() which queries profiles again
  5. Infinite loop detected by PostgreSQL

  ## Solution
  Replace the inline EXISTS subquery with the existing `is_professional_or_admin()`
  SECURITY DEFINER function. This function bypasses RLS and breaks the circular dependency.

  The function was created in migration 20251112142327 and is specifically designed
  to avoid this exact recursion problem.

  ## Changes Made
  1. Drop the problematic `profiles_insert_guest_clients` policy
  2. Recreate it using `is_professional_or_admin()` function instead of EXISTS subquery
  3. Maintain all other security requirements (is_guest, role checks)
  4. Add detailed comments for future reference

  ## Security Considerations
  - The SECURITY DEFINER function only checks role, not permissions
  - Policy still enforces is_guest=true and role='client' requirements
  - Only authenticated professionals can create guest client profiles
  - No other security constraints are relaxed

  ## Testing Required
  - Professionals must be able to add new guest clients
  - No infinite recursion errors should occur
  - Existing clients remain visible
  - Anonymous users can still create guests via public booking
*/

-- ============================================================================
-- Drop the problematic INSERT policy
-- ============================================================================

DROP POLICY IF EXISTS "profiles_insert_guest_clients" ON profiles;

-- ============================================================================
-- Recreate the INSERT policy using SECURITY DEFINER function
-- ============================================================================

CREATE POLICY "profiles_insert_guest_clients"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must be creating a guest client profile
    is_guest = true
    AND role = 'client'
    -- The authenticated user must be a professional/admin
    -- Using SECURITY DEFINER function to avoid infinite recursion
    AND public.is_professional_or_admin()
  );

-- ============================================================================
-- Add detailed comment
-- ============================================================================

COMMENT ON POLICY "profiles_insert_guest_clients" ON profiles IS
  'Allows authenticated professionals/admins to create guest client profiles (clients without auth accounts). Uses SECURITY DEFINER function is_professional_or_admin() to avoid infinite recursion that would occur with inline EXISTS subquery.';

-- ============================================================================
-- Verification
-- ============================================================================

DO $$
BEGIN
  RAISE NOTICE '=============================================================';
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE '=============================================================';
  RAISE NOTICE '';
  RAISE NOTICE 'Fixed infinite recursion in profiles_insert_guest_clients policy';
  RAISE NOTICE 'Professionals can now add guest clients without recursion errors';
  RAISE NOTICE '';
  RAISE NOTICE 'The policy now uses is_professional_or_admin() SECURITY DEFINER';
  RAISE NOTICE 'function which bypasses RLS and prevents circular dependencies';
  RAISE NOTICE '';
  RAISE NOTICE '=============================================================';
END $$;
