/*
  # Fix RLS Policies - Services Display, Client Addition, and Calendar Data
  
  ## Summary
  This migration fixes three critical issues that appeared after recent security migrations:
  1. Services not appearing on landing page for anonymous users
  2. Professionals unable to add guest clients
  3. Calendar data not loading for professionals
  
  ## Issues Identified
  
  ### Issue 1: Services Display on Landing Page
  **Problem**: The profiles SELECT policy blocks anonymous users from viewing professional 
  profiles, which breaks the services query that joins with profiles table.
  
  **Root Cause**: Policy "profiles_select_public" has condition:
  `(role = ANY (ARRAY['professional', 'admin', 'super_admin'])) OR (auth.uid() IS NOT NULL)`
  This blocks anonymous users from seeing professional profiles.
  
  **Solution**: Modify the policy to allow anonymous users to view professional profiles
  (business_name, business_address, avatar_url, etc.) which are public information.
  
  ### Issue 2: Client Addition
  **Problem**: Multiple conflicting INSERT policies on profiles table causing confusion.
  
  **Root Cause**: Five different INSERT policies exist with overlapping conditions.
  
  **Solution**: Consolidate into two clear policies:
  - One for authenticated users creating their own profile
  - One for professionals creating guest client profiles
  
  ### Issue 3: Calendar Data Loading
  **Problem**: Calendar notes not loading properly.
  
  **Root Cause**: The policy exists but may not be properly filtering.
  
  **Solution**: Verify and recreate the calendar_notes policy with explicit conditions.
  
  ## Changes Made
  
  1. **Profiles Table**
     - Drop all existing SELECT policies
     - Create new consolidated SELECT policy allowing:
       - Users to view their own profile
       - Anonymous users to view professional/admin profiles (public info)
       - Professionals to view their guest clients
     - Drop duplicate INSERT policies
     - Keep only two INSERT policies with clear purposes
  
  2. **Client Notes Table**
     - Ensure INSERT policy allows professionals to create notes for guest clients
     - Verify SELECT policy allows professionals to read their client notes
  
  3. **Calendar Notes Table**
     - Recreate policy with explicit professional_id check
     - Ensure proper filtering by professional_id
  
  ## Security Considerations
  - Professional profiles remain publicly viewable (necessary for marketplace)
  - Client profiles remain private (only visible to the client and their professional)
  - Guest client creation restricted to authenticated professionals
  - Calendar notes remain private to each professional
  
  ## Testing Checklist
  - [ ] Landing page displays services for anonymous users
  - [ ] Service cards show professional business information
  - [ ] Professionals can add new guest clients
  - [ ] Calendar notes load correctly for professionals
  - [ ] No unauthorized access to private data
*/

-- ============================================================================
-- FIX 1: Profiles Table SELECT Policy
-- ============================================================================

-- Drop all existing SELECT policies to avoid conflicts
DROP POLICY IF EXISTS "profiles_select_public" ON profiles;
DROP POLICY IF EXISTS "Users can view guest clients they created" ON profiles;
DROP POLICY IF EXISTS "Public can view professional profiles" ON profiles;

-- Create a single, comprehensive SELECT policy
CREATE POLICY "profiles_select_all_cases"
  ON profiles
  FOR SELECT
  TO public
  USING (
    -- Case 1: User viewing their own profile (authenticated users only)
    (auth.uid() = id)
    OR
    -- Case 2: Anonymous or authenticated users viewing professional/admin profiles
    -- (These are public marketplace profiles)
    (role IN ('professional', 'admin', 'super_admin'))
    OR
    -- Case 3: Professionals viewing their guest clients via client_notes
    (
      is_guest = true 
      AND role = 'client'
      AND auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM client_notes cn
        WHERE cn.client_id = profiles.id
        AND cn.professional_id = auth.uid()
      )
    )
    OR
    -- Case 4: Professionals viewing their guest clients via bookings
    (
      is_guest = true
      AND role = 'client'
      AND auth.uid() IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.client_id = profiles.id
        AND b.professional_id = auth.uid()
      )
    )
  );

-- ============================================================================
-- FIX 2: Profiles Table INSERT Policies (Consolidate)
-- ============================================================================

-- Drop all duplicate INSERT policies
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Authenticated users can insert own profile" ON profiles;
DROP POLICY IF EXISTS "Professionals can insert client profiles" ON profiles;
DROP POLICY IF EXISTS "Professionals can insert guest client profiles" ON profiles;
DROP POLICY IF EXISTS "Allow anonymous profile creation for guests" ON profiles;

-- Policy 1: Users creating their own profile during registration
CREATE POLICY "profiles_insert_own"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Users can only insert their own profile
    (auth.uid() = id AND is_guest = false)
  );

-- Policy 2: Professionals creating guest client profiles
CREATE POLICY "profiles_insert_guest_clients"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Must be creating a guest client profile
    is_guest = true 
    AND role = 'client'
    -- The authenticated user must be a professional/admin
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
      AND p.role IN ('professional', 'admin', 'super_admin')
    )
  );

-- ============================================================================
-- FIX 3: Calendar Notes Policies
-- ============================================================================

-- Drop existing policy and recreate with explicit conditions
DROP POLICY IF EXISTS "Professionals can manage their calendar notes" ON calendar_notes;

-- Policy for professionals to manage their own calendar notes
CREATE POLICY "calendar_notes_manage_own"
  ON calendar_notes
  FOR ALL
  TO authenticated
  USING (
    professional_id = auth.uid()
  )
  WITH CHECK (
    professional_id = auth.uid()
  );

-- ============================================================================
-- FIX 4: Client Notes Policies (Verify)
-- ============================================================================

-- Drop existing policies to recreate them clearly
DROP POLICY IF EXISTS "Professionals can view their own client notes" ON client_notes;
DROP POLICY IF EXISTS "Professionals can insert their own client notes" ON client_notes;
DROP POLICY IF EXISTS "Professionals can update their own client notes" ON client_notes;
DROP POLICY IF EXISTS "Professionals can delete their own client notes" ON client_notes;

-- SELECT policy: Professionals can view their client notes
CREATE POLICY "client_notes_select_own"
  ON client_notes
  FOR SELECT
  TO authenticated
  USING (
    professional_id = auth.uid()
  );

-- INSERT policy: Professionals can create notes for clients
CREATE POLICY "client_notes_insert_own"
  ON client_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    professional_id = auth.uid()
    -- The client_id must be a valid profile
    AND EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = client_id
    )
  );

-- UPDATE policy: Professionals can update their client notes
CREATE POLICY "client_notes_update_own"
  ON client_notes
  FOR UPDATE
  TO authenticated
  USING (
    professional_id = auth.uid()
  )
  WITH CHECK (
    professional_id = auth.uid()
  );

-- DELETE policy: Professionals can delete their client notes
CREATE POLICY "client_notes_delete_own"
  ON client_notes
  FOR DELETE
  TO authenticated
  USING (
    professional_id = auth.uid()
  );

-- ============================================================================
-- Add helpful indexes if they don't exist
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_client_notes_client_id ON client_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_client_notes_professional_id ON client_notes(professional_id);
CREATE INDEX IF NOT EXISTS idx_calendar_notes_professional_date ON calendar_notes(professional_id, date);
CREATE INDEX IF NOT EXISTS idx_profiles_is_guest_role ON profiles(is_guest, role);

-- ============================================================================
-- Add comments for documentation
-- ============================================================================

COMMENT ON POLICY "profiles_select_all_cases" ON profiles IS 
  'Allows: (1) users to view own profile, (2) anyone to view professional profiles, (3) professionals to view their guest clients';

COMMENT ON POLICY "profiles_insert_own" ON profiles IS 
  'Allows authenticated users to create their own profile during registration';

COMMENT ON POLICY "profiles_insert_guest_clients" ON profiles IS 
  'Allows professionals to create guest client profiles (clients without auth accounts)';

COMMENT ON POLICY "calendar_notes_manage_own" ON calendar_notes IS 
  'Allows professionals to manage their own calendar notes and time slot annotations';

COMMENT ON POLICY "client_notes_select_own" ON client_notes IS 
  'Allows professionals to view notes about their clients';

COMMENT ON POLICY "client_notes_insert_own" ON client_notes IS 
  'Allows professionals to create notes for their clients';
