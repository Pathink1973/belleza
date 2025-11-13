/*
  # Fix Team Member Unique Identification System

  ## Problem
  Team members in services.team JSONB array all share the same profile_id
  (the service owner's ID), causing multiple cards to be selected simultaneously
  when booking.

  ## Solution
  1. Add team_member_id column to bookings table for unique identification
  2. Sync existing team JSONB data to service_team_members table
  3. Add team_member_db_id to team JSONB for cross-reference
  
  ## Important
  - Primary member (is_primary=true) continues using profile_id
  - Other team members use team_member_id for unique identification
*/

-- Add team_member_id column to bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'team_member_id'
  ) THEN
    ALTER TABLE bookings 
    ADD COLUMN team_member_id uuid REFERENCES service_team_members(id) ON DELETE SET NULL;
    
    CREATE INDEX IF NOT EXISTS idx_bookings_team_member_id ON bookings(team_member_id);
    
    COMMENT ON COLUMN bookings.team_member_id IS
    'References a decorative team member from service_team_members table.
    Used for non-primary team members who do not have their own platform accounts.
    If NULL, the booking is with the service owner (use professional_id instead).';
  END IF;
END $$;

-- Function to sync team JSONB to service_team_members and update JSONB with db IDs
CREATE OR REPLACE FUNCTION sync_team_members()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  service_rec RECORD;
  team_member JSONB;
  team_member_id uuid;
  updated_team JSONB;
  display_order_counter integer;
BEGIN
  -- Process each service with team data
  FOR service_rec IN
    SELECT id, professional_id, team
    FROM services
    WHERE team IS NOT NULL 
    AND jsonb_array_length(team) > 0
  LOOP
    updated_team := '[]'::jsonb;
    display_order_counter := 0;
    
    -- Process each member in the team
    FOR team_member IN
      SELECT * FROM jsonb_array_elements(service_rec.team)
    LOOP
      -- Check if this is the primary member (service owner)
      IF COALESCE((team_member->>'is_primary')::boolean, false) = true THEN
        -- Keep primary member as-is, just ensure profile_id is set
        updated_team := updated_team || jsonb_build_array(
          team_member || jsonb_build_object(
            'profile_id', service_rec.professional_id::text,
            'is_primary', true
          )
        );
      ELSE
        -- For non-primary members, create/get service_team_member record
        -- Check if member already exists in service_team_members
        SELECT id INTO team_member_id
        FROM service_team_members
        WHERE service_id = service_rec.id
          AND name = team_member->>'name'
          AND photo_url = COALESCE(team_member->>'imageUrl', '');
        
        -- If doesn't exist, create it
        IF team_member_id IS NULL THEN
          INSERT INTO service_team_members (
            service_id,
            name,
            photo_url,
            display_order
          )
          VALUES (
            service_rec.id,
            team_member->>'name',
            COALESCE(team_member->>'imageUrl', ''),
            display_order_counter
          )
          RETURNING id INTO team_member_id;
        END IF;
        
        -- Add member to updated team with team_member_db_id
        updated_team := updated_team || jsonb_build_array(
          team_member || jsonb_build_object(
            'team_member_db_id', team_member_id::text,
            'is_primary', false
          )
        );
      END IF;
      
      display_order_counter := display_order_counter + 1;
    END LOOP;
    
    -- Update service with new team structure
    IF jsonb_array_length(updated_team) > 0 THEN
      UPDATE services
      SET team = updated_team
      WHERE id = service_rec.id;
    END IF;
  END LOOP;
END;
$$;

-- Execute the sync function
SELECT sync_team_members();

-- Grant permissions
GRANT EXECUTE ON FUNCTION sync_team_members() TO authenticated;
