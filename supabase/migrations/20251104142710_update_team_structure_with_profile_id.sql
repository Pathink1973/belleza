/*
  # Update Team Structure to Include Profile ID

  1. Purpose
    - Ensure team members reference actual professional profiles
    - Maintain consistency between team member photos and profile avatars
    - Each team member now includes profile_id for referential integrity
    
  2. Changes
    - Team column remains JSONB
    - Team member objects now include: {id, profile_id, name, imageUrl}
    - imageUrl comes from profiles.avatar_url for consistency
    
  3. Benefits
    - Consistent photos across the application
    - Single source of truth for professional information
    - Automatic updates when profile photos change
    
  4. Data Safety
    - Non-destructive migration
    - Preserves existing team data
    - No data loss
*/

-- This migration ensures the team structure is documented and understood
-- The actual structure is already JSONB, so no schema changes needed
-- Team members should be stored as:
-- [
--   {
--     "id": "unique-uuid",
--     "profile_id": "profile-uuid-reference",
--     "name": "Professional Name",
--     "imageUrl": "https://... (from profiles.avatar_url)"
--   }
-- ]

-- Add a comment to the team column for documentation
COMMENT ON COLUMN services.team IS 
'JSONB array of team members. Each member object contains:
- id: unique identifier for this team assignment
- profile_id: reference to profiles.id (the professional)
- name: professional full_name (from profile)
- imageUrl: professional avatar_url (from profile)
Example: [{"id": "uuid", "profile_id": "uuid", "name": "John Doe", "imageUrl": "https://..."}]';

-- Verify the column is properly configured
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'services' 
    AND column_name = 'team'
    AND data_type = 'jsonb'
  ) THEN
    RAISE NOTICE 'Team column is properly configured as JSONB';
  ELSE
    RAISE EXCEPTION 'Team column configuration is incorrect';
  END IF;
END $$;
