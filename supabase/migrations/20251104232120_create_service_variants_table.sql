/*
  # Create Service Variants Table for Multi-Price Service Options

  ## Overview
  This migration creates a new service_variants table to support multiple pricing and duration options for each service. This allows professionals to offer the same service at different price points (e.g., "Corte Adulto", "Corte Adulto + Barba", "Corte Fade Zero c/Lâmina").

  ## Changes

  1. **New Tables**
    - `service_variants`
      - `id` (uuid, primary key) - Unique identifier for each variant
      - `service_id` (uuid, foreign key) - References parent service
      - `name` (text, required) - Descriptive name for the variant (e.g., "Corte Adulto", "Corte + Barba")
      - `price` (numeric, required) - Price for this specific variant in euros
      - `duration` (text, required) - Duration in format "X minutes" 
      - `display_order` (integer) - Order for displaying variants (lower numbers first)
      - `created_at` (timestamp) - Record creation timestamp

  2. **Indexes**
    - Index on service_id for efficient lookups by parent service
    - Index on display_order for efficient ordering

  3. **Security**
    - Enable Row Level Security (RLS) on service_variants table
    - SELECT policy: Anyone can view service variants (public data)
    - INSERT policy: Only service owner (professional) can create variants
    - UPDATE policy: Only service owner can update variants
    - DELETE policy: Only service owner can delete variants

  ## Important Notes
  - Existing services will continue to work with their current single price/duration
  - The services table price/duration fields are preserved for backward compatibility
  - Professionals can optionally add multiple variants to their services
  - When variants exist, they take precedence over the base service price/duration
*/

-- Create service_variants table
CREATE TABLE IF NOT EXISTS service_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL CHECK (price >= 0),
  duration text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_variants_service_id ON service_variants(service_id);
CREATE INDEX IF NOT EXISTS idx_service_variants_display_order ON service_variants(display_order);

-- Enable Row Level Security
ALTER TABLE service_variants ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Anyone can view service variants (they are public data)
CREATE POLICY "Service variants are viewable by everyone"
  ON service_variants FOR SELECT
  USING (true);

-- INSERT policy: Only the professional who owns the service can create variants
CREATE POLICY "Professionals can insert variants for their services"
  ON service_variants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_variants.service_id
      AND services.professional_id = auth.uid()
    )
  );

-- UPDATE policy: Only the professional who owns the service can update variants
CREATE POLICY "Professionals can update variants for their services"
  ON service_variants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_variants.service_id
      AND services.professional_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_variants.service_id
      AND services.professional_id = auth.uid()
    )
  );

-- DELETE policy: Only the professional who owns the service can delete variants
CREATE POLICY "Professionals can delete variants for their services"
  ON service_variants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_variants.service_id
      AND services.professional_id = auth.uid()
    )
  );