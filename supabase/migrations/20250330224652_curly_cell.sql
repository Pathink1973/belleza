/*
  # Add services view with average ratings

  1. New View
    - `services_with_ratings`
      - Includes all service details
      - Calculates average rating from reviews
      - Joins with professional profiles

  2. Changes
    - Creates a materialized view for better performance
    - Adds indexes for improved query performance
*/

-- Create materialized view for better performance
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

-- Add indexes to improve view performance
CREATE INDEX idx_services_professional_id ON services(professional_id);
CREATE INDEX idx_reviews_service_id ON reviews(service_id);
CREATE INDEX idx_bookings_service_id ON bookings(service_id);

-- Add indexes on the materialized view
CREATE UNIQUE INDEX idx_services_with_ratings_id ON services_with_ratings(id);
CREATE INDEX idx_services_with_ratings_professional_id ON services_with_ratings(professional_id);

-- Grant access to the materialized view
GRANT SELECT ON services_with_ratings TO authenticated, anon;

-- Create function to refresh the materialized view
CREATE OR REPLACE FUNCTION refresh_services_with_ratings()
RETURNS TRIGGER AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY services_with_ratings;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

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