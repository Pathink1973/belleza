/*
  # Add Booking and Review Management Features

  1. Changes to Bookings Table
    - Add `updated_at` column to track when bookings are modified
    - Add `cancellation_reason` column to store reason for cancellation
    - Add `is_archived` column for soft delete functionality
    - Add trigger to automatically update `updated_at` timestamp

  2. Changes to Reviews Table
    - Add `updated_at` column to track when reviews are edited
    - Add `original_created_at` column to preserve original creation date
    - Add trigger to automatically update `updated_at` timestamp

  3. New Indexes
    - Add index on bookings(client_id, status) for filtering
    - Add index on bookings(client_id, start_time) for date sorting
    - Add index on reviews(client_id) for client review history

  4. Security
    - Maintain existing RLS policies
    - Will add UPDATE policies in next migration
*/

-- Add new columns to bookings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'cancellation_reason'
  ) THEN
    ALTER TABLE bookings ADD COLUMN cancellation_reason text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'is_archived'
  ) THEN
    ALTER TABLE bookings ADD COLUMN is_archived boolean DEFAULT false;
  END IF;
END $$;

-- Add new columns to reviews table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE reviews ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reviews' AND column_name = 'original_created_at'
  ) THEN
    ALTER TABLE reviews ADD COLUMN original_created_at timestamptz;
    -- Copy existing created_at to original_created_at for existing reviews
    UPDATE reviews SET original_created_at = created_at WHERE original_created_at IS NULL;
  END IF;
END $$;

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for bookings table
DROP TRIGGER IF EXISTS update_bookings_updated_at ON bookings;
CREATE TRIGGER update_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create triggers for reviews table
DROP TRIGGER IF EXISTS update_reviews_updated_at ON reviews;
CREATE TRIGGER update_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_bookings_client_status ON bookings(client_id, status);
CREATE INDEX IF NOT EXISTS idx_bookings_client_start_time ON bookings(client_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_archived ON bookings(is_archived, client_id);
CREATE INDEX IF NOT EXISTS idx_reviews_client ON reviews(client_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking ON reviews(booking_id);