-- Refresh materialized view
REFRESH MATERIALIZED VIEW services_with_ratings;

-- Verify and recreate check_booking_availability function
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
      AND id IS DISTINCT FROM p_booking_id
      AND (
        (start_time, end_time) OVERLAPS (p_start_time, p_end_time)
      )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Verify and recreate validate_booking function
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

-- Verify and recreate refresh_services_with_ratings function
CREATE OR REPLACE FUNCTION refresh_services_with_ratings()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY services_with_ratings;
  RETURN NULL;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Verify triggers
DROP TRIGGER IF EXISTS booking_validation_trigger ON bookings;
CREATE TRIGGER booking_validation_trigger
  BEFORE INSERT OR UPDATE ON bookings
  FOR EACH ROW
  EXECUTE FUNCTION validate_booking();

DROP TRIGGER IF EXISTS refresh_services_with_ratings_on_service_change ON services;
CREATE TRIGGER refresh_services_with_ratings_on_service_change
  AFTER INSERT OR UPDATE OR DELETE ON services
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_services_with_ratings();

DROP TRIGGER IF EXISTS refresh_services_with_ratings_on_review_change ON reviews;
CREATE TRIGGER refresh_services_with_ratings_on_review_change
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_services_with_ratings();

DROP TRIGGER IF EXISTS refresh_services_with_ratings_on_booking_change ON bookings;
CREATE TRIGGER refresh_services_with_ratings_on_booking_change
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_services_with_ratings();