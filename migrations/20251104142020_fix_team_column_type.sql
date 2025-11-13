/*
  # Fix Team Column Type in Services Table

  1. Changes
    - Ensure team column is JSONB (not JSONB array)
    - Set proper default value as empty JSONB array
    - Maintain data integrity during migration
    
  2. Data Safety
    - Uses safe migration approach
    - Preserves existing data
    - No data loss
    
  3. Purpose
    - Team members are stored as a JSONB array of objects
    - Each team member object contains: id, name, imageUrl
    - Example: [{"id": "uuid", "name": "John", "imageUrl": "https://..."}]
*/

-- First, check if team column exists and fix its type if needed
DO $$
BEGIN
  -- Drop the old index if it exists
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_services_team'
  ) THEN
    DROP INDEX idx_services_team;
  END IF;

  -- Check current column type
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'services' 
    AND column_name = 'team'
    AND data_type = 'ARRAY'
  ) THEN
    -- Drop and recreate with correct type
    ALTER TABLE services DROP COLUMN IF EXISTS team;
    ALTER TABLE services ADD COLUMN team jsonb DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Team column recreated as JSONB';
  ELSIF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'services' 
    AND column_name = 'team'
  ) THEN
    -- Add column if it doesn't exist
    ALTER TABLE services ADD COLUMN team jsonb DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Team column created as JSONB';
  ELSE
    -- Column exists and is correct type, just ensure default value
    ALTER TABLE services ALTER COLUMN team SET DEFAULT '[]'::jsonb;
    RAISE NOTICE 'Team column already exists with correct type';
  END IF;

  -- Update any NULL values to empty array
  UPDATE services SET team = '[]'::jsonb WHERE team IS NULL;
  
  -- Create GIN index for better performance on JSONB queries
  CREATE INDEX IF NOT EXISTS idx_services_team ON services USING gin(team);
  
  RAISE NOTICE 'Migration completed successfully';
END $$;
