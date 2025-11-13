/*
  # Update Client Notes System

  1. Changes
    - Add mobile_number to profiles table
    - Create client_notes table
    - Add policies and triggers
    
  2. Security
    - Enable RLS on client_notes table
    - Add policies for professional access
*/

-- Add mobile_number to profiles if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'mobile_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN mobile_number text;
    ALTER TABLE profiles ADD CONSTRAINT valid_mobile_number CHECK (mobile_number ~ '^\+?[1-9]\d{1,14}$');
  END IF;
END $$;

-- Create client notes table if not exists
CREATE TABLE IF NOT EXISTS client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on client_notes
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DO $$ 
BEGIN
    DROP POLICY IF EXISTS "Professionals can create notes for their clients" ON client_notes;
    DROP POLICY IF EXISTS "Professionals can view their client notes" ON client_notes;
    DROP POLICY IF EXISTS "Professionals can update their notes" ON client_notes;
EXCEPTION
    WHEN undefined_object THEN null;
END $$;

-- Create client notes policies
CREATE POLICY "Professionals can create notes for their clients"
  ON client_notes
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

CREATE POLICY "Professionals can view their client notes"
  ON client_notes
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

CREATE POLICY "Professionals can update their notes"
  ON client_notes
  FOR UPDATE
  TO authenticated
  USING (
    professional_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'professional'
    )
  );

-- Create indexes for better performance
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_client_notes_client_professional'
    ) THEN
        CREATE INDEX idx_client_notes_client_professional 
        ON client_notes (client_id, professional_id);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_client_notes_created'
    ) THEN
        CREATE INDEX idx_client_notes_created 
        ON client_notes (created_at);
    END IF;
END $$;

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION update_client_notes_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger to avoid conflicts
DROP TRIGGER IF EXISTS update_client_notes_timestamp ON client_notes;

-- Create trigger
CREATE TRIGGER update_client_notes_timestamp
  BEFORE UPDATE ON client_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_client_notes_timestamp();