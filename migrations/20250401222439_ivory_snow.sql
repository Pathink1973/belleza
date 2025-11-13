/*
  # Add Team Members to Services Table

  1. Changes
    - Add team column to services table to store team member information
    - Column will store an array of objects with member details
    
  2. Security
    - No additional security needed as table already has RLS enabled
*/

-- Add team column to services table
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS team jsonb[] DEFAULT '{}';

-- Add index for better performance when querying team members
CREATE INDEX IF NOT EXISTS idx_services_team ON services USING gin(team);