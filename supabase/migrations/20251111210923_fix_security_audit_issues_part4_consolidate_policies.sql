/*
  # Fix Security Audit Issues - Part 4: Consolidate Multiple Permissive Policies
  
  ## Summary
  This migration consolidates multiple permissive RLS policies into single
  comprehensive policies. Having multiple permissive policies can cause
  confusion and performance issues.
  
  ## Changes Made
  
  1. **Bookings Table Policies**
     - Consolidate SELECT policies (3 policies → 1 policy)
     - Consolidate INSERT policies (2 policies → 1 policy)
     - Consolidate UPDATE policies (3 policies → 1 policy)
     - Consolidate DELETE policies (2 policies → 1 policy)
  
  2. **Profiles Table Policies**
     - Consolidate SELECT policies (3 policies → 1 policy)
     - Consolidate UPDATE policies (2 policies → 1 policy)
  
  3. **Services Table Policies**
     - Consolidate SELECT policies (2 policies → 1 policy)
  
  ## Benefits
  - Simpler policy management
  - Better query performance
  - Easier to audit security rules
  - Reduced complexity in policy evaluation
*/

-- ========================================================================
-- BOOKINGS TABLE - Consolidate policies
-- ========================================================================

-- Drop all existing booking policies
DROP POLICY IF EXISTS "Authenticated users can view their bookings" ON bookings;
DROP POLICY IF EXISTS "Super admins can manage all bookings" ON bookings;
DROP POLICY IF EXISTS "Super admins can view all bookings" ON bookings;
DROP POLICY IF EXISTS "Authenticated clients can create bookings" ON bookings;
DROP POLICY IF EXISTS "Anonymous guests can create bookings" ON bookings;
DROP POLICY IF EXISTS "Clients can update their pending or confirmed bookings" ON bookings;
DROP POLICY IF EXISTS "Professionals can update their bookings" ON bookings;
DROP POLICY IF EXISTS "Clients can delete their archived bookings" ON bookings;
DROP POLICY IF EXISTS "Public can view bookings with valid client info" ON bookings;

-- Create consolidated SELECT policy for bookings
CREATE POLICY "Bookings select access"
  ON bookings FOR SELECT
  USING (
    -- Super admins can view all bookings
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND role = 'super_admin'
    )
    OR
    -- Authenticated users can view their own bookings (as client or professional)
    (
      auth.uid() = client_id OR
      auth.uid() = professional_id
    )
    OR
    -- Anonymous users can view bookings for guest profiles
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = bookings.client_id
      AND is_guest = true
    )
  );

-- Create consolidated INSERT policy for bookings
CREATE POLICY "Bookings insert access"
  ON bookings FOR INSERT
  WITH CHECK (
    -- Super admins can create any booking
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND role = 'super_admin'
    )
    OR
    -- Authenticated clients can create their own bookings
    (
      auth.uid() = client_id AND
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = (select auth.uid()) AND role = 'client'
      )
    )
    OR
    -- Anonymous users can create bookings for valid guest profiles
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = client_id 
        AND role = 'client'
        AND is_guest = true
        AND email IS NOT NULL
        AND mobile_number IS NOT NULL
      ) AND
      status = 'pending'
    )
  );

-- Create consolidated UPDATE policy for bookings
CREATE POLICY "Bookings update access"
  ON bookings FOR UPDATE
  USING (
    -- Super admins can update all bookings
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND role = 'super_admin'
    )
    OR
    -- Professionals can update their bookings
    auth.uid() = professional_id
    OR
    -- Clients can update their own pending or confirmed bookings
    (
      auth.uid() = client_id AND
      status IN ('pending', 'confirmed')
    )
  )
  WITH CHECK (
    -- Same conditions for WITH CHECK
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND role = 'super_admin'
    )
    OR
    auth.uid() = professional_id
    OR
    (
      auth.uid() = client_id AND
      status IN ('pending', 'confirmed')
    )
  );

-- Create consolidated DELETE policy for bookings
CREATE POLICY "Bookings delete access"
  ON bookings FOR DELETE
  USING (
    -- Super admins can delete all bookings
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND role = 'super_admin'
    )
    OR
    -- Clients can delete their own archived bookings
    (
      auth.uid() = client_id AND
      archived_at IS NOT NULL
    )
  );

-- ========================================================================
-- PROFILES TABLE - Consolidate policies
-- ========================================================================

-- Drop all existing profile SELECT policies
DROP POLICY IF EXISTS "Public can view professional profiles" ON profiles;
DROP POLICY IF EXISTS "Super admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Users can view all profiles" ON profiles;

-- Create consolidated SELECT policy for profiles
CREATE POLICY "Profiles select access"
  ON profiles FOR SELECT
  USING (
    -- Super admins can view all profiles
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = (select auth.uid())
      AND p.role = 'super_admin'
    )
    OR
    -- Authenticated users can view all profiles
    auth.uid() IS NOT NULL
    OR
    -- Public can view professional profiles
    role IN ('professional', 'admin', 'super_admin')
  );

-- Drop existing UPDATE policies
DROP POLICY IF EXISTS "Authenticated users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Super admins can update all profiles" ON profiles;

-- Create consolidated UPDATE policy for profiles
CREATE POLICY "Profiles update access"
  ON profiles FOR UPDATE
  USING (
    -- Super admins can update all profiles
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = (select auth.uid())
      AND p.role = 'super_admin'
    )
    OR
    -- Users can update their own profile
    auth.uid() = id
  )
  WITH CHECK (
    -- Same conditions for WITH CHECK
    EXISTS (
      SELECT 1 FROM profiles AS p
      WHERE p.id = (select auth.uid())
      AND p.role = 'super_admin'
    )
    OR
    auth.uid() = id
  );

-- ========================================================================
-- SERVICES TABLE - Consolidate policies
-- ========================================================================

-- Drop existing service SELECT policies
DROP POLICY IF EXISTS "Super admins can manage all services" ON services;
DROP POLICY IF EXISTS "Super admins can view all services" ON services;

-- Keep the public view policy and create admin policy separately
CREATE POLICY "Services select access"
  ON services FOR SELECT
  USING (true);

-- Create comprehensive admin policy for all operations
CREATE POLICY "Services admin access"
  ON services FOR ALL
  USING (
    -- Super admins can manage all services
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND (role = 'super_admin' OR role = 'admin')
    )
    OR
    -- Professionals can manage their own services
    professional_id = (select auth.uid())
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (select auth.uid())
      AND (role = 'super_admin' OR role = 'admin')
    )
    OR
    professional_id = (select auth.uid())
  );
