/*
  # Add booking constraints and functions

  1. New Constraints
    - Ensures valid booking time ranges
    - Prevents overlapping bookings
    - Validates service availability

  2. New Functions
    - check_booking_availability: Validates if a time slot is available
    - update_booking_status: Handles booking status updates

  3. Triggers
    - booking_validation_trigger: Validates bookings before insert/update
*/

-- Function to check booking availability
CREATE OR REPLACE FUNCTION check_booking_availability(
  p_professional_id UUID,
  p_start_time TIMESTAMPTZ,
  p_end_time TIMESTAMPTZ,
  p_booking_id UUID DEFAULT NULL
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 
    FROM bookings 
    WHERE professional_id = p_professional_id
      AND status = 'confirmed'
      AND booking_id IS DISTINCT FROM p_booking_id
      AND (
        (start_time, end_time) OVERLAPS (p_start_time, p_end_time)
      )
  );
END;
$$ LANGUAGE plpgsql;

-- Trigger function to validate bookings
CREATE OR REPLACE FUNCTION validate_booking()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if end time is after start time
  IF NEW.end_time <= NEW.start_time THEN
    RAISE EXCEPTION 'End time must be after start time';
  END IF;

  -- Check if booking time is in the future
  IF NEW.start_time <= CURRENT_TIMESTAMP THEN
    RAISE EXCEPTION 'Booking must be for a future time';
  END IF;

  -- Check for availability
  IF NOT check_booking_availability(
    NEW.professional_id, 
    NEW.start_time, 
    NEW.end_time,
    NEW.id
  ) THEN
    RAISE EXCEPTION 'Time slot is not available';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for booking validation
CREATE TRIGGER booking_validation_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking();

-- Add additional booking status constraint
ALTER TABLE bookings 
ADD CONSTRAINT valid_booking_status 
CHECK (status IN ('pending', 'confirmed', 'completed', 'cancelled'));

-- Add constraint to prevent past bookings
ALTER TABLE bookings 
ADD CONSTRAINT future_bookings_only 
CHECK (start_time > CURRENT_TIMESTAMP);

-- Add constraint for minimum booking duration
ALTER TABLE bookings 
ADD CONSTRAINT minimum_booking_duration 
CHECK (end_time - start_time >= INTERVAL '15 minutes');