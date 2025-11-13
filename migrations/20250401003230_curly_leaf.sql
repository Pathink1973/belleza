/*
  # Add WhatsApp number to services table

  1. Changes
    - Add whatsapp_number column to services table
    - Add validation for WhatsApp number format
    - Make the column required
    
  2. Validation
    - WhatsApp number must be in international format
    - Allows empty string for temporary storage
*/

-- Drop existing constraint if it exists
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.table_constraints 
    WHERE constraint_name = 'valid_whatsapp_number'
    AND table_name = 'services'
  ) THEN
    ALTER TABLE services DROP CONSTRAINT valid_whatsapp_number;
  END IF;
END $$;

-- Add column if it doesn't exist
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'services' 
    AND column_name = 'whatsapp_number'
  ) THEN
    ALTER TABLE services ADD COLUMN whatsapp_number text;
  END IF;
END $$;

-- Update existing rows with an empty string
UPDATE services SET whatsapp_number = '' WHERE whatsapp_number IS NULL;

-- Make the column NOT NULL and add the constraint
ALTER TABLE services 
  ALTER COLUMN whatsapp_number SET NOT NULL;

-- Add the constraint
ALTER TABLE services 
  ADD CONSTRAINT valid_whatsapp_number 
  CHECK (whatsapp_number ~ '^\+?[1-9]\d{1,14}$' OR whatsapp_number = '');