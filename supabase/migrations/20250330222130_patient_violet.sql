/*
  # Add image_url to services table

  1. Changes
    - Add image_url column to services table
    - Make it nullable since not all services might have images

  2. Security
    - No additional security needed as the table already has RLS enabled
*/

ALTER TABLE services ADD COLUMN IF NOT EXISTS image_url text;