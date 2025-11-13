/*
  # Add category column to services table

  1. Changes
    - Add category column to services table
    - Add check constraint for valid categories
    - Set default category
    
  2. Categories
    - Barbearia
    - Unhas
    - Cabelereiro
*/

-- Add category column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'services' 
    AND column_name = 'category'
  ) THEN
    ALTER TABLE services ADD COLUMN category text;
  END IF;
END $$;

-- Update existing rows with a default category
UPDATE services SET category = 'Cabelereiro' WHERE category IS NULL;

-- Make the column NOT NULL and add category constraint
ALTER TABLE services 
  ALTER COLUMN category SET NOT NULL,
  ADD CONSTRAINT valid_service_category 
  CHECK (category IN ('Barbearia', 'Unhas', 'Cabelereiro'));