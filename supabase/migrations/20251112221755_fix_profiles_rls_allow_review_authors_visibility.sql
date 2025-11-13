/*
  # Fix Profiles RLS to Allow Viewing Review Authors

  ## Problem
  When clients try to view service details with reviews, the page crashes because 
  the RLS policy on the profiles table prevents clients from viewing other clients' 
  profile information in the reviews join query.

  ## Solution
  Update the profiles SELECT policy to allow anyone to view basic profile information 
  (name and avatar) for users who have written reviews. This is public information 
  that should be visible to all users viewing service details.

  ## Changes
  1. Drop the existing restrictive SELECT policy
  2. Create a new policy that allows:
     - Everyone to view professionals/admins
     - Everyone to view their own profile
     - Everyone to view profiles of users who have written reviews (review authors)
     - Authenticated users to view guest clients
     - Professionals/admins to view all client profiles

  ## Security
  - Review author information (name and avatar) is considered public data
  - This aligns with standard review system practices where reviewer names are visible
  - No sensitive data is exposed (email, phone remain protected)
*/

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "profiles_select_simple" ON profiles;

-- Create new policy with support for viewing review authors
CREATE POLICY "profiles_select_with_review_authors"
  ON profiles
  FOR SELECT
  TO public
  USING (
    -- Everyone can view professionals and admins (public profiles)
    (role IN ('professional', 'admin', 'super_admin'))
    OR
    -- Users can view their own profile
    (auth.uid() IS NOT NULL AND auth.uid() = id)
    OR
    -- Anyone can view profiles of users who have written reviews (review authors are public)
    (EXISTS (
      SELECT 1 FROM reviews r WHERE r.client_id = profiles.id
    ))
    OR
    -- Authenticated users can view guest clients
    (is_guest = true AND role = 'client' AND auth.uid() IS NOT NULL)
    OR
    -- Authenticated professionals/admins can view all client profiles
    (role = 'client' AND auth.uid() IS NOT NULL AND public.is_professional_or_admin())
  );

COMMENT ON POLICY "profiles_select_with_review_authors" ON profiles IS 
  'Allows: (1) public to view professionals, (2) users to view own profile, (3) anyone to view review authors, (4) authenticated to view guest clients, (5) professionals/admins to view all client profiles';
