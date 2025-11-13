/*
  # Fix Infinite Recursion in Profiles RLS Policy - Final Fix

  ## Problem
  The profiles_select_simple policy has infinite recursion because it queries
  the profiles table within its own policy definition (lines 39-42 in v2).
  
  ## Root Cause
  Using `EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid())` inside
  a policy for the profiles table creates circular dependency.

  ## Solution
  Use raw_user_meta_data or raw_app_meta_data from auth.jwt() OR
  create a security definer function that bypasses RLS to check role.

  ## Changes Made
  1. Create a SECURITY DEFINER function to safely check user role
  2. Replace the problematic profiles_select_simple policy
  3. Use the function to avoid recursion
*/

-- Create a security definer function to check if current user is professional/admin
-- This bypasses RLS and prevents recursion
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

-- Drop the problematic policy
DROP POLICY IF EXISTS "profiles_select_simple" ON profiles;

-- Create the fixed policy using the security definer function
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
    -- Using security definer function to avoid recursion
    (
      role = 'client'
      AND auth.uid() IS NOT NULL
      AND public.is_professional_or_admin()
    )
  );

COMMENT ON POLICY "profiles_select_simple" ON profiles IS 
  'Fixed policy using SECURITY DEFINER function to avoid infinite recursion. Allows: (1) public to view professionals, (2) users to view own profile, (3) authenticated to view guest clients, (4) professionals/admins to view all client profiles';

COMMENT ON FUNCTION public.is_professional_or_admin() IS
  'SECURITY DEFINER function to check if auth.uid() belongs to a professional/admin. Used by RLS policies to avoid infinite recursion.';
