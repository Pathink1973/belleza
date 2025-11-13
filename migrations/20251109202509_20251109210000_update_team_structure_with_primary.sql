/*
  # Update Team Structure to Support Primary Member

  ## Overview
  This migration updates existing services to ensure the service owner is always
  included in the team array as the primary member. This consolidates team
  management into a single location (the service form) using decorative members.

  ## Changes

  1. **Update Existing Services**
     - Add the service owner to the team array if not already present
     - Mark the owner as is_primary = true
     - Include profile_id to distinguish the owner from other team members

  2. **Data Structure**
     - Each team member now has: id, name, imageUrl, profile_id (optional), is_primary (boolean)
     - The owner is always the first member with is_primary = true
     - Other members are decorative (name + photo only)

  ## Important Notes
  - This migration is idempotent and safe to run multiple times
  - Services without a team array will have one created with the owner
  - Services with existing team arrays will have the owner prepended if missing
  - The owner cannot be removed from the team array
*/

-- Function to update team array with primary member
DO $$
DECLARE
  service_record RECORD;
  owner_profile RECORD;
  new_team JSONB;
  owner_in_team BOOLEAN;
BEGIN
  -- Loop through all services
  FOR service_record IN
    SELECT id, professional_id, team
    FROM services
    WHERE professional_id IS NOT NULL
  LOOP
    -- Get owner profile information
    SELECT id, full_name, avatar_url
    INTO owner_profile
    FROM profiles
    WHERE id = service_record.professional_id;

    -- Skip if profile not found
    CONTINUE WHEN owner_profile IS NULL;

    -- Check if team is null or empty
    IF service_record.team IS NULL OR service_record.team = '[]'::jsonb THEN
      -- Create new team array with owner as primary
      new_team := jsonb_build_array(
        jsonb_build_object(
          'id', gen_random_uuid()::text,
          'name', owner_profile.full_name,
          'imageUrl', COALESCE(owner_profile.avatar_url, ''),
          'profile_id', owner_profile.id::text,
          'is_primary', true
        )
      );

      -- Update the service
      UPDATE services
      SET team = new_team
      WHERE id = service_record.id;

    ELSE
      -- Check if owner is already in the team
      owner_in_team := EXISTS (
        SELECT 1
        FROM jsonb_array_elements(service_record.team) AS elem
        WHERE (elem->>'profile_id')::uuid = owner_profile.id
      );

      -- If owner not in team, prepend them
      IF NOT owner_in_team THEN
        new_team := jsonb_build_array(
          jsonb_build_object(
            'id', gen_random_uuid()::text,
            'name', owner_profile.full_name,
            'imageUrl', COALESCE(owner_profile.avatar_url, ''),
            'profile_id', owner_profile.id::text,
            'is_primary', true
          )
        ) || service_record.team;

        -- Update the service
        UPDATE services
        SET team = new_team
        WHERE id = service_record.id;
      ELSE
        -- Owner exists, ensure is_primary is set to true
        new_team := (
          SELECT jsonb_agg(
            CASE
              WHEN (elem->>'profile_id')::uuid = owner_profile.id THEN
                elem || jsonb_build_object('is_primary', true)
              ELSE
                elem || jsonb_build_object('is_primary', false)
            END
          )
          FROM jsonb_array_elements(service_record.team) AS elem
        );

        -- Update the service
        UPDATE services
        SET team = new_team
        WHERE id = service_record.id;
      END IF;
    END IF;
  END LOOP;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN services.team IS
'JSONB array of team members. Each member has: id, name, imageUrl, profile_id (optional), is_primary (boolean).
The service owner is always included as the first member with is_primary = true and cannot be removed.
Other members are decorative (name + photo) and do not require platform accounts.';
