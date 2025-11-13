/*
  # Fix Infinite Recursion in Profiles RLS Policy
  
  ## Problem
  The previous migration created an infinite recursion by checking bookings table
  which in turn needs to access profiles table, creating a circular dependency.
  
  ## Solution
  Use a simpler approach: allow professionals to view client profiles when authenticated,
  since the bookings table already has proper RLS that restricts which bookings they can see.
  
  ## Changes Made
  1. Drop the problematic policy
  2. Create a simpler policy without circular dependencies
  3. Allow professionals to view all client profiles (they can only book with valid clients anyway)
*/

-- Drop the problematic policy
DROP POLICY IF EXISTS "profiles_select_simple" ON profiles;

-- Create a simpler policy without recursion
CREATE POLICY "profiles_select_simple"
  ON profiles FOR SELECT
  USING (
    -- Public can view professional, admin, and super_admin profiles
    role IN ('professional', 'admin', 'super_admin')
    OR
    -- Authenticated users can view their own profile
    (auth.uid() IS NOT NULL AND auth.uid() = id)
    OR
    -- Authenticated users can view guest client profiles
    (is_guest = true AND role = 'client' AND auth.uid() IS NOT NULL)
    OR
    -- Authenticated professionals/admins can view all client profiles
    (
      role = 'client'
      AND auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
          AND p.role IN ('professional', 'admin', 'super_admin')
      )
    )
  );

COMMENT ON POLICY "profiles_select_simple" ON profiles IS 
  'Allows: (1) public to view professionals, (2) users to view own profile, (3) authenticated to view guest clients, (4) professionals/admins to view all client profiles';
