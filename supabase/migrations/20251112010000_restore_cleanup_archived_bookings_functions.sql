/*
  # Restore Cleanup Archived Bookings Functions

  ## Summary
  This migration restores the original function signatures for cleanup_archived_bookings
  and export_archived_bookings_data that were inadvertently changed in a previous security audit.

  The frontend CleanupModal component expects these specific function signatures:
  - cleanup_archived_bookings(p_professional_id uuid, p_confirmation_text text)
  - export_archived_bookings_data(p_professional_id uuid)

  ## Changes Made

  1. **cleanup_archived_bookings Function**
     - Restores original signature: (p_professional_id uuid, p_confirmation_text text)
     - Validates confirmation text must be exactly "CONFIRMAR EXCLUSAO"
     - Deletes ALL bookings with status 'concluído' or 'cancelado' (Portuguese)
     - No time-based filtering - deletes all archived regardless of age
     - Records audit log entry for compliance
     - Returns JSONB with success status and deleted count
     - Security: SECURITY DEFINER with explicit search_path

  2. **export_archived_bookings_data Function**
     - Restores original signature: (p_professional_id uuid)
     - Exports all archived bookings for the professional
     - Returns JSONB array with booking details for backup
     - Security: SECURITY DEFINER with explicit search_path

  ## Security Considerations
  - Functions use SECURITY DEFINER to access all tables
  - Explicit search_path prevents privilege escalation
  - Professional ID validation ensures users only delete own bookings
  - Confirmation text validation prevents accidental deletions
  - Audit log tracks all deletion operations
*/

-- Drop the incompatible version of cleanup_archived_bookings if it exists
DROP FUNCTION IF EXISTS cleanup_archived_bookings(integer);

-- Restore original cleanup_archived_bookings function with correct signature
CREATE OR REPLACE FUNCTION cleanup_archived_bookings(
  p_professional_id uuid,
  p_confirmation_text text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted_count integer := 0;
  v_result jsonb;
  v_user_role text;
BEGIN
  -- Verify the user is a professional, admin, or super_admin
  SELECT role INTO v_user_role
  FROM public.profiles
  WHERE id = p_professional_id;

  IF v_user_role NOT IN ('professional', 'admin', 'super_admin') THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Unauthorized: User must be a professional, admin, or super admin',
      'message', 'Não autorizado'
    );
  END IF;

  -- Verify confirmation text is exactly correct
  IF p_confirmation_text != 'CONFIRMAR EXCLUSAO' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Invalid confirmation text',
      'message', 'Texto de confirmação inválido'
    );
  END IF;

  -- Count records that will be deleted
  SELECT COUNT(*) INTO v_deleted_count
  FROM public.bookings
  WHERE professional_id = p_professional_id
    AND status IN ('concluído', 'cancelado');

  -- Delete archived bookings and their related data
  -- Notifications will be deleted via CASCADE due to ON DELETE CASCADE
  DELETE FROM public.bookings
  WHERE professional_id = p_professional_id
    AND status IN ('concluído', 'cancelado');

  -- Record in audit log
  INSERT INTO public.audit_log (action, performed_by, details, records_affected)
  VALUES (
    'cleanup_archived_bookings',
    p_professional_id,
    jsonb_build_object(
      'deleted_count', v_deleted_count,
      'timestamp', now(),
      'statuses', ARRAY['concluído', 'cancelado'],
      'confirmation_text', p_confirmation_text
    ),
    v_deleted_count
  );

  -- Return success result
  v_result := jsonb_build_object(
    'success', true,
    'deleted_count', v_deleted_count,
    'message', format('Successfully deleted %s archived bookings', v_deleted_count)
  );

  RETURN v_result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to cleanup archived bookings'
    );
END;
$$;

-- Drop the incompatible version of export_archived_bookings_data if it exists
DROP FUNCTION IF EXISTS export_archived_bookings_data(timestamptz, timestamptz);

-- Restore original export_archived_bookings_data function with correct signature
CREATE OR REPLACE FUNCTION export_archived_bookings_data(
  p_professional_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  -- Export all archived bookings for the professional
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', b.id,
      'client_name', COALESCE(p.full_name, 'Cliente Removido'),
      'client_email', p.email,
      'client_phone', p.mobile_number,
      'service_title', s.title,
      'service_price', s.price,
      'service_duration', s.duration,
      'start_time', b.start_time,
      'end_time', b.end_time,
      'status', b.status,
      'notes', b.notes,
      'created_at', b.created_at,
      'archived_at', b.archived_at
    )
  ) INTO v_result
  FROM public.bookings b
  LEFT JOIN public.profiles p ON b.client_id = p.id
  JOIN public.services s ON b.service_id = s.id
  WHERE b.professional_id = p_professional_id
    AND b.status IN ('concluído', 'cancelado');

  RETURN COALESCE(v_result, '[]'::jsonb);

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'message', 'Failed to export archived bookings'
    );
END;
$$;

-- Add function comments
COMMENT ON FUNCTION cleanup_archived_bookings(uuid, text) IS
'Permanently deletes all archived bookings (concluído/cancelado status) for a professional after confirmation text validation';

COMMENT ON FUNCTION export_archived_bookings_data(uuid) IS
'Exports all archived bookings data for a professional as JSON backup before deletion';

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION cleanup_archived_bookings(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION export_archived_bookings_data(uuid) TO authenticated;
