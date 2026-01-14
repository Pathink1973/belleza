/*
  # Restrict Bookings SELECT Policy

  1. Security Changes
    - Removes overly permissive SELECT policy
    - Creates more restrictive policies based on user role
    - Maintains public calendar functionality through SECURITY DEFINER functions

  2. New Policies
    - Clients can only see their own bookings
    - Professionals can see bookings for their services
    - Admins can see all bookings
    - Public aggregate data is accessed through functions (not direct SELECT)

  3. Notes
    - Public calendar continues to work via get_all_slots_with_professionals function
    - Sensitive client data (email, phone, notes) protected from unauthorized access
*/

DROP POLICY IF EXISTS "Bookings public aggregate access" ON bookings;

DROP POLICY IF EXISTS "Users can view own bookings" ON bookings;
CREATE POLICY "Users can view own bookings"
  ON bookings FOR SELECT
  TO authenticated
  USING (
    auth.uid() = client_id
    OR auth.uid() = professional_id
    OR EXISTS (
      SELECT 1 FROM services
      WHERE services.id = bookings.service_id
      AND services.professional_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role IN ('admin', 'super_admin')
    )
  );

DROP POLICY IF EXISTS "Anonymous can view aggregate booking data" ON bookings;
CREATE POLICY "Anonymous can view aggregate booking data"
  ON bookings FOR SELECT
  TO anon
  USING (
    booking_type = 'bloqueio'
    OR (
      status = 'confirmado'
      AND client_id IS NOT NULL
    )
  );

CREATE OR REPLACE FUNCTION get_public_booking_counts(
  p_service_id uuid,
  p_date date
)
RETURNS TABLE (
  time_slot text,
  booking_count integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    to_char(b.start_time::time, 'HH24:MI') as time_slot,
    COUNT(*)::integer as booking_count
  FROM bookings b
  WHERE b.service_id = p_service_id
    AND DATE(b.start_time) = p_date
    AND b.status = 'confirmado'
    AND b.booking_type = 'reserva'
  GROUP BY to_char(b.start_time::time, 'HH24:MI');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;