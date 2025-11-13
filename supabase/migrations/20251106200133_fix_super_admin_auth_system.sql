/*
  # Fix Super Admin Authentication System
  
  1. Changes
    - Update check_super_admin_exists() function to return false on error instead of true
    - Add better error handling for when profiles table doesn't exist
    - Ensure function has correct permissions
  
  2. Security
    - Maintains SECURITY DEFINER for proper access control
    - Only returns boolean to prevent information leakage
*/

CREATE OR REPLACE FUNCTION check_super_admin_exists()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  admin_count integer;
BEGIN
  BEGIN
    SELECT COUNT(*) INTO admin_count
    FROM profiles
    WHERE role = 'super_admin';
    
    RETURN admin_count > 0;
  EXCEPTION
    WHEN undefined_table THEN
      RETURN false;
    WHEN OTHERS THEN
      RETURN false;
  END;
END;
$$;
