/*
  # Create Professional Clients Statistics View

  1. Changes
    - Create a secure view for client statistics
    - Add performance indexes
    - Set proper permissions
    - Implement row-level security through the view's WHERE clause
    
  2. Security
    - Filter data based on authenticated user
    - Only show client data to the professional who owns it
    - Allow admin access to all data
*/

-- Drop existing view if it exists
DROP VIEW IF EXISTS professional_clients_stats;

-- Create secure view for client statistics
CREATE VIEW professional_clients_stats AS
WITH client_stats AS (
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
  GROUP BY 
    b.professional_id,
    b.client_id,
    p.full_name,
    p.avatar_url
)
SELECT *
FROM client_stats cs
WHERE 
  -- Only show data to the professional who owns it
  (cs.professional_id = auth.uid() AND EXISTS (
    SELECT 1 
    FROM profiles prof 
    WHERE prof.id = cs.professional_id 
    AND prof.role = 'professional'
  ))
  OR
  -- Or to admins
  EXISTS (
    SELECT 1 
    FROM profiles admin 
    WHERE admin.id = auth.uid() 
    AND admin.role = 'admin'
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bookings_professional_client 
ON bookings (professional_id, client_id);

CREATE INDEX IF NOT EXISTS idx_bookings_status 
ON bookings (status);

CREATE INDEX IF NOT EXISTS idx_reviews_booking 
ON reviews (booking_id);

-- Grant access to authenticated users
GRANT SELECT ON professional_clients_stats TO authenticated;