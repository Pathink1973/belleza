-- Enable pgcrypto extension in the public schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop existing function to recreate with fixes
DROP FUNCTION IF EXISTS create_client_user CASCADE;

-- Create improved function with proper password hashing
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
    
    -- Generate a secure temporary password
    v_temp_password := encode(gen_random_bytes(32), 'hex');
    
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
      -- Use crypt directly with a generated salt
      crypt(v_temp_password, crypt('', 'bf')),
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
$$;

-- Recreate trigger
CREATE TRIGGER create_client_user_trigger
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_client_user();

-- Grant necessary permissions
GRANT ALL ON FUNCTION crypt(text, text) TO authenticated;
GRANT ALL ON FUNCTION gen_random_bytes(integer) TO authenticated;