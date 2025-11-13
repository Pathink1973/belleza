/*
  # Fix profiles table RLS policies

  1. Changes
    - Ensure RLS is enabled on profiles table
    - Drop existing policies to avoid conflicts
    - Recreate all necessary policies with proper conditions

  2. Security
    - Enable RLS on profiles table
    - Add policies for:
      - INSERT: Authenticated users can create their own profile
      - SELECT: Public access to view profiles
      - UPDATE: Users can update their own profile
*/

-- Enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create insert policy
CREATE POLICY "Users can create their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Create select policy
CREATE POLICY "Profiles are viewable by everyone"
  ON profiles
  FOR SELECT
  TO public
  USING (true);

-- Create update policy
CREATE POLICY "Users can update own profile"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);