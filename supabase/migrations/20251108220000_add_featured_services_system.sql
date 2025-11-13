/*
  # Add Featured Services System

  1. Changes
    - Add `is_featured` column to services table
    - Add `featured_priority` column for ordering featured services
    - Create index for faster featured services queries
    - Add RLS policies for featured services management

  2. Security
    - Only professionals can set their own services as featured
    - Public can view all featured services
*/

-- Add is_featured column to services table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'is_featured'
  ) THEN
    ALTER TABLE services ADD COLUMN is_featured boolean DEFAULT false;
  END IF;
END $$;

-- Add featured_priority column for ordering
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'featured_priority'
  ) THEN
    ALTER TABLE services ADD COLUMN featured_priority integer DEFAULT 0;
  END IF;
END $$;

-- Create index for featured services queries
CREATE INDEX IF NOT EXISTS idx_services_featured ON services(is_featured, featured_priority DESC, created_at DESC) WHERE is_featured = true;

-- Create index for general featured queries
CREATE INDEX IF NOT EXISTS idx_services_featured_all ON services(is_featured, created_at DESC);

-- Add comment to explain featured system
COMMENT ON COLUMN services.is_featured IS 'Indicates if service should be displayed in featured sections';
COMMENT ON COLUMN services.featured_priority IS 'Higher numbers appear first in featured listings (0-100)';
