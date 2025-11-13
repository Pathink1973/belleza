/*
  # Create Service Team Members System

  ## Overview
  This migration creates a dedicated team member system for services that need
  to list team members by name and photo (like Fitness trainers), rather than
  linking to existing professional accounts on the platform.

  ## Changes

  1. **New Table: service_team_members**
     - Stores custom team members for services (names + photos)
     - `id` (uuid, primary key) - Unique identifier
     - `service_id` (uuid, foreign key) - References the service
     - `name` (text) - Name of the team member (e.g., trainer name)
     - `photo_url` (text) - URL of the team member's photo
     - `display_order` (integer) - Order in which to display team members
     - `created_at` (timestamp) - Record creation timestamp

  2. **Indexes**
     - Index on service_id for efficient lookup of team members by service
     - Index on display_order for proper ordering

  3. **Security**
     - Enable Row Level Security (RLS)
     - SELECT policy: Public can view team members
     - INSERT policy: Only service owner can add team members
     - UPDATE policy: Only service owner can update team members
     - DELETE policy: Only service owner can delete team members

  ## Important Notes
  - This table is separate from service_professionals
  - service_professionals: Links to existing professional accounts (for services like hair salons)
  - service_team_members: Custom team members with just name and photo (for services like fitness)
  - Services can use either system based on their category
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
CREATE POLICY "Service team members are viewable by everyone"
  ON service_team_members FOR SELECT
  USING (true);

-- INSERT policy: Only the service owner can add team members
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
