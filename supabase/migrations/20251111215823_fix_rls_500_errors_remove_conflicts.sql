/*
  # Fix RLS 500 Errors - Remove Policy Conflicts
  
  ## Problem Identified
  Multiple policies with conflicting scopes (SELECT + ALL) are causing the PostgREST 
  API to return 500 errors, even though SQL queries work fine. This happens when:
  - Multiple SELECT policies exist (including those embedded in ALL policies)
  - Complex conditions in policies cause PostgREST evaluation issues
  
  ## Root Cause
  - services table has 4 policies: 2 SELECT + 2 ALL (conflicts!)
  - profiles table has complex SELECT condition with subqueries
  - PostgREST interprets these differently than direct SQL
  
  ## Solution
  1. Remove ALL policies and replace with specific operation policies
  2. Simplify SELECT policies to avoid complex subqueries
  3. Keep one clear SELECT policy per table for public access
  4. Separate admin/owner policies by operation (INSERT/UPDATE/DELETE)
  
  ## Tables Affected
  - services (remove duplicates and ALL policies)
  - profiles (simplify SELECT policy)
  
  ## Security Impact
  - Maintains same security level
  - Clearer policy structure
  - Better PostgREST compatibility
*/

-- ========================================================================
-- SERVICES TABLE - Remove conflicts and duplicates
-- ========================================================================

-- Drop ALL conflicting policies
DROP POLICY IF EXISTS "Services select access" ON services;
DROP POLICY IF EXISTS "Services admin access" ON services;
DROP POLICY IF EXISTS "Professionals can manage their own services" ON services;
DROP POLICY IF EXISTS "Public can view all services" ON services;

-- Create ONE clear SELECT policy for public access
CREATE POLICY "services_select_public"
  ON services FOR SELECT
  TO public
  USING (true);

-- Create separate INSERT policy
CREATE POLICY "services_insert_auth"
  ON services FOR INSERT
  TO authenticated
  WITH CHECK (
    professional_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Create separate UPDATE policy
CREATE POLICY "services_update_owner"
  ON services FOR UPDATE
  TO authenticated
  USING (
    professional_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    professional_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- Create separate DELETE policy
CREATE POLICY "services_delete_owner"
  ON services FOR DELETE
  TO authenticated
  USING (
    professional_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'admin')
    )
  );

-- ========================================================================
-- PROFILES TABLE - Simplify SELECT policy
-- ========================================================================

-- Drop existing complex SELECT policy
DROP POLICY IF EXISTS "Profiles select access" ON profiles;

-- Create simplified SELECT policy that works better with PostgREST
-- This allows: super_admins see all, authenticated see all, public sees professionals
CREATE POLICY "profiles_select_public"
  ON profiles FOR SELECT
  TO public
  USING (
    -- Public can see professional profiles (needed for service listings)
    role IN ('professional', 'admin', 'super_admin')
    -- Authenticated users can see all profiles
    OR auth.uid() IS NOT NULL
  );

-- Keep existing UPDATE policy (it's fine)
-- Keep existing INSERT policies (they're fine)
-- Keep existing DELETE policy (it's fine)

-- ========================================================================
-- VERIFICATION QUERIES (for testing after migration)
-- ========================================================================

-- These queries should work after migration:
-- SELECT id, title FROM services LIMIT 1;
-- SELECT s.*, p.business_name FROM services s JOIN profiles p ON s.professional_id = p.id LIMIT 1;
-- SELECT * FROM profiles WHERE role = 'professional' LIMIT 1;
