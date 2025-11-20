/*
  # Remove Old Overbooking Trigger

  ## Problem
  There are TWO triggers validating bookings:
  1. trigger_prevent_overbooking (old) - Too restrictive, blocks multiple variant blocks
  2. trigger_validate_booking_conflicts (new) - Correct behavior, allows variant blocks

  ## Solution
  Remove the old trigger and keep only the new improved one.

  ## What Gets Removed
  - trigger_prevent_overbooking (trigger)
  - prevent_overbooking() (function)

  ## What Remains Active
  - trigger_validate_booking_conflicts (trigger) ✅
  - validate_booking_no_conflicts() (function) ✅
*/

-- Remove old trigger
DROP TRIGGER IF EXISTS trigger_prevent_overbooking ON public.bookings;

-- Remove old function
DROP FUNCTION IF EXISTS public.prevent_overbooking() CASCADE;

-- Verify new trigger exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.triggers
    WHERE trigger_name = 'trigger_validate_booking_conflicts'
      AND event_object_table = 'bookings'
  ) THEN
    RAISE EXCEPTION 'CRITICAL: New trigger trigger_validate_booking_conflicts does not exist!';
  END IF;
END $$;

COMMENT ON TRIGGER trigger_validate_booking_conflicts ON public.bookings IS
  'PRIMARY booking validation trigger (replaces trigger_prevent_overbooking).
  Prevents double-booking for RESERVATIONS while allowing multiple BLOCKS.';
