/*
  # Fix Security Audit Issues - Part 3: Fix Function Search Paths
  
  ## Summary
  This migration fixes mutable search_path vulnerabilities in database functions.
  Setting an explicit search_path prevents privilege escalation attacks where
  malicious users could create objects in the search_path to hijack function calls.
  
  ## Changes Made
  
  All functions updated with explicit search_path configuration:
  
  1. **Authentication & Admin Functions**
     - get_super_admin_count - Fixed search_path
     - check_super_admin_exists - Fixed search_path
  
  2. **Notification Functions**
     - create_booking_notification - Fixed search_path
     - mark_booking_notification_read - Fixed search_path
  
  3. **Archival Functions**
     - update_archived_at - Fixed search_path
     - cleanup_archived_bookings - Fixed search_path
     - export_archived_bookings_data - Fixed search_path
  
  4. **Contact & Message Functions**
     - update_contact_messages_updated_at - Fixed search_path
     - set_category_tag_from_subject - Fixed search_path
  
  5. **Utility Functions**
     - update_updated_at_column - Fixed search_path
     - sync_team_members - Fixed search_path
     - update_timestamp - Fixed search_path
  
  ## Security Impact
  - Prevents privilege escalation attacks
  - Forces functions to use explicit schema references
  - Recommended best practice by PostgreSQL and Supabase
*/

-- 1. Fix get_super_admin_count
CREATE OR REPLACE FUNCTION get_super_admin_count()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  admin_count integer;
BEGIN
  SELECT COUNT(*) INTO admin_count
  FROM public.profiles
  WHERE role = 'super_admin';
  
  RETURN admin_count;
END;
$$;

-- 2. Fix check_super_admin_exists
CREATE OR REPLACE FUNCTION check_super_admin_exists()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  admin_count integer;
BEGIN
  SELECT COUNT(*) INTO admin_count
  FROM public.profiles
  WHERE role = 'super_admin';
  
  RETURN admin_count > 0;
END;
$$;

-- 3. Fix create_booking_notification
CREATE OR REPLACE FUNCTION create_booking_notification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  service_info record;
  client_info record;
BEGIN
  -- Get service and client information
  SELECT s.title, s.price INTO service_info
  FROM public.services s
  WHERE s.id = NEW.service_id;

  SELECT p.full_name INTO client_info
  FROM public.profiles p
  WHERE p.id = NEW.client_id;

  -- Create notification for the professional
  INSERT INTO public.notifications (
    user_id,
    title,
    message,
    type,
    booking_id,
    metadata,
    read
  ) VALUES (
    NEW.professional_id,
    'Nova Reserva Pendente',
    format('Novo pedido de reserva de %s para o serviço "%s" em %s',
      COALESCE(client_info.full_name, 'Cliente'),
      COALESCE(service_info.title, 'Serviço'),
      to_char(NEW.start_time, 'DD/MM/YYYY às HH24:MI')
    ),
    'booking',
    NEW.id,
    jsonb_build_object(
      'booking_id', NEW.id,
      'service_title', service_info.title,
      'service_price', service_info.price,
      'client_name', client_info.full_name,
      'start_time', NEW.start_time,
      'status', NEW.status
    ),
    false
  );

  RETURN NEW;
END;
$$;

-- 4. Fix mark_booking_notification_read
CREATE OR REPLACE FUNCTION mark_booking_notification_read()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  -- Mark related notification as read when booking is confirmed or cancelled
  IF NEW.status IN ('confirmed', 'cancelled', 'completed') AND OLD.status = 'pending' THEN
    UPDATE public.notifications
    SET read = true
    WHERE booking_id = NEW.id
      AND type = 'booking'
      AND read = false;
  END IF;

  RETURN NEW;
END;
$$;

-- 5. Fix update_archived_at
CREATE OR REPLACE FUNCTION update_archived_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.status IN ('completed', 'cancelled') AND OLD.status NOT IN ('completed', 'cancelled') THEN
    NEW.archived_at = now();
  END IF;
  RETURN NEW;
END;
$$;

-- 6. Fix cleanup_archived_bookings (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'cleanup_archived_bookings'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION cleanup_archived_bookings(days_old integer DEFAULT 365)
      RETURNS integer
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = ''''
      AS $func$
      DECLARE
        deleted_count integer;
        current_user_id uuid;
      BEGIN
        current_user_id := auth.uid();
        
        DELETE FROM public.bookings
        WHERE archived_at IS NOT NULL
          AND archived_at < (now() - (days_old || '' days'')::interval)
          AND professional_id = current_user_id
        RETURNING * INTO deleted_count;
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        
        INSERT INTO public.audit_log (action, performed_by, details, records_affected)
        VALUES (
          ''cleanup_archived_bookings'',
          current_user_id,
          jsonb_build_object(''days_old'', days_old, ''timestamp'', now()),
          deleted_count
        );
        
        RETURN deleted_count;
      END;
      $func$;
    ';
  END IF;
END $$;

-- 7. Fix export_archived_bookings_data (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'export_archived_bookings_data'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION export_archived_bookings_data(start_date timestamptz, end_date timestamptz)
      RETURNS TABLE(
        booking_id uuid,
        service_title text,
        client_name text,
        start_time timestamptz,
        status text,
        archived_at timestamptz
      )
      LANGUAGE plpgsql
      SECURITY DEFINER
      SET search_path = ''''
      AS $func$
      BEGIN
        RETURN QUERY
        SELECT 
          b.id,
          s.title,
          p.full_name,
          b.start_time,
          b.status,
          b.archived_at
        FROM public.bookings b
        JOIN public.services s ON b.service_id = s.id
        JOIN public.profiles p ON b.client_id = p.id
        WHERE b.archived_at IS NOT NULL
          AND b.archived_at BETWEEN start_date AND end_date
          AND b.professional_id = auth.uid();
      END;
      $func$;
    ';
  END IF;
END $$;

-- 8. Fix update_contact_messages_updated_at (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'update_contact_messages_updated_at'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION update_contact_messages_updated_at()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SET search_path = ''''
      AS $func$
      BEGIN
        NEW.updated_at = now();
        RETURN NEW;
      END;
      $func$;
    ';
  END IF;
END $$;

-- 9. Fix set_category_tag_from_subject (if exists)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'set_category_tag_from_subject'
  ) THEN
    EXECUTE '
      CREATE OR REPLACE FUNCTION set_category_tag_from_subject()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SET search_path = ''''
      AS $func$
      BEGIN
        IF NEW.subject ILIKE ''%bug%'' OR NEW.subject ILIKE ''%erro%'' THEN
          NEW.category_tag = ''bug'';
        ELSIF NEW.subject ILIKE ''%feature%'' OR NEW.subject ILIKE ''%funcionalidade%'' THEN
          NEW.category_tag = ''feature'';
        ELSIF NEW.subject ILIKE ''%ajuda%'' OR NEW.subject ILIKE ''%help%'' THEN
          NEW.category_tag = ''support'';
        ELSE
          NEW.category_tag = ''general'';
        END IF;
        RETURN NEW;
      END;
      $func$;
    ';
  END IF;
END $$;

-- 10. Fix update_updated_at_column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 11. Fix sync_team_members (if exists) - Need to drop first
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public' AND p.proname = 'sync_team_members'
  ) THEN
    DROP FUNCTION IF EXISTS sync_team_members();
    
    EXECUTE '
      CREATE FUNCTION sync_team_members()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SET search_path = ''''
      AS $func$
      BEGIN
        IF TG_OP = ''INSERT'' THEN
          INSERT INTO public.service_team_members (service_id, profile_id, is_primary)
          VALUES (NEW.id, NEW.professional_id, true)
          ON CONFLICT (service_id, profile_id) DO NOTHING;
        END IF;
        RETURN NEW;
      END;
      $func$;
    ';
  END IF;
END $$;

-- 12. Fix update_timestamp
CREATE OR REPLACE FUNCTION update_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
