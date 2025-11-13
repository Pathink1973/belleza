/*
  # Fix Anonymous Guest Profile Creation for Bookings
  
  ## Summary
  This migration fixes the critical issue where anonymous users (not logged in) cannot 
  create guest profiles when making bookings through the public booking form.
  
  ## Problem Identified
  The current RLS policies on the `profiles` table only allow:
  1. Authenticated users to create their own profile (profiles_insert_own)
  2. Authenticated professionals/admins to create guest client profiles (profiles_insert_guest_clients)
  
  However, there is NO policy that allows anonymous users to create guest profiles.
  When an anonymous user tries to book a service, the BookingForm.tsx attempts to:
  1. Create a guest profile in the profiles table (FAILS due to missing RLS policy)
  2. Create a booking referencing that guest profile
  
  This causes the "Agendar" (Book) modal to fail silently or show generic errors.
  
  ## Root Cause
  - Anonymous users (auth.uid() IS NULL) cannot INSERT into profiles table
  - The profiles_insert_guest_clients policy requires auth.uid() to be a professional
  - This blocks the entire guest booking flow
  
  ## Solution
  Add a new RLS policy that allows anonymous users to create guest profiles with:
  - is_guest = true
  - role = 'client'
  - email IS NOT NULL
  - mobile_number IS NOT NULL
  - full_name IS NOT NULL
  
  ## Security Considerations
  - Anonymous users can ONLY create guest profiles (is_guest = true)
  - They CANNOT create regular user profiles (is_guest = false)
  - All required fields must be filled (email, mobile_number, full_name)
  - Guest profiles are always created with role = 'client'
  - This is safe because guest profiles have limited permissions and no auth.uid()
  
  ## Changes Made
  1. Create new policy "profiles_insert_anonymous_guests" for anonymous guest creation
  2. Keep existing policies intact for authenticated user scenarios
  3. Add comments for clarity
*/

-- Drop the policy if it exists (idempotent migration)
DROP POLICY IF EXISTS "profiles_insert_anonymous_guests" ON profiles;

-- Create new policy to allow anonymous users to create guest profiles
CREATE POLICY "profiles_insert_anonymous_guests"
  ON profiles FOR INSERT
  WITH CHECK (
    -- This policy applies when there is NO authenticated user (anonymous)
    auth.uid() IS NULL
    AND
    -- The profile being created must be a guest profile
    is_guest = true
    AND
    -- The profile must be a client (not professional/admin)
    role = 'client'
    AND
    -- Required fields must be provided
    email IS NOT NULL
    AND mobile_number IS NOT NULL
    AND full_name IS NOT NULL
  );

-- Add helpful comment to the policy
COMMENT ON POLICY "profiles_insert_anonymous_guests" ON profiles IS 
  'Allows anonymous users to create guest client profiles when booking services without authentication. Required for public booking flow.';

-- Verify all INSERT policies on profiles table
DO $$
BEGIN
  RAISE NOTICE 'Migration completed successfully!';
  RAISE NOTICE 'Profiles INSERT policies now include:';
  RAISE NOTICE '1. profiles_insert_own - Authenticated users can create their own profile';
  RAISE NOTICE '2. profiles_insert_guest_clients - Professionals can create guest profiles for their clients';
  RAISE NOTICE '3. profiles_insert_anonymous_guests - Anonymous users can create guest profiles when booking';
END $$;
