/*
  # Fix Notification Function for Team Members Without Profile
  
  1. Problem
    - service_team_members table doesn't have profile_id column
    - Team members are decorative (name + photo only, no platform account)
    - Cannot send notifications to team members without accounts
  
  2. Solution
    - Always send notification to the service owner (professional_id)
    - Add metadata indicating which team member is assigned to the booking
    - Service owner can see which team member has the appointment
  
  3. Logic
    - All notifications go to the service owner (professional_id)
    - Metadata includes team_member_id and team_member_name for reference
    - Service owner manages all bookings including those for team members
*/

-- Drop and recreate the notification function with correct logic
CREATE OR REPLACE FUNCTION create_booking_notification()
RETURNS TRIGGER AS $$
DECLARE
  service_info record;
  client_info record;
  team_member_name text;
  notification_message text;
BEGIN
  -- Get service information
  SELECT s.title, s.price INTO service_info
  FROM services s
  WHERE s.id = NEW.service_id;

  -- Get client information
  SELECT p.full_name INTO client_info
  FROM profiles p
  WHERE p.id = NEW.client_id;

  -- Check if this booking is for a team member
  IF NEW.team_member_id IS NOT NULL THEN
    -- Get the team member's name from service_team_members
    SELECT stm.name INTO team_member_name
    FROM service_team_members stm
    WHERE stm.id = NEW.team_member_id;
    
    -- Create message mentioning the team member
    notification_message := format(
      'Novo pedido de reserva de %s para o serviço "%s" com %s em %s',
      COALESCE(client_info.full_name, 'Cliente'),
      COALESCE(service_info.title, 'Serviço'),
      COALESCE(team_member_name, 'membro da equipa'),
      to_char(NEW.start_time, 'DD/MM/YYYY às HH24:MI')
    );
  ELSE
    -- Regular booking for the primary professional
    notification_message := format(
      'Novo pedido de reserva de %s para o serviço "%s" em %s',
      COALESCE(client_info.full_name, 'Cliente'),
      COALESCE(service_info.title, 'Serviço'),
      to_char(NEW.start_time, 'DD/MM/YYYY às HH24:MI')
    );
  END IF;

  -- Create notification for the service owner (professional_id)
  -- All notifications go to the service owner, even for team member bookings
  INSERT INTO notifications (
    user_id,
    title,
    message,
    type,
    booking_id,
    metadata,
    read
  ) VALUES (
    NEW.professional_id,  -- Always notify the service owner
    'Nova Reserva Pendente',
    notification_message,
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
      'team_member_name', team_member_name,
      'is_team_member_booking', NEW.team_member_id IS NOT NULL
    ),
    false
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: The trigger already exists and points to this function
-- trigger_booking_notification calls create_booking_notification()
