-- Drop existing function
DROP FUNCTION IF EXISTS create_client;

-- Create simplified client creation function
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
  v_profile_id uuid;
  v_service record;
  v_result json;
BEGIN
  -- Input validation
  IF p_mobile_number IS NULL OR p_mobile_number = '' THEN
    RAISE EXCEPTION 'Número de telemóvel é obrigatório';
  END IF;

  IF NOT (p_mobile_number ~ '^\+?[1-9]\d{1,14}$') THEN
    RAISE EXCEPTION 'Formato de número de telemóvel inválido';
  END IF;

  IF p_full_name IS NULL OR p_full_name = '' THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;

  -- Check if mobile number exists
  IF EXISTS (
    SELECT 1 FROM profiles WHERE mobile_number = p_mobile_number
  ) THEN
    RAISE EXCEPTION 'Número de telemóvel já está em uso';
  END IF;

  -- Check professional
  IF NOT EXISTS (
    SELECT 1 FROM profiles
    WHERE id = p_professional_id AND role = 'professional'
  ) THEN
    RAISE EXCEPTION 'Profissional não encontrado';
  END IF;

  -- Create profile
  v_profile_id := gen_random_uuid();
  
  INSERT INTO profiles (id, full_name, role, mobile_number)
  VALUES (v_profile_id, p_full_name, 'client', p_mobile_number);

  -- Create initial booking if service provided
  IF p_initial_service_id IS NOT NULL THEN
    SELECT * INTO v_service
    FROM services
    WHERE id = p_initial_service_id
    AND professional_id = p_professional_id;

    IF FOUND THEN
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
  END IF;

  -- Return success
  v_result := json_build_object(
    'success', true,
    'client_id', v_profile_id,
    'message', 'Cliente criado com sucesso'
  );

  RETURN v_result;
EXCEPTION WHEN OTHERS THEN
  RAISE EXCEPTION 'Erro ao criar cliente: %', SQLERRM;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_client TO authenticated;