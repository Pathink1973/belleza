/*
  # Add Unique Constraint for Reviews

  1. Changes
    - Add unique constraint on reviews table to prevent duplicate reviews for the same booking
    - Ensures data integrity at the database level
  
  2. Security
    - No RLS changes needed as existing policies are sufficient
*/

-- Add unique constraint to prevent multiple reviews for the same booking
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'reviews_booking_id_key'
  ) THEN
    ALTER TABLE reviews ADD CONSTRAINT reviews_booking_id_key UNIQUE (booking_id);
  END IF;
END $$;
