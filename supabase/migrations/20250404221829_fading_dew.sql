/*
  # Fix Calendar Notes RLS Policies

  1. Changes
    - Drop existing RLS policies
    - Create comprehensive policies for all operations
    - Add proper professional role checks
    
  2. Security
    - Ensure professionals can only manage their own notes
    - Add proper role validation
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Professionals can manage their own notes" ON calendar_notes;

-- Enable RLS
ALTER TABLE calendar_notes ENABLE ROW LEVEL SECURITY;

-- Create insert policy
CREATE POLICY "Professionals can insert notes"
ON calendar_notes
FOR INSERT
TO authenticated
WITH CHECK (
  professional_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'professional'
  )
);

-- Create select policy
CREATE POLICY "Professionals can view their notes"
ON calendar_notes
FOR SELECT
TO authenticated
USING (
  professional_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'professional'
  )
);

-- Create update policy
CREATE POLICY "Professionals can update their notes"
ON calendar_notes
FOR UPDATE
TO authenticated
USING (
  professional_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'professional'
  )
)
WITH CHECK (
  professional_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'professional'
  )
);

-- Create delete policy
CREATE POLICY "Professionals can delete their notes"
ON calendar_notes
FOR DELETE
TO authenticated
USING (
  professional_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'professional'
  )
);