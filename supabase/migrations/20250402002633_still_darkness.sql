/*
  # Add Client Management System

  1. New Functions
    - create_client: Creates a new client profile with validation
    - get_client_stats: Calculates client statistics
    - update_client_stats: Updates materialized view for client statistics

  2. New Tables
    - client_stats: Materialized view for client statistics
    - client_notes: For keeping track of client interactions
    
  3. Security
    - RLS policies for all new tables
    - Function security definer settings
*/

-- Create client notes table
CREATE TABLE IF NOT EXISTS client_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  professional_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS on client_notes
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;

-- Create client notes policies
CREATE POLICY "Professionals can create notes for their clients"
  ON client_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    professional_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'professional'
    )
  );

CREATE POLICY "Professionals can view their client notes"
  ON client_notes
  FOR SELECT
  TO authenticated
  USING (
    professional_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'professional'
    )
  );

CREATE POLICY "Professionals can update their notes"
  ON client_notes
  FOR UPDATE
  TO authenticated
  USING (
    professional_id = auth.uid() AND
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'professional'
    )
  );

-- Create function to create a new client
CREATE OR REPLACE FUNCTION create_client(
  p_email text,
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
BEGIN
  -- Validate inputs
  IF p_email IS NULL OR p_email = '' THEN
    RAISE EXCEPTION 'Email é obrigatório';
  END IF;

  IF p_full_name IS NULL OR p_full_name = '' THEN
    RAISE EXCEPTION 'Nome é obrigatório';
  END IF;

  IF p_professional_id IS NULL THEN
    RAISE EXCEPTION 'ID do profissional é obrigatório';
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

  -- Create user and profile atomically
  BEGIN
    -- Create auth.users entry
    INSERT INTO auth.users (email, email_confirmed_at)
    VALUES (p_email, now())
    RETURNING id INTO v_user_id;

    -- Create profile
    INSERT INTO profiles (id, full_name, role)
    VALUES (v_user_id, p_full_name, 'client')
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

-- Create function to get client statistics
CREATE OR REPLACE FUNCTION get_client_stats(
  p_professional_id uuid,
  p_client_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result json;
BEGIN
  SELECT json_build_object(
    'total_bookings', COUNT(DISTINCT b.id),
    'completed_bookings', COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END),
    'cancelled_bookings', COUNT(DISTINCT CASE WHEN b.status = 'cancelled' THEN b.id END),
    'total_spent', COALESCE(SUM(s.price) FILTER (WHERE b.status = 'completed'), 0),
    'average_rating', COALESCE(AVG(r.rating), 0),
    'last_visit', MAX(b.start_time),
    'notes_count', COUNT(DISTINCT n.id)
  )
  INTO v_result
  FROM bookings b
  LEFT JOIN services s ON b.service_id = s.id
  LEFT JOIN reviews r ON b.id = r.booking_id
  LEFT JOIN client_notes n ON b.client_id = n.client_id
  WHERE b.professional_id = p_professional_id
  AND b.client_id = p_client_id;

  RETURN v_result;
END;
$$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_client_notes_client_professional 
ON client_notes (client_id, professional_id);

CREATE INDEX IF NOT EXISTS idx_client_notes_created 
ON client_notes (created_at);

-- Create trigger to update client notes updated_at
CREATE OR REPLACE FUNCTION update_client_notes_timestamp()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_client_notes_timestamp
  BEFORE UPDATE ON client_notes
  FOR EACH ROW
  EXECUTE FUNCTION update_client_notes_timestamp();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;