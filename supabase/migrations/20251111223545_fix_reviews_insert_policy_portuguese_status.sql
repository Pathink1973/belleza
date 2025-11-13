/*
  # Fix Reviews INSERT Policy for Portuguese Booking Status

  ## Problem
  Clients are unable to submit reviews because the RLS INSERT policy checks for 
  booking status = 'completed' (English), but the database now uses 'concluído' (Portuguese)
  after migration 20251110000000.

  ## Root Cause
  - Booking statuses were translated to Portuguese in November 2025
  - The reviews INSERT policy was recreated in migration 20251111210604
  - However, the policy still references the old English status value 'completed'
  - This causes RLS policy violations when clients try to submit reviews

  ## Solution
  Drop and recreate the reviews INSERT policy with the correct Portuguese status check.

  ## Changes
  1. Drop the existing INSERT policy "Clients can create reviews for their bookings"
  2. Create new INSERT policy with updated status check: 'concluído' instead of 'completed'
  3. Maintain all security requirements:
     - Authentication required (no guest reviews)
     - Only completed bookings can be reviewed
     - Clients can only review their own bookings
     - No time limit on when reviews can be submitted

  ## Security Impact
  - Maintains same security level as before
  - No changes to access permissions
  - Only fixes the language mismatch in the status check

  ## Testing
  After applying this migration, clients should be able to:
  - Submit reviews for their completed ('concluído') bookings
  - Not submit reviews for non-completed bookings
  - Not submit reviews for other clients' bookings
*/

-- ============================================================================
-- Drop the existing INSERT policy with outdated English status check
-- ============================================================================

DROP POLICY IF EXISTS "Clients can create reviews for their bookings" ON reviews;

-- ============================================================================
-- Create new INSERT policy with correct Portuguese status check
-- ============================================================================

CREATE POLICY "Clients can create reviews for their bookings"
  ON reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 
      FROM bookings
      WHERE bookings.id = booking_id
        AND bookings.client_id = auth.uid()
        AND bookings.status = 'concluído'
    )
  );

-- ============================================================================
-- Verification Queries (for testing after migration)
-- ============================================================================

-- Test 1: Verify the policy exists with correct status
-- SELECT policyname, cmd, with_check 
-- FROM pg_policies 
-- WHERE tablename = 'reviews' AND cmd = 'INSERT';

-- Test 2: Verify booking statuses are in Portuguese
-- SELECT DISTINCT status FROM bookings ORDER BY status;

-- Test 3: Check if there are any completed bookings available for review
-- SELECT COUNT(*) as completed_bookings_count 
-- FROM bookings 
-- WHERE status = 'concluído';
