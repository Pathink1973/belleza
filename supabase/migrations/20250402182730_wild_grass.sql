/*
  # Fix Security Warnings

  1. Changes
    - Add search_path parameter to all functions
    - Fix materialized view security
    - Update function security settings
    
  2. Security
    - Prevent search_path injection
    - Restrict materialized view access
    - Ensure proper function execution context
*/

-- Fix update_client_notes_timestamp function
CREATE OR REPLACE FUNCTION update_client_notes_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix check_booking_availability function
CREATE OR REPLACE FUNCTION check_booking_availability(
  p_professional_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 
    FROM bookings 
    WHERE professional_id = p_professional_id
      AND status = 'confirmed'
      AND id IS DISTINCT FROM p_booking_id
      AND (
        (start_time, end_time) OVERLAPS (p_start_time, p_end_time)
      )
  );
END;
$$;

-- Fix create_client_user function
CREATE OR REPLACE FUNCTION create_client_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, COALESCE((new.raw_user_meta_data->>'role')::text, 'client'));
  RETURN new;
END;
$$;

-- Fix validate_booking function
CREATE OR REPLACE FUNCTION validate_booking()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if end time is after start time
  IF NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'End time must be after start time';
  END IF;

  -- Check if booking time is in the future
  IF NEW.start_time <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'Booking must be for a future time';
  END IF;

  -- Check for availability
  IF NOT check_booking_availability(
    NEW.professional_id, 
    NEW.start_time, 
    NEW.end_time,
    NEW.id
  ) THEN
    RAISE EXCEPTION 'Time slot is not available';
  END IF;

  RETURN NEW;
END;
$$;

-- Fix materialized view security
REVOKE ALL ON services_with_ratings FROM anon;
REVOKE ALL ON services_with_ratings FROM authenticated;

-- Grant specific permissions
GRANT SELECT ON services_with_ratings TO authenticated;

-- Recreate refresh function with proper security
CREATE OR REPLACE FUNCTION refresh_services_with_ratings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY services_with_ratings;
  RETURN NULL;
END;
$$;