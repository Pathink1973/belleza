/*
  # Overbooking Prevention System
  
  ## Purpose
  Prevents double-booking and overbooking at the database level before data is committed.
  This is a critical safety layer that enforces business rules even if frontend validation fails.
  
  ## Business Rules Enforced
  1. **No Double Booking**: A professional/collaborator cannot have overlapping confirmed bookings
  2. **Cross-Service Prevention**: Checks conflicts across ALL services, not just one
  3. **Capacity Limits**: Ensures slot capacity is not exceeded
  4. **Status-Aware**: Only blocks on 'confirmado' status (allows pending, cancelled, completed)
  
  ## Trigger Behavior
  - Runs BEFORE INSERT or UPDATE on bookings table
  - Checks if professional_id or team_member_id has conflicting confirmed booking
  - Raises descriptive error if conflict detected
  - Allows status changes (e.g., pendente → confirmado) if slot was already reserved
  
  ## Error Messages (Portuguese)
  - "Profissional já possui reserva confirmada neste horário em outro serviço"
  - "Colaborador já possui reserva confirmada neste horário"
  - "Não há vagas disponíveis neste horário - capacidade esgotada"
  
  ## Performance
  - Uses existing indexes on bookings table
  - Only runs when status is 'confirmado'
  - Skips check for cancelled/completed bookings
*/

-- =====================================================
-- Function: Check for booking conflicts before insert/update
-- =====================================================

CREATE OR REPLACE FUNCTION public.prevent_overbooking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_conflict_count integer;
  v_service_title text;
  v_total_capacity integer;
  v_current_bookings integer;
BEGIN
  -- Only enforce for confirmed bookings
  IF NEW.status != 'confirmado' THEN
    RETURN NEW;
  END IF;

  -- Get service title for error messages
  SELECT title INTO v_service_title
  FROM public.services
  WHERE id = NEW.service_id;

  -- =====================================================
  -- CHECK 1: Professional Double-Booking Prevention
  -- =====================================================
  
  IF NEW.team_member_id IS NULL THEN
    -- This is a booking with the primary professional
    -- Check if professional has any other confirmed booking at this time (across ALL services)
    
    SELECT COUNT(*)
    INTO v_conflict_count
    FROM public.bookings b
    WHERE b.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid) -- Exclude self on UPDATE
      AND b.status = 'confirmado'
      AND b.professional_id = NEW.professional_id
      AND b.team_member_id IS NULL
      AND b.start_time < NEW.end_time
      AND b.end_time > NEW.start_time;
    
    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'Profissional já possui reserva confirmada neste horário (% - %). Não é possível estar em dois lugares ao mesmo tempo.',
        NEW.start_time::time,
        NEW.end_time::time
      USING HINT = 'Escolha outro horário ou profissional disponível';
    END IF;
  END IF;

  -- =====================================================
  -- CHECK 2: Team Member (Collaborator) Double-Booking Prevention
  -- =====================================================
  
  IF NEW.team_member_id IS NOT NULL THEN
    -- This is a booking with a team member/collaborator
    -- Check if collaborator has any other confirmed booking at this time (across ALL services)
    
    SELECT COUNT(*)
    INTO v_conflict_count
    FROM public.bookings b
    WHERE b.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid) -- Exclude self on UPDATE
      AND b.status = 'confirmado'
      AND b.team_member_id = NEW.team_member_id
      AND b.start_time < NEW.end_time
      AND b.end_time > NEW.start_time;
    
    IF v_conflict_count > 0 THEN
      RAISE EXCEPTION 'Colaborador já possui reserva confirmada neste horário (% - %). Não é possível estar em dois lugares ao mesmo tempo.',
        NEW.start_time::time,
        NEW.end_time::time
      USING HINT = 'Escolha outro horário ou colaborador disponível';
    END IF;
  END IF;

  -- =====================================================
  -- CHECK 3: Slot Capacity Verification
  -- =====================================================
  
  -- Get total capacity for this service
  SELECT public.get_service_total_capacity(NEW.service_id)
  INTO v_total_capacity;
  
  -- Count confirmed bookings in this exact time slot for this service
  SELECT COUNT(*)
  INTO v_current_bookings
  FROM public.bookings b
  WHERE b.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid) -- Exclude self on UPDATE
    AND b.service_id = NEW.service_id
    AND b.status = 'confirmado'
    AND b.start_time = NEW.start_time
    AND b.end_time = NEW.end_time;
  
  IF v_current_bookings >= v_total_capacity THEN
    RAISE EXCEPTION 'Não há vagas disponíveis para "%" neste horário (% - %). Capacidade: % vagas, Ocupadas: %.',
      v_service_title,
      NEW.start_time::time,
      NEW.end_time::time,
      v_total_capacity,
      v_current_bookings
    USING HINT = 'Este horário está esgotado. Por favor escolha outro horário disponível.';
  END IF;

  -- All checks passed, allow the booking
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.prevent_overbooking IS
  'Trigger function that prevents overbooking by checking:
  1) Professional/collaborator availability across ALL services
  2) Slot capacity limits for the specific service
  Only enforces rules for confirmed bookings.';

-- =====================================================
-- Create Trigger: Run before INSERT or UPDATE
-- =====================================================

DROP TRIGGER IF EXISTS trigger_prevent_overbooking ON public.bookings;

CREATE TRIGGER trigger_prevent_overbooking
  BEFORE INSERT OR UPDATE OF status, start_time, end_time, professional_id, team_member_id, service_id
  ON public.bookings
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_overbooking();

COMMENT ON TRIGGER trigger_prevent_overbooking ON public.bookings IS
  'Prevents double-booking and capacity overflow by validating availability before confirming bookings.
  Runs on INSERT and UPDATE of relevant booking fields.';

-- =====================================================
-- Grant Permissions
-- =====================================================

GRANT EXECUTE ON FUNCTION public.prevent_overbooking TO authenticated;
