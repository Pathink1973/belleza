/*
  # Fix profiles table RLS policies

  1. Changes
    - Drop all existing policies on profiles table to avoid conflicts
    - Re-enable RLS
    - Create new policies for INSERT, SELECT, and UPDATE operations
    
  2. Security
    - Enable RLS on profiles table
    - Allow authenticated users to create their own profile
    - Allow public access to view profiles
    - Allow users to update their own profile
*/

-- First, enable RLS
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Users can create their own profile" ON profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

-- Create fresh policies

-- Allow users to create their own profile
CREATE POLICY "Users can create their own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);

-- Allow everyone to view profiles
CREATE POLICY "Profiles are viewable by everyone"
ON profiles
FOR SELECT
TO public
USING (true);

-- Allow users to update their own profile
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);