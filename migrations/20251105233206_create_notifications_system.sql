/*
  # Create Notifications System

  1. New Tables
    - `notifications`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references profiles) - User who receives the notification
      - `title` (text) - Notification title
      - `message` (text) - Notification message
      - `type` (text) - Type: 'booking', 'review', 'system'
      - `read` (boolean) - Read status
      - `booking_id` (uuid, optional reference to bookings)
      - `metadata` (jsonb) - Additional data
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on notifications table
    - Users can only view their own notifications
    - Only authenticated users can update their own notifications to mark as read

  3. Indexes
    - Index on user_id and read status for fast queries
    - Index on created_at for sorting

  4. Function and Trigger
    - Function to automatically create notification when new booking is created
    - Trigger on bookings table INSERT
*/

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  type text CHECK (type IN ('booking', 'review', 'system')) DEFAULT 'system',
  read boolean DEFAULT false,
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_read 
  ON notifications(user_id, read);

CREATE INDEX IF NOT EXISTS idx_notifications_created_at 
  ON notifications(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_booking 
  ON notifications(booking_id) 
  WHERE booking_id IS NOT NULL;

-- Enable RLS
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can insert notifications"
  ON notifications FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Function to create notification when booking is created
CREATE OR REPLACE FUNCTION create_booking_notification()
RETURNS TRIGGER AS $$
DECLARE
  service_info record;
  client_info record;
BEGIN
  -- Get service and client information
  SELECT s.title, s.price INTO service_info
  FROM services s
  WHERE s.id = NEW.service_id;

  SELECT p.full_name INTO client_info
  FROM profiles p
  WHERE p.id = NEW.client_id;

  -- Create notification for the professional
  INSERT INTO notifications (
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new bookings
DROP TRIGGER IF EXISTS trigger_booking_notification ON bookings;

CREATE TRIGGER trigger_booking_notification
  AFTER INSERT ON bookings
  FOR EACH ROW
  WHEN (NEW.status = 'pending')
  EXECUTE FUNCTION create_booking_notification();

-- Function to mark notification as read when booking status changes
CREATE OR REPLACE FUNCTION mark_booking_notification_read()
RETURNS TRIGGER AS $$
BEGIN
  -- Mark related notification as read when booking is confirmed or cancelled
  IF NEW.status IN ('confirmed', 'cancelled', 'completed') AND OLD.status = 'pending' THEN
    UPDATE notifications
    SET read = true
    WHERE booking_id = NEW.id
      AND type = 'booking'
      AND read = false;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for booking status updates
DROP TRIGGER IF EXISTS trigger_booking_status_notification ON bookings;

CREATE TRIGGER trigger_booking_status_notification
  AFTER UPDATE ON bookings
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION mark_booking_notification_read();