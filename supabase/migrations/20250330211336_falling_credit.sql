/*
  # Add insert policy for profiles table

  1. Changes
    - Add RLS policy to allow authenticated users to create their own profile
    - This policy ensures users can only create a profile with their own ID

  2. Security
    - Policy only allows users to create their own profile (id must match auth.uid())
    - Maintains existing policies for SELECT and UPDATE
*/

CREATE POLICY "Users can create their own profile"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);