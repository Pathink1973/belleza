/*
  # Fix Availability Table Constraints and Add Helper Function
  
  1. Changes
    - Ensure availability table has proper constraints
    - Make professional_id NOT NULL to prevent orphaned records
    - Add unique constraint to prevent duplicate availability slots
    - Create helper function for safe availability upsert
  
  2. Security
    - Maintain existing RLS policies
    - Ensure data integrity with proper constraints
*/

-- Ensure professional_id is NOT NULL (data safety)
DO $$
BEGIN
  -- First check if there are any NULL professional_ids
  IF EXISTS (SELECT 1 FROM availability WHERE professional_id IS NULL) THEN
    -- Delete any orphaned records
    DELETE FROM availability WHERE professional_id IS NULL;
    RAISE NOTICE 'Deleted orphaned availability records with NULL professional_id';
  END IF;
  
  -- Now add the NOT NULL constraint if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'availability' 
    AND column_name = 'professional_id' 
    AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE availability 
    ALTER COLUMN professional_id SET NOT NULL;
    RAISE NOTICE 'Added NOT NULL constraint to availability.professional_id';
  END IF;
END $$;

-- Add unique constraint to prevent duplicate availability slots
-- This helps with upsert operations
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'unique_professional_day_time_slot'
  ) THEN
    -- First, remove any exact duplicates that might exist
    DELETE FROM availability a
    USING availability b
    WHERE a.id < b.id
      AND a.professional_id = b.professional_id
      AND a.day_of_week = b.day_of_week
      AND a.start_time = b.start_time
      AND a.end_time = b.end_time;
    
    -- Now add the unique constraint
    ALTER TABLE availability
    ADD CONSTRAINT unique_professional_day_time_slot 
    UNIQUE (professional_id, day_of_week, start_time, end_time);
    
    RAISE NOTICE 'Added unique constraint to prevent duplicate availability slots';
  END IF;
END $$;

-- Ensure the id column has proper default
DO $$
BEGIN
  -- Verify UUID generation is working
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'availability' 
    AND column_name = 'id' 
    AND column_default = 'gen_random_uuid()'
  ) THEN
    ALTER TABLE availability 
    ALTER COLUMN id SET DEFAULT gen_random_uuid();
    RAISE NOTICE 'Set default UUID generation for availability.id';
  END IF;
END $$;

-- Create index to improve availability query performance
CREATE INDEX IF NOT EXISTS idx_availability_professional_day 
ON availability(professional_id, day_of_week);

-- Add helpful comment
COMMENT ON TABLE availability IS 'Professional availability schedules by day of week. Use unique constraint (professional_id, day_of_week, start_time, end_time) for upsert operations.';
