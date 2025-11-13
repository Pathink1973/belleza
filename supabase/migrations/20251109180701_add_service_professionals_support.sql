/*
  # Add Multiple Professionals Support for Services
  
  ## Overview
  This migration enables services to be offered by multiple professionals,
  allowing clients to choose any available professional or a specific one
  when making a booking.
  
  ## Changes
  
  1. **New Table: service_professionals**
     - Links services to multiple professionals who can provide them
     - `id` (uuid, primary key) - Unique identifier
     - `service_id` (uuid, foreign key) - References the service
     - `profile_id` (uuid, foreign key) - References the professional's profile
     - `is_primary` (boolean) - Indicates if this is the primary/owner professional
     - `created_at` (timestamp) - Record creation timestamp
     - UNIQUE constraint on (service_id, profile_id) - Prevents duplicates
  
  2. **Indexes**
     - Index on service_id for efficient lookup of professionals by service
     - Index on profile_id for efficient lookup of services by professional
     - Index on is_primary for filtering primary professionals
  
  3. **Security**
     - Enable Row Level Security (RLS)
     - SELECT policy: Public can view service-professional associations
     - INSERT policy: Only service owner can add professionals to their service
     - DELETE policy: Only service owner can remove professionals
  
  4. **Data Migration**
     - Populate service_professionals with existing service->professional relationships
     - Set is_primary = true for the original service owner
  
  ## Important Notes
  - The services.professional_id column is preserved for backward compatibility
  - The new table allows a service to have multiple professionals
  - Booking logic will need to be updated to handle professional selection
  - Availability checking will need to support multiple professionals
*/

-- Create service_professionals junction table
CREATE TABLE IF NOT EXISTS service_professionals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  is_primary boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(service_id, profile_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_professionals_service_id ON service_professionals(service_id);
CREATE INDEX IF NOT EXISTS idx_service_professionals_profile_id ON service_professionals(profile_id);
CREATE INDEX IF NOT EXISTS idx_service_professionals_is_primary ON service_professionals(is_primary);

-- Enable Row Level Security
ALTER TABLE service_professionals ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Anyone can view service-professional associations (public data)
CREATE POLICY "Service professionals are viewable by everyone"
  ON service_professionals FOR SELECT
  USING (true);

-- INSERT policy: Only the professional who owns the service can add team members
CREATE POLICY "Service owners can add professionals to their services"
  ON service_professionals FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_professionals.service_id
      AND services.professional_id = auth.uid()
    )
  );

-- DELETE policy: Only the professional who owns the service can remove team members
CREATE POLICY "Service owners can remove professionals from their services"
  ON service_professionals FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_professionals.service_id
      AND services.professional_id = auth.uid()
    )
  );

-- Migrate existing service->professional relationships
-- This ensures all current services have their primary professional listed
INSERT INTO service_professionals (service_id, profile_id, is_primary)
SELECT 
  id as service_id,
  professional_id as profile_id,
  true as is_primary
FROM services
WHERE professional_id IS NOT NULL
ON CONFLICT (service_id, profile_id) DO NOTHING;

-- Add comment for documentation
COMMENT ON TABLE service_professionals IS 
'Junction table linking services to professionals who can provide them. 
Enables multiple professionals to offer the same service, giving clients 
flexibility to choose based on availability. The is_primary flag indicates 
the service owner/creator.';
