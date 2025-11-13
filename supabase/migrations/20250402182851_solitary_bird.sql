/*
  # Fix Materialized View Security

  1. Changes
    - Recreate materialized view with proper security
    - Set proper permissions
    - Update refresh function
    
  2. Security
    - Remove public access
    - Grant only necessary permissions
    - Add security context to functions
*/

-- Drop existing materialized view
DROP MATERIALIZED VIEW IF EXISTS services_with_ratings;

-- Recreate materialized view with proper security
CREATE MATERIALIZED VIEW services_with_ratings AS
SELECT 
  s.*,
  p.full_name as professional_name,
  p.avatar_url as professional_avatar_url,
  COALESCE(AVG(r.rating), 0) as average_rating,
  COUNT(DISTINCT b.client_id) as total_clients,
  COUNT(DISTINCT r.id) as total_reviews
FROM 
  services s
  LEFT JOIN profiles p ON s.professional_id = p.id
  LEFT JOIN reviews r ON s.id = r.service_id
  LEFT JOIN bookings b ON s.id = b.service_id
GROUP BY 
  s.id, p.id
WITH NO DATA;

-- Create indexes on the materialized view
CREATE UNIQUE INDEX idx_services_with_ratings_id ON services_with_ratings(id);
CREATE INDEX idx_services_with_ratings_professional_id ON services_with_ratings(professional_id);

-- Revoke all existing permissions
REVOKE ALL ON services_with_ratings FROM public;
REVOKE ALL ON services_with_ratings FROM anon;
REVOKE ALL ON services_with_ratings FROM authenticated;

-- Grant only necessary permissions
GRANT SELECT ON services_with_ratings TO authenticated;

-- Refresh the materialized view
REFRESH MATERIALIZED VIEW services_with_ratings;

-- Create or replace refresh function with proper security
CREATE OR REPLACE FUNCTION refresh_services_with_ratings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY services_with_ratings;
  RETURN NULL;
END;
$$;

-- Recreate triggers with proper security context
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