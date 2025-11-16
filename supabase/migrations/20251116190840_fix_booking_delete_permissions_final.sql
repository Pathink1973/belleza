/*
  # Fix Booking Delete Permissions - FINAL
  
  ## Changes
  
  1. Remove all conflicting DELETE policies
  2. Create ONE clear and simple DELETE policy that allows:
     - Super admins can delete any booking
     - Professionals can delete bookings for their own services
     - Clients can delete their own cancelled/archived bookings
  
  ## Security
  
  - Maintains data protection
  - Allows legitimate deletions
  - Simple and clear logic
*/

-- Drop all existing DELETE policies
DROP POLICY IF EXISTS "Bookings delete access" ON bookings;
DROP POLICY IF EXISTS "Clients can delete their archived bookings" ON bookings;
DROP POLICY IF EXISTS "Professionals can delete their own bookings" ON bookings;

-- Create ONE unified DELETE policy with clear logic
CREATE POLICY "Allow booking deletions"
  ON bookings
  FOR DELETE
  TO authenticated
  USING (
    -- Super admins can delete any booking
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
    OR
    -- Professionals can delete bookings for their services
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = bookings.service_id
        AND services.professional_id = auth.uid()
    )
    OR
    -- Professionals assigned to the booking can delete it
    auth.uid() = bookings.professional_id
    OR
    -- Clients can delete their own cancelled bookings
    (
      auth.uid() = bookings.client_id
      AND bookings.status = 'cancelado'
    )
  );
