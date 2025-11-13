/*
  # Fix Bookings UPDATE Policy - Use Portuguese Status Values
  
  ## Summary
  This migration fixes the "Bookings update access" RLS policy to use Portuguese
  status values instead of English ones. The application uses Portuguese status
  values ('pendente', 'confirmado', 'concluído', 'cancelado'), but the UPDATE
  policy was checking for English values ('pending', 'confirmed').
  
  ## Problem
  The current "Bookings update access" policy has this condition:
  ```
  (auth.uid() = client_id AND status IN ('pending', 'confirmed'))
  ```
  
  But the actual status values in the database are:
  - 'pendente' (not 'pending')
  - 'confirmado' (not 'confirmed')
  - 'concluído' (not 'completed')
  - 'cancelado' (not 'cancelled')
  
  This means clients cannot update their bookings because the status check always
  fails, even when the booking is in 'pendente' or 'confirmado' status.
  
  ## Solution
  Update the policy to use the correct Portuguese status values.
  
  ## Security Considerations
  - No change to security logic, only fixing the status value language
  - Clients can still only update their pending or confirmed bookings
  - Professionals can still update all their bookings regardless of status
  - Super admins maintain full access
  
  ## Changes Made
  1. Drop existing "Bookings update access" policy
  2. Recreate with Portuguese status values: 'pendente', 'confirmado'
  3. Maintain all other security conditions unchanged
*/

-- Drop the existing UPDATE policy for bookings
DROP POLICY IF EXISTS "Bookings update access" ON bookings;

-- Create the updated UPDATE policy with Portuguese status values
CREATE POLICY "Bookings update access"
  ON bookings FOR UPDATE
  USING (
    -- Condition 1: Super admins can update all bookings
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
    OR
    -- Condition 2: Professionals can update their bookings
    auth.uid() = professional_id
    OR
    -- Condition 3: Clients can update their own pending or confirmed bookings
    -- CRITICAL FIX: Changed from 'pending', 'confirmed' to 'pendente', 'confirmado'
    (
      auth.uid() = client_id 
      AND status IN ('pendente', 'confirmado')
    )
  )
  WITH CHECK (
    -- Same conditions for WITH CHECK
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'super_admin'
    )
    OR
    auth.uid() = professional_id
    OR
    (
      auth.uid() = client_id 
      AND status IN ('pendente', 'confirmado')
    )
  );

-- Add a helpful comment to the policy
COMMENT ON POLICY "Bookings update access" ON bookings IS 
  'Allows: (1) super admins to update all bookings, (2) professionals to update their bookings, (3) clients to update their pending or confirmed bookings (using Portuguese status values)';
