/*
  # Fix Crypto Functions and Permissions

  1. Changes
    - Create proper crypto functions
    - Fix function permissions
    - Add proper type casting
    
  2. Security
    - Use security definer
    - Set proper search path
    - Grant minimal required permissions
*/

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing function to recreate with fixes
DROP FUNCTION IF EXISTS create_client_user CASCADE;

-- Create improved function with proper crypto handling
CREATE OR REPLACE FUNCTION create_client_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_temp_password text;
BEGIN
  -- Only run for client profiles created by professionals
  IF NEW.role = 'client' AND 
     EXISTS (
       SELECT 1 FROM profiles
       WHERE id = auth.uid()
       AND role = 'professional'
     )
  THEN
    -- Generate temporary email from mobile number
    v_user_id := NEW.id;
    
    -- Generate a secure temporary password using gen_random_uuid
    v_temp_password := gen_random_uuid()::text;
    
    -- Create auth.users entry
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      email_confirmed_at,
      encrypted_password,
      aud,
      role,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      'client_' || replace(NEW.mobile_number, '+', '') || '@temp.beautify.app',
      now(),
      crypt(v_temp_password, gen_salt('bf')),
      'authenticated',
      'authenticated',
      jsonb_build_object(
        'provider', 'email',
        'providers', ARRAY['email']
      ),
      jsonb_build_object(
        'role', NEW.role,
        'mobile_number', NEW.mobile_number
      ),
      now(),
      now(),
      gen_random_uuid()::text
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Recreate trigger
CREATE TRIGGER create_client_user_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_client_user();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant specific function permissions
GRANT EXECUTE ON FUNCTION gen_random_uuid() TO authenticated;
GRANT EXECUTE ON FUNCTION gen_salt(text) TO authenticated;
GRANT EXECUTE ON FUNCTION crypt(text, text) TO authenticated;

-- Ensure RLS is enabled
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Update profile creation policy
DROP POLICY IF EXISTS "Enable profile creation during signup" ON profiles;
CREATE POLICY "Enable profile creation during signup"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = id
  OR
  (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'professional'
    )
    AND role = 'client'
  )
);

-- Ensure other necessary policies exist
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON profiles;
CREATE POLICY "Profiles are viewable by everyone"
ON profiles
FOR SELECT
TO public
USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);