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
DO $$ BEGIN
  ALTER TABLE services DROP CONSTRAINT IF EXISTS valid_whatsapp_number;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- First add the column if it doesn't exist
DO $$ BEGIN
  ALTER TABLE services ADD COLUMN whatsapp_number text;
EXCEPTION
  WHEN duplicate_column THEN NULL;
END $$;

-- Update existing rows with an empty string
UPDATE services SET whatsapp_number = '' WHERE whatsapp_number IS NULL;

-- Now make the column NOT NULL and add the constraint
ALTER TABLE services 
  ALTER COLUMN whatsapp_number SET NOT NULL,
  ADD CONSTRAINT valid_whatsapp_number 
  CHECK (whatsapp_number ~ '^\+?[1-9]\d{1,14}$' OR whatsapp_number = '');