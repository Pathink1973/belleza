/*
  # Fix Notification Trigger for Portuguese Status Values
  
  1. Problem
    - The notification trigger checks for status = 'pending' but bookings now use 'pendente'
    - Team member bookings don't create notifications for the correct professional
    - The status update trigger checks for English status values
  
  2. Changes
    - Drop and recreate trigger to check for 'pendente' instead of 'pending'
    - Update create_booking_notification() to handle team_member_id bookings
    - Fix mark_booking_notification_read() to use Portuguese status values
    - Add logic to notify the correct professional (owner or team member)
  
  3. Notification Logic
    - If booking.team_member_id IS NULL: notify professional_id (service owner)
    - If booking.team_member_id IS NOT NULL: notify the team member's profile_id
    - Fetch team member's profile_id from service_team_members table
  
  4. Security
    - No RLS changes needed (existing policies remain)
    - Functions run with SECURITY DEFINER for proper permissions
*/

-- Drop existing triggers
DROP TRIGGER IF EXISTS trigger_booking_notification ON bookings;
DROP TRIGGER IF EXISTS trigger_booking_status_notification ON bookings;

-- Recreate function to create notification when booking is created
CREATE OR REPLACE FUNCTION create_booking_notification()
RETURNS TRIGGER AS $$
DECLARE
  service_info record;
  client_info record;
  notification_user_id uuid;
  professional_name text;
  team_member_info record;
BEGIN
  -- Get service and client information
  SELECT s.title, s.price INTO service_info
  FROM services s
  WHERE s.id = NEW.service_id;

  SELECT p.full_name INTO client_info
  FROM profiles p
  WHERE p.id = NEW.client_id;

  -- Determine who should receive the notification
  IF NEW.team_member_id IS NOT NULL THEN
    -- Booking is for a team member (collaborator)
    -- Get the team member's profile_id from service_team_members
    SELECT stm.profile_id, p.full_name 
    INTO team_member_info
    FROM service_team_members stm
    JOIN profiles p ON p.id = stm.profile_id
    WHERE stm.id = NEW.team_member_id;
    
    IF team_member_info.profile_id IS NOT NULL THEN
      notification_user_id := team_member_info.profile_id;
      professional_name := team_member_info.full_name;
    ELSE
      -- Fallback: if team member not found, notify service owner
      notification_user_id := NEW.professional_id;
      SELECT full_name INTO professional_name FROM profiles WHERE id = NEW.professional_id;
    END IF;
  ELSE
    -- Booking is for the primary professional (service owner)
    notification_user_id := NEW.professional_id;
    SELECT full_name INTO professional_name FROM profiles WHERE id = NEW.professional_id;
  END IF;

  -- Create notification for the correct professional
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    booking_id,
    metadata,
    read
  ) VALUES (
    notification_user_id,
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
      'status', NEW.status,
      'team_member_id', NEW.team_member_id,
      'is_team_member_booking', NEW.team_member_id IS NOT NULL,
      'professional_name', professional_name
    ),
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate function to mark notification as read when booking status changes
CREATE OR REPLACE FUNCTION mark_booking_notification_read()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark related notification as read when booking is confirmed, cancelled, or completed
  -- Using Portuguese status values
  IF NEW.status IN ('confirmado', 'cancelado', 'concluído') AND OLD.status = 'pendente' THEN
    UPDATE notifications
    SET read = true
    WHERE booking_id = NEW.id
      AND type = 'booking'
      AND read = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger for new bookings (checking for 'pendente' status in Portuguese)
CREATE TRIGGER trigger_booking_notification
  AFTER INSERT ON bookings
  FOR EACH ROW
  WHEN (NEW.status = 'pendente')
  EXECUTE FUNCTION create_booking_notification();

-- Recreate trigger for booking status updates
CREATE TRIGGER trigger_booking_status_notification
  AFTER UPDATE ON bookings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION mark_booking_notification_read();
