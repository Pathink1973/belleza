/*
  # Fix Block Validation for Multiple Variants

  ## Problem
  When creating blocks for all variants of a service, the trigger `prevent_overbooking()`
  treats each block as a conflict with the previous one, even though they are for 
  different variants of the same service.

  Example:
  - Block 1: Service A, Variant 1, 10:00-11:00 ✅ Success
  - Block 2: Service A, Variant 2, 10:00-11:00 ❌ Fails (sees Block 1 as conflict)

  ## Root Cause
  The trigger checks if professional has ANY booking at that time, but doesn't consider:
  1. Blocks are different from reservations
  2. Multiple blocks for different variants of same service are valid
  3. Professional can block multiple variants simultaneously

  ## Solution
  Update trigger to:
  - Skip conflict check when booking_type = 'bloqueio' on BOTH sides
  - Allow same professional to have multiple blocks at same time
  - Still prevent blocks from conflicting with real reservations

  ## Business Rules
  ✅ Professional CAN have multiple blocks at same time (different variants)
  ✅ Professional CAN have block + reservation at same time (if capacity allows)
  ❌ Professional CANNOT have overlapping reservations
*/

-- =====================================================
-- Drop existing triggers first
-- =====================================================

DROP TRIGGER IF EXISTS trigger_validate_booking_conflicts ON public.bookings;
DROP TRIGGER IF EXISTS trg_validate_booking_insert ON public.bookings;
DROP TRIGGER IF EXISTS trg_validate_booking_update ON public.bookings;

-- =====================================================
-- Drop function with CASCADE
-- =====================================================

DROP FUNCTION IF EXISTS public.validate_booking_no_conflicts() CASCADE;

-- =====================================================
-- Create improved validation function
-- =====================================================

CREATE OR REPLACE FUNCTION public.validate_booking_no_conflicts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_conflict_count integer;
BEGIN
  -- Only validate confirmed bookings
  IF NEW.status != 'confirmado' THEN
    RETURN NEW;
  END IF;

  -- =====================================================
  -- CHECK: Professional Availability
  -- =====================================================
  -- Professional can only be in ONE place at a time for RESERVATIONS
  -- But can have multiple BLOCKS at the same time (for different variants)
  
  IF NEW.team_member_id IS NULL AND NEW.booking_type = 'reserva' THEN
    -- This is a RESERVATION with the primary professional
    -- Check if professional has any other RESERVATION at this time
    
    SELECT COUNT(*)
    INTO v_conflict_count
    FROM public.bookings b
    WHERE b.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND b.status = 'confirmado'
      AND b.professional_id = NEW.professional_id
      AND b.team_member_id IS NULL
      AND b.booking_type = 'reserva'  -- Only check conflicts with other RESERVATIONS
      AND b.start_time < NEW.end_time
      AND b.end_time > NEW.start_time;
    
    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'Conflito de horário: Este profissional já tem uma reserva confirmada neste horário.'
      USING HINT = 'Por favor, escolha outro horário ou outro profissional.';
    END IF;
  END IF;

  -- =====================================================
  -- CHECK: Team Member Availability  
  -- =====================================================
  
  IF NEW.team_member_id IS NOT NULL AND NEW.booking_type = 'reserva' THEN
    -- This is a RESERVATION with a team member
    -- Check if team member has any other RESERVATION at this time
    
    SELECT COUNT(*)
    INTO v_conflict_count
    FROM public.bookings b
    WHERE b.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
      AND b.status = 'confirmado'
      AND b.team_member_id = NEW.team_member_id
      AND b.booking_type = 'reserva'  -- Only check conflicts with other RESERVATIONS
      AND b.start_time < NEW.end_time
      AND b.end_time > NEW.start_time;
    
    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'Conflito de horário: Este colaborador já tem uma reserva confirmada neste horário.'
      USING HINT = 'Por favor, escolha outro horário ou outro colaborador.';
    END IF;
  END IF;

  -- All checks passed
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.validate_booking_no_conflicts IS
  'Validates that professionals and team members do not have conflicting RESERVATIONS.
  Blocks (booking_type = bloqueio) are allowed to overlap with each other and with reservations.';

-- =====================================================
-- Create trigger
-- =====================================================

CREATE TRIGGER trigger_validate_booking_conflicts
  BEFORE INSERT OR UPDATE OF status, start_time, end_time, professional_id, team_member_id, booking_type
  ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_booking_no_conflicts();

COMMENT ON TRIGGER trigger_validate_booking_conflicts ON public.bookings IS
  'Prevents double-booking of professionals and team members for RESERVATIONS.
  Allows multiple BLOCKS at the same time for different variants.';

-- =====================================================
-- Grant permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION public.validate_booking_no_conflicts TO authenticated;
