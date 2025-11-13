/*
  # Add updated_at column and trigger to services table

  1. Changes
    - Add updated_at column to services table
    - Create trigger function to update timestamp
    - Add trigger to services table
    
  2. Security
    - No additional security needed
    - Uses existing RLS policies
*/

-- Add updated_at column if it doesn't exist
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS update_timestamp ON services;
CREATE TRIGGER update_timestamp
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_timestamp();