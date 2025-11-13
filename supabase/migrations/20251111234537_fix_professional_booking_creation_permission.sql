/*
  # Fix Professional Booking Creation Permission
  
  ## Summary
  This migration fixes the issue where professionals cannot create bookings on behalf 
  of their clients (internal bookings). The current RLS policy only allows:
  1. Super admins to create any booking
  2. Clients to create their own bookings
  3. Anonymous users to create guest bookings
  
  This is missing the critical use case where professionals need to create internal 
  bookings for their clients (e.g., phone bookings, walk-ins, manual scheduling).
  
  ## Problem
  The "Bookings insert access" policy doesn't include a condition for professionals
  to create bookings for their services. When a professional tries to create an 
  internal booking, they get: "Erro ao criar reserva. Por favor, tente novamente."
  
  ## Solution
  Add a new condition to the "Bookings insert access" policy that allows:
  - Professionals to create bookings for ANY of their services
  - The professional_id in the booking must match the authenticated user OR
  - The professional must own the service being booked
  - The client_id must reference a valid client profile
  
  ## Security Considerations
  - Professionals can only create bookings for their own services
  - Professionals cannot create bookings for services owned by other professionals
  - Client profiles must exist and be valid
  - All other security checks remain in place
  
  ## Changes Made
  1. Drop existing "Bookings insert access" policy
  2. Recreate with additional condition for professionals
  3. Maintain all existing conditions for clients, guests, and super admins
*/

-- Drop the existing INSERT policy for bookings
DROP POLICY IF EXISTS "Bookings insert access" ON bookings;

-- Create the updated INSERT policy with professional booking creation support
CREATE POLICY "Bookings insert access"
  ON bookings FOR INSERT
  WITH CHECK (
    -- Condition 1: Super admins can create any booking
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
    OR
    -- Condition 2: Authenticated clients can create their own bookings
    (
      auth.uid() = client_id AND
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role = 'client'
      )
    )
    OR
    -- Condition 3: Anonymous users can create bookings for valid guest profiles
    (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = client_id 
        AND role = 'client'
        AND is_guest = true
        AND email IS NOT NULL
        AND mobile_number IS NOT NULL
      ) AND
      status = 'pendente'
    )
    OR
    -- Condition 4: Professionals can create bookings for their own services
    -- CRITICAL FIX: This is the new condition that was missing
    (
      -- The authenticated user must be a professional
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() 
        AND role IN ('professional', 'admin', 'super_admin')
      )
      AND
      -- The professional must own the service being booked
      EXISTS (
        SELECT 1 FROM services
        WHERE services.id = service_id
        AND services.professional_id = auth.uid()
      )
      AND
      -- The client must be a valid client profile
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = client_id
        AND role = 'client'
      )
      AND
      -- For internal bookings by professionals, they must match the professional_id
      professional_id = auth.uid()
    )
  );

-- Add a helpful comment to the policy
COMMENT ON POLICY "Bookings insert access" ON bookings IS 
  'Allows: (1) super admins to create any booking, (2) clients to create their own bookings, (3) anonymous users to create guest bookings, (4) professionals to create internal bookings for their services and clients';
