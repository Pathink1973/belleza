/*
  # Add Service Variant Support to Bookings

  ## Overview
  This migration adds support for tracking which specific service variant was booked. This allows the system to store and display the exact pricing option (e.g., "Corte Adulto" vs "Corte Criança") chosen by the client during booking.

  ## Changes

  1. **Table Modifications**
    - Add `service_variant_id` column to `bookings` table
      - Type: uuid (nullable for backward compatibility)
      - Foreign key reference to `service_variants(id)`
      - ON DELETE SET NULL to preserve booking history even if variant is deleted

  2. **Indexes**
    - Add index on `service_variant_id` for efficient lookups

  3. **Security**
    - RLS policies automatically apply to the new column through existing policies
    - No additional policies needed as the column is optional

  ## Important Notes
  - Existing bookings will have NULL service_variant_id (backward compatible)
  - New bookings can optionally specify a variant
  - If a service has variants, the booking should include service_variant_id
  - If a service has no variants, service_variant_id remains NULL
*/

-- Add service_variant_id column to bookings table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'service_variant_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN service_variant_id uuid REFERENCES service_variants(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_bookings_service_variant_id ON bookings(service_variant_id);
