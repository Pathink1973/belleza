/*
  # Fix Booking Status Values to Portuguese

  1. Changes
    - Drop the existing CHECK constraint on bookings.status (allows any value temporarily)
    - Update existing records from English to Portuguese
    - Add new CHECK constraint with Portuguese values
    
  2. Status Mappings
    - 'pending' → 'pendente'
    - 'confirmed' → 'confirmado'
    - 'completed' → 'concluído'
    - 'cancelled' → 'cancelado'

  3. Security
    - No RLS changes needed (existing policies remain)
*/

-- Drop the existing check constraint to allow updates
ALTER TABLE bookings DROP CONSTRAINT IF EXISTS bookings_status_check;

-- Update existing records to Portuguese
UPDATE bookings 
SET status = CASE 
  WHEN status = 'pending' THEN 'pendente'
  WHEN status = 'confirmed' THEN 'confirmado'
  WHEN status = 'completed' THEN 'concluído'
  WHEN status = 'cancelled' THEN 'cancelado'
  ELSE status
END;

-- Add new check constraint with Portuguese values
ALTER TABLE bookings ADD CONSTRAINT bookings_status_check 
  CHECK (status IN ('pendente', 'confirmado', 'concluído', 'cancelado'));
