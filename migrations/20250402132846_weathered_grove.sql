/*
  # Fix Profiles RLS Policies

  1. Changes
    - Fix policy for profile creation to properly handle professionals creating client profiles
    - Update existing policies for better security
    
  2. Security
    - Maintain existing security for user self-management
    - Add specific permissions for professionals
*/

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Enable profile creation during signup" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create policy for profile creation
CREATE POLICY "Enable profile creation during signup"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Users can create their own profile during signup
  auth.uid() = id
  OR
  -- Professionals can create client profiles
  (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'professional'
    )
    AND role = 'client'
  )
);

-- Create policy for viewing profiles
CREATE POLICY "Profiles are viewable by everyone"
ON profiles
FOR SELECT
TO public
USING (true);

-- Create policy for updating profiles
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Grant necessary permissions
GRANT ALL ON profiles TO authenticated;