/*
  # Add Multiple Images Support to Services

  1. Changes
    - Rename image_url to images (array of text)
    - Migrate existing single image URLs to array format
    - Allow services to have multiple images

  2. Migration Strategy
    - First, add new column 'images' as text array
    - Copy existing image_url data to images array
    - Remove old image_url column
*/

-- Add new images column as array
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'images'
  ) THEN
    ALTER TABLE services ADD COLUMN images text[] DEFAULT '{}';
  END IF;
END $$;

-- Migrate existing image_url data to images array
UPDATE services
SET images = ARRAY[image_url]::text[]
WHERE image_url IS NOT NULL AND image_url != '' AND (images IS NULL OR images = '{}');

-- Drop the old image_url column if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'services' AND column_name = 'image_url'
  ) THEN
    ALTER TABLE services DROP COLUMN image_url;
  END IF;
END $$;
