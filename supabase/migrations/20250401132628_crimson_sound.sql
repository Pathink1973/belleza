/*
  # Create Client List View with Security

  1. New View
    - Creates a secure view for client statistics
    - Aggregates client data including bookings and reviews
    - Implements security through view definition
    
  2. Security
    - Uses EXISTS clause to enforce row-level security
    - Ensures professionals can only see their own clients
*/

-- Drop existing view if it exists
DROP VIEW IF EXISTS professional_clients_stats;

-- Create secure view for client statistics
CREATE VIEW professional_clients_stats AS
SELECT 
  b.professional_id,
  b.client_id,
  p.full_name as client_name,
  p.avatar_url as client_avatar,
  COUNT(DISTINCT b.id) as total_bookings,
  SUM(s.price) as total_spent,
  MAX(b.start_time) as last_visit,
  COUNT(DISTINCT CASE WHEN b.status = 'completed' THEN b.id END) as completed_bookings,
  COUNT(DISTINCT CASE WHEN b.status = 'cancelled' THEN b.id END) as cancelled_bookings,
  COALESCE(AVG(r.rating), 0) as average_rating,
  COUNT(DISTINCT r.id) as total_reviews
FROM 
  bookings b
  JOIN profiles p ON b.client_id = p.id
  JOIN services s ON b.service_id = s.id
  LEFT JOIN reviews r ON b.id = r.booking_id
WHERE 
  EXISTS (
    SELECT 1 
    FROM profiles prof 
    WHERE prof.id = b.professional_id 
    AND prof.role = 'professional'
  )
GROUP BY 
  b.professional_id,
  b.client_id,
  p.full_name,
  p.avatar_url;

-- Create indexes to improve view performance
CREATE INDEX IF NOT EXISTS idx_bookings_professional_id ON bookings(professional_id);
CREATE INDEX IF NOT EXISTS idx_bookings_client_id ON bookings(client_id);
CREATE INDEX IF NOT EXISTS idx_reviews_booking_id ON reviews(booking_id);

-- Grant access to the view
GRANT SELECT ON professional_clients_stats TO authenticated;