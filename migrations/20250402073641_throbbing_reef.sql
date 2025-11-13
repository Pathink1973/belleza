-- Enable the pgcrypto extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;

-- Grant usage to authenticated users
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS create_client;

-- Create improved create_client function
CREATE OR REPLACE FUNCTION create_client(
  p_mobile_number text,
  p_full_name text,
  p_professional_id uuid,
  p_initial_service_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_service record;
  v_result json;
  v_temp_password text;
BEGIN
  -- Input validation
  IF p_mobile_number IS NULL OR p_mobile_number = '' THEN
    RAISE EXCEPTION 'Número de telemóvel é obrigatório';
  END IF;

  -- Validate mobile number format
  IF NOT (p_mobile_number ~ '^\+?[1-9]\d{1,14}$') THEN
    RAISE EXCEPTION 'Formato de número de telemóvel inválido';
  END IF;

  IF p_full_name IS NULL OR p_full_name = '' THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;

  IF p_professional_id IS NULL THEN
    RAISE EXCEPTION 'ID do profissional é obrigatório';
  END IF;

  -- Check if mobile number already exists
  IF EXISTS (
    SELECT 1 FROM profiles WHERE mobile_number = p_mobile_number
  ) THEN
    RAISE EXCEPTION 'Número de telemóvel já está em uso';
  END IF;

  -- Check if professional exists and is a professional
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_professional_id
    AND role = 'professional'
  ) THEN
    RAISE EXCEPTION 'Profissional não encontrado ou não autorizado';
  END IF;

  -- Check if service exists if provided
  IF p_initial_service_id IS NOT NULL THEN
    SELECT * INTO v_service
    FROM services
    WHERE id = p_initial_service_id
    AND professional_id = p_professional_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Serviço não encontrado';
    END IF;
  END IF;

  -- Start transaction
  BEGIN
    -- Generate new UUID for user
    v_user_id := gen_random_uuid();
    
    -- Generate a temporary password
    v_temp_password := encode(gen_random_bytes(16), 'hex');

    -- Create auth.users entry with generated UUID
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
      'client_' || replace(p_mobile_number, '+', '') || '@temp.beautify.app',
      now(),
      crypt(v_temp_password, gen_salt('bf')),
      'authenticated',
      'authenticated',
      '{"provider":"mobile","providers":["mobile"]}',
      jsonb_build_object(
        'role', 'client',
        'mobile_number', p_mobile_number
      ),
      now(),
      now(),
      encode(gen_random_bytes(16), 'hex')
    );

    -- Create profile
    INSERT INTO profiles (id, full_name, role, mobile_number)
    VALUES (v_user_id, p_full_name, 'client', p_mobile_number)
    RETURNING id INTO v_profile_id;

    -- Create initial booking if service was provided
    IF v_service.id IS NOT NULL THEN
      INSERT INTO bookings (
        client_id,
        professional_id,
        service_id,
        start_time,
        end_time,
        status
      )
      VALUES (
        v_profile_id,
        p_professional_id,
        v_service.id,
        now() + interval '1 day',
        now() + interval '1 day' + v_service.duration,
        'pending'
      );
    END IF;

    -- Return success result
    v_result := json_build_object(
      'success', true,
      'client_id', v_profile_id,
      'message', 'Cliente criado com sucesso'
    );

    RETURN v_result;

  EXCEPTION WHEN OTHERS THEN
    -- Cleanup on error
    IF v_user_id IS NOT NULL THEN
      DELETE FROM auth.users WHERE id = v_user_id;
    END IF;
    
    RAISE EXCEPTION 'Erro ao criar cliente: %', SQLERRM;
  END;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_client TO authenticated;