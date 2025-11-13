/*
  # Fix Profiles RLS Policy - Allow Professionals to View Their Clients
  
  ## Summary
  This migration fixes a critical bug where professionals cannot view their bookings
  because they cannot access the client profiles associated with those bookings.
  
  ## Problem
  The current "profiles_select_simple" RLS policy only allows:
  1. Public access to professional/admin profiles
  2. Users to view their own profile
  3. Authenticated users to view guest client profiles
  
  This means when a professional queries their bookings with a JOIN to the client's
  profile, the RLS policy blocks access to regular (non-guest) client profiles,
  causing the booking to be filtered out by the application logic.
  
  ## Example Scenario
  - Professional "Vitor Hugo" (ID: d4dcab75-1f95-4470-87d9-40eee89001f9)
  - Client "António Brito" (ID: f81a34fd-930f-4c5f-8b0c-cbb030652fb9, is_guest: false)
  - Booking exists linking them
  - Professional queries: SELECT * FROM bookings JOIN profiles ON client_id = profiles.id
  - RLS blocks access to António's profile because he's not a guest
  - Booking appears to not exist because client data is missing
  
  ## Solution
  Add a new condition to the profiles SELECT policy that allows authenticated users
  to view client profiles when there's a booking relationship between them.
  
  Specifically, allow viewing a client profile if:
  - The authenticated user is a professional, AND
  - There exists a booking where the professional is the authenticated user AND
    the client is the profile being queried
  
  ## Security Considerations
  - Professionals can only view client profiles for clients they have bookings with
  - Clients cannot view other clients' profiles
  - Public users still cannot view regular client profiles
  - All other existing access rules remain unchanged
  
  ## Changes Made
  1. Drop existing "profiles_select_simple" policy
  2. Recreate with additional condition for professional-client relationships
  3. Maintain all existing security conditions
*/

-- Drop the existing SELECT policy for profiles
DROP POLICY IF EXISTS "profiles_select_simple" ON profiles;

-- Create the updated SELECT policy with professional-client access
CREATE POLICY "profiles_select_simple"
  ON profiles FOR SELECT
  USING (
    -- Condition 1: Public can view professional, admin, and super_admin profiles
    role IN ('professional', 'admin', 'super_admin')
    OR
    -- Condition 2: Authenticated users can view their own profile
    (auth.uid() IS NOT NULL AND auth.uid() = id)
    OR
    -- Condition 3: Authenticated users can view guest client profiles
    (is_guest = true AND role = 'client' AND auth.uid() IS NOT NULL)
    OR
    -- Condition 4: Professionals can view their clients' profiles
    -- CRITICAL FIX: This is the new condition that was missing
    (
      -- The profile being viewed must be a client
      role = 'client'
      AND
      -- There must be a booking relationship between the authenticated user and this client
      EXISTS (
        SELECT 1 FROM bookings
        WHERE bookings.professional_id = auth.uid()
          AND bookings.client_id = profiles.id
      )
    )
    OR
    -- Condition 5: Clients can view their professionals' profiles through bookings
    (
      -- The profile being viewed must be a professional
      role IN ('professional', 'admin', 'super_admin')
      AND
      -- There must be a booking relationship between the authenticated user and this professional
      EXISTS (
        SELECT 1 FROM bookings
        WHERE bookings.client_id = auth.uid()
          AND bookings.professional_id = profiles.id
      )
    )
  );

-- Add a helpful comment to the policy
COMMENT ON POLICY "profiles_select_simple" ON profiles IS 
  'Allows: (1) public to view professionals, (2) users to view own profile, (3) authenticated to view guest clients, (4) professionals to view their clients, (5) clients to view their professionals';
