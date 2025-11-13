/*
  # Fix materialized view permissions

  1. Changes
    - Drop and recreate materialized view with proper security settings
    - Update refresh function to use SECURITY DEFINER
    - Recreate triggers with proper permissions
    
  2. Security
    - Set proper ownership and permissions for materialized view
    - Ensure refresh function runs with elevated privileges
*/

-- Drop existing triggers
DROP TRIGGER IF EXISTS refresh_services_with_ratings_on_service_change ON services;
DROP TRIGGER IF EXISTS refresh_services_with_ratings_on_review_change ON reviews;
DROP TRIGGER IF EXISTS refresh_services_with_ratings_on_booking_change ON bookings;

-- Drop existing function
DROP FUNCTION IF EXISTS refresh_services_with_ratings();

-- Drop existing materialized view
DROP MATERIALIZED VIEW IF EXISTS services_with_ratings;

-- Recreate materialized view
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
  s.id, p.id;

-- Create indexes on the materialized view
CREATE UNIQUE INDEX idx_services_with_ratings_id ON services_with_ratings(id);
CREATE INDEX idx_services_with_ratings_professional_id ON services_with_ratings(professional_id);

-- Grant access to the materialized view
GRANT SELECT ON services_with_ratings TO authenticated, anon;

-- Create function to refresh the materialized view with elevated privileges
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

-- Create triggers to refresh the materialized view
CREATE TRIGGER refresh_services_with_ratings_on_service_change
  AFTER INSERT OR UPDATE OR DELETE ON services
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_services_with_ratings();

CREATE TRIGGER refresh_services_with_ratings_on_review_change
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_services_with_ratings();

CREATE TRIGGER refresh_services_with_ratings_on_booking_change
  AFTER INSERT OR UPDATE OR DELETE ON bookings
  FOR EACH STATEMENT
  EXECUTE FUNCTION refresh_services_with_ratings();