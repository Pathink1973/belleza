/*
  # Add WhatsApp number to services table

  1. Changes
    - Add whatsapp_number column to services table
    - Add validation for WhatsApp number format
    - Handle existing rows by setting a default value

  2. Security
    - No additional security needed as the table already has RLS enabled
*/

-- First add the column without constraints
ALTER TABLE services ADD COLUMN IF NOT EXISTS whatsapp_number text;

-- Update existing rows with an empty string
UPDATE services SET whatsapp_number = '' WHERE whatsapp_number IS NULL;

-- Now make the column NOT NULL and add the constraint
ALTER TABLE services 
  ALTER COLUMN whatsapp_number SET NOT NULL,
  ADD CONSTRAINT valid_whatsapp_number 
  CHECK (whatsapp_number ~ '^\+?[1-9]\d{1,14}$' OR whatsapp_number = '');