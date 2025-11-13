/*
  # Fix Profile Creation and RLS Policies

  1. Changes
    - Update profile creation policy to handle client creation by professionals
    - Add trigger to handle user creation for client profiles
    - Fix foreign key constraint issues
    
  2. Security
    - Maintain RLS policies
    - Ensure proper authorization checks
*/

-- Create function to handle client user creation
CREATE OR REPLACE FUNCTION create_client_user()
RETURNS trigger AS $$
DECLARE
  v_user_id uuid;
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
      crypt(gen_random_uuid()::text, gen_salt('bf')),
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
      encode(gen_random_bytes(32), 'hex')
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for client user creation
DROP TRIGGER IF EXISTS create_client_user_trigger ON profiles;
CREATE TRIGGER create_client_user_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_client_user();

-- Update profile creation policy
DROP POLICY IF EXISTS "Enable profile creation during signup" ON profiles;
CREATE POLICY "Enable profile creation during signup"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (
  -- Users can create their own profile during signup
  auth.uid() = id
  OR
  -- Professionals can create client profiles
  (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'professional'
    )
    AND role = 'client'
  )
);

-- Ensure other policies exist
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

-- Grant necessary permissions
GRANT ALL ON profiles TO authenticated;