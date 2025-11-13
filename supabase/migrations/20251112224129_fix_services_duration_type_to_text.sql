/*
  # Fix Services Duration Type from Interval to Text

  ## Overview
  This migration converts the services.duration column from PostgreSQL interval type to text type.
  This resolves the error "Invalid input syntax for type interval" when saving services.

  ## Problem
  - The services table has duration as interval type (PostgreSQL native)
  - The service_variants table has duration as text type
  - The application sends duration as text like "30 minutos"
  - PostgreSQL interval type cannot parse strings like "30 minutos" causing save errors

  ## Solution
  - Convert services.duration from interval to text for consistency with service_variants
  - Preserve all existing duration data during conversion
  - This allows the application to store durations in any text format

  ## Changes
  
  1. **Schema Modifications**
    - Convert services.duration column from interval to text type
    - Preserve existing data by casting interval values to text format
    - Update column to NOT NULL constraint

  ## Important Notes
  - Existing duration values will be converted to text format (e.g., "00:30:00")
  - The application will need to handle duration display and parsing as text
  - This matches the service_variants table structure for consistency
  - No data loss occurs during this migration
*/

-- Step 1: Convert the duration column from interval to text
-- This preserves existing data by casting the interval to text
ALTER TABLE services 
  ALTER COLUMN duration TYPE text 
  USING duration::text;

-- Step 2: Ensure the column remains NOT NULL
ALTER TABLE services 
  ALTER COLUMN duration SET NOT NULL;
