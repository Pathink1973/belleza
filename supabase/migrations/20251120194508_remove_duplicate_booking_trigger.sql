/*
  # Remove Duplicate Booking Validation Trigger

  ## Problem
  There are two triggers validating booking conflicts:
  1. `trigger_prevent_overbooking` - Complete validation with Portuguese error messages
  2. `check_cross_service_conflicts_trigger` - Duplicate validation with English error messages

  The second trigger is causing false positives with the error:
  "Professional is not available at this time (conflict in another service or booking)"

  ## Solution
  Remove the duplicate trigger and keep only the comprehensive one with proper Portuguese messages.

  ## Changes
  1. Drop `check_cross_service_conflicts_trigger` trigger
  2. Drop `prevent_cross_service_double_booking` function
  3. Keep `trigger_prevent_overbooking` which already handles:
     - Professional double-booking prevention (CHECK 1)
     - Team member double-booking prevention (CHECK 2)
     - Slot capacity verification (CHECK 3)
     - Proper Portuguese error messages
     - Better error details with time ranges
*/

-- =====================================================
-- Remove duplicate trigger and function
-- =====================================================

-- Drop the duplicate trigger
DROP TRIGGER IF EXISTS check_cross_service_conflicts_trigger ON public.bookings;

-- Drop the duplicate function
DROP FUNCTION IF EXISTS public.prevent_cross_service_double_booking();

-- =====================================================
-- Verify the main trigger still exists
-- =====================================================

-- This trigger should remain active
-- It's created in migration: 20251118223349_add_overbooking_prevention_trigger.sql
-- Trigger name: trigger_prevent_overbooking
-- Function: prevent_overbooking()

COMMENT ON TRIGGER trigger_prevent_overbooking ON public.bookings IS
  'PRIMARY booking validation trigger. Prevents double-booking and capacity overflow.
  Handles all conflict checks with proper Portuguese error messages.
  Created in: 20251118223349_add_overbooking_prevention_trigger.sql';
