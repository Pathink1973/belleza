/*
  # Create Service Team Members Table
  
  ## Overview
  Creates the service_team_members table for storing decorative team members
  (name + photo) without requiring platform accounts.
  
  ## Changes
  1. Create service_team_members table
  2. Add indexes for performance
  3. Enable RLS with appropriate policies
*/

-- Create service_team_members table
CREATE TABLE IF NOT EXISTS service_team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  name text NOT NULL,
  photo_url text NOT NULL,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_service_team_members_service_id ON service_team_members(service_id);
CREATE INDEX IF NOT EXISTS idx_service_team_members_display_order ON service_team_members(display_order);

-- Enable Row Level Security
ALTER TABLE service_team_members ENABLE ROW LEVEL SECURITY;

-- SELECT policy: Anyone can view team members (public data)
DROP POLICY IF EXISTS "Service team members are viewable by everyone" ON service_team_members;
CREATE POLICY "Service team members are viewable by everyone"
  ON service_team_members FOR SELECT
  USING (true);

-- INSERT policy: Only the service owner can add team members
DROP POLICY IF EXISTS "Service owners can add team members" ON service_team_members;
CREATE POLICY "Service owners can add team members"
  ON service_team_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_team_members.service_id
      AND services.professional_id = auth.uid()
    )
  );

-- UPDATE policy: Only the service owner can update team members
DROP POLICY IF EXISTS "Service owners can update team members" ON service_team_members;
CREATE POLICY "Service owners can update team members"
  ON service_team_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_team_members.service_id
      AND services.professional_id = auth.uid()
    )
  );

-- DELETE policy: Only the service owner can delete team members
DROP POLICY IF EXISTS "Service owners can delete team members" ON service_team_members;
CREATE POLICY "Service owners can delete team members"
  ON service_team_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_team_members.service_id
      AND services.professional_id = auth.uid()
    )
  );

-- Add comment for documentation
COMMENT ON TABLE service_team_members IS
'Stores custom team members for services that need to display team members
by name and photo (e.g., fitness trainers, massage therapists) without
requiring them to have professional accounts on the platform. This is separate
from service_professionals which links to existing professional accounts.';
