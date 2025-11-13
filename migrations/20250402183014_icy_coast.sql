/*
  # Fix Professional Clients Stats View Security

  1. Changes
    - Remove SECURITY DEFINER from view
    - Implement proper RLS through view definition
    - Ensure data access is properly restricted
    
  2. Security
    - Use RLS policies instead of SECURITY DEFINER
    - Restrict access based on professional role
    - Maintain data isolation between professionals
*/

-- Drop existing view
DROP VIEW IF EXISTS professional_clients_stats;

-- Create view with proper security
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
SELECT cs.*
FROM client_stats cs
WHERE 
  -- Only show data to the professional who owns it
  (cs.professional_id = auth.uid() AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'professional'
  ))
  OR
  -- Or to admins
  EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'admin'
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_bookings_professional_client 
ON bookings (professional_id, client_id);

CREATE INDEX IF NOT EXISTS idx_bookings_status 
ON bookings (status);

CREATE INDEX IF NOT EXISTS idx_reviews_booking 
ON reviews (booking_id);

-- Grant necessary permissions
GRANT SELECT ON professional_clients_stats TO authenticated;

-- Add comment explaining security model
COMMENT ON VIEW professional_clients_stats IS 'View for professional client statistics. Access controlled through RLS policies.';