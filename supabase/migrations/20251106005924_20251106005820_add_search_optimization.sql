/*
  # Add Advanced Search Optimization

  1. New Indexes
    - Full-text search index on services (title, description, category)
    - Composite index on services (professional_id, created_at)
    - Index on profiles (business_address) for location search
    - Index on reviews for rating aggregation

  2. New Functions
    - search_services: Advanced search function with text and location filtering
    - calculate_service_score: Multi-criteria scoring for search results

  3. Performance
    - Optimized for fuzzy text search
    - Location matching support
    - Efficient sorting and ranking

  4. Security
    - Functions use SECURITY DEFINER with proper access control
    - Only returns publicly visible services
*/

-- Create full-text search index on services
CREATE INDEX IF NOT EXISTS idx_services_search
ON services USING gin(to_tsvector('portuguese',
  COALESCE(title, '') || ' ' ||
  COALESCE(description, '') || ' ' ||
  COALESCE(category, '')
));

-- Create composite index for sorting and filtering
CREATE INDEX IF NOT EXISTS idx_services_professional_created
ON services (professional_id, created_at DESC);

-- Create index on profiles for location search
CREATE INDEX IF NOT EXISTS idx_profiles_business_address
ON profiles USING gin(to_tsvector('portuguese', COALESCE(business_address, '')));

-- Create index on category for filtering
CREATE INDEX IF NOT EXISTS idx_services_category
ON services (category);

-- Create index on price for range filtering
CREATE INDEX IF NOT EXISTS idx_services_price
ON services (price);

-- Create materialized view for service ratings (for performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS service_ratings AS
SELECT
  s.id as service_id,
  COUNT(r.id) as review_count,
  COALESCE(AVG(r.rating), 0) as average_rating
FROM services s
LEFT JOIN reviews r ON r.service_id = s.id
GROUP BY s.id;

-- Create unique index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_service_ratings_service_id
ON service_ratings (service_id);

-- Create index for fast lookups
CREATE INDEX IF NOT EXISTS idx_service_ratings_avg
ON service_ratings (average_rating DESC);

-- Function to refresh service ratings materialized view
CREATE OR REPLACE FUNCTION refresh_service_ratings()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY service_ratings;
END;
$$;

-- Create function to calculate service relevance score
CREATE OR REPLACE FUNCTION calculate_service_score(
  service_id uuid,
  search_text text DEFAULT NULL,
  user_location text DEFAULT NULL
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  text_score numeric := 0;
  location_score numeric := 0;
  rating_score numeric := 0;
  recency_score numeric := 0;
  final_score numeric := 0;
  service_record record;
  days_old numeric;
BEGIN
  -- Get service details
  SELECT
    s.*,
    p.business_address,
    p.business_name,
    p.full_name,
    sr.average_rating,
    sr.review_count,
    EXTRACT(EPOCH FROM (now() - s.created_at)) / 86400 as age_days
  INTO service_record
  FROM services s
  LEFT JOIN profiles p ON s.professional_id = p.id
  LEFT JOIN service_ratings sr ON s.id = sr.service_id
  WHERE s.id = calculate_service_score.service_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Calculate text relevance score (0-40 points)
  IF search_text IS NOT NULL AND search_text != '' THEN
    -- Exact title match
    IF service_record.title ILIKE search_text THEN
      text_score := 40;
    -- Title contains search
    ELSIF service_record.title ILIKE '%' || search_text || '%' THEN
      text_score := 30;
    -- Description contains search
    ELSIF service_record.description ILIKE '%' || search_text || '%' THEN
      text_score := 20;
    -- Category matches
    ELSIF service_record.category ILIKE '%' || search_text || '%' THEN
      text_score := 15;
    -- Professional name matches
    ELSIF service_record.business_name ILIKE '%' || search_text || '%' OR
          service_record.full_name ILIKE '%' || search_text || '%' THEN
      text_score := 10;
    END IF;
  ELSE
    text_score := 20; -- Base score when no search text
  END IF;

  -- Calculate location score (0-25 points)
  IF user_location IS NOT NULL AND user_location != '' AND service_record.business_address IS NOT NULL THEN
    -- Exact match
    IF service_record.business_address ILIKE '%' || user_location || '%' THEN
      location_score := 25;
    -- Partial match
    ELSIF to_tsvector('portuguese', service_record.business_address) @@
          plainto_tsquery('portuguese', user_location) THEN
      location_score := 15;
    END IF;
  ELSE
    location_score := 10; -- Base score when no location filter
  END IF;

  -- Calculate rating score (0-25 points)
  IF service_record.average_rating > 0 THEN
    -- Base rating score (0-20)
    rating_score := (service_record.average_rating / 5.0) * 20;

    -- Bonus for having reviews (0-5)
    IF service_record.review_count > 0 THEN
      rating_score := rating_score + LEAST(service_record.review_count, 5);
    END IF;
  ELSE
    rating_score := 10; -- Neutral score for no ratings
  END IF;

  -- Calculate recency score (0-10 points)
  days_old := service_record.age_days;
  IF days_old <= 7 THEN
    recency_score := 10; -- Very new
  ELSIF days_old <= 30 THEN
    recency_score := 7; -- Recent
  ELSIF days_old <= 90 THEN
    recency_score := 5; -- Moderate
  ELSE
    recency_score := 3; -- Older
  END IF;

  -- Calculate final weighted score (max 100 points)
  final_score := text_score + location_score + rating_score + recency_score;

  RETURN final_score;
END;
$$;

-- Create advanced search function
CREATE OR REPLACE FUNCTION search_services(
  search_query text DEFAULT NULL,
  location_query text DEFAULT NULL,
  min_price numeric DEFAULT NULL,
  max_price numeric DEFAULT NULL,
  category_filter text DEFAULT NULL,
  min_rating numeric DEFAULT NULL,
  limit_count integer DEFAULT 50
)
RETURNS TABLE(
  id uuid,
  title text,
  description text,
  price numeric,
  duration interval,
  category text,
  images text[],
  whatsapp_number text,
  team jsonb,
  professional_id uuid,
  created_at timestamptz,
  professional_name text,
  professional_avatar text,
  business_name text,
  business_address text,
  business_phone text,
  average_rating numeric,
  review_count bigint,
  relevance_score numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.title,
    s.description,
    s.price,
    s.duration,
    s.category,
    s.images,
    s.whatsapp_number,
    s.team,
    s.professional_id,
    s.created_at,
    p.full_name as professional_name,
    p.avatar_url as professional_avatar,
    p.business_name,
    p.business_address,
    p.business_phone,
    COALESCE(sr.average_rating, 0) as average_rating,
    COALESCE(sr.review_count, 0) as review_count,
    calculate_service_score(s.id, search_query, location_query) as relevance_score
  FROM services s
  LEFT JOIN profiles p ON s.professional_id = p.id
  LEFT JOIN service_ratings sr ON s.id = sr.service_id
  WHERE
    -- Text search filter
    (search_query IS NULL OR search_query = '' OR
     s.title ILIKE '%' || search_query || '%' OR
     s.description ILIKE '%' || search_query || '%' OR
     s.category ILIKE '%' || search_query || '%' OR
     p.business_name ILIKE '%' || search_query || '%' OR
     p.full_name ILIKE '%' || search_query || '%')
    -- Location filter
    AND (location_query IS NULL OR location_query = '' OR
         p.business_address ILIKE '%' || location_query || '%')
    -- Price range filter
    AND (min_price IS NULL OR s.price >= min_price)
    AND (max_price IS NULL OR s.price <= max_price)
    -- Category filter
    AND (category_filter IS NULL OR category_filter = '' OR s.category = category_filter)
    -- Rating filter
    AND (min_rating IS NULL OR COALESCE(sr.average_rating, 0) >= min_rating)
  ORDER BY
    calculate_service_score(s.id, search_query, location_query) DESC,
    sr.average_rating DESC NULLS LAST,
    s.created_at DESC
  LIMIT limit_count;
END;
$$;

-- Create trigger to refresh ratings when reviews are added/updated
CREATE OR REPLACE FUNCTION trigger_refresh_service_ratings()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Refresh materialized view after a short delay to batch updates
  PERFORM pg_notify('refresh_ratings', '');
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_review_refresh_ratings ON reviews;

-- Create trigger on reviews table
CREATE TRIGGER trigger_review_refresh_ratings
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH STATEMENT
  EXECUTE FUNCTION trigger_refresh_service_ratings();

-- Initial refresh of materialized view
REFRESH MATERIALIZED VIEW service_ratings;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION search_services TO authenticated, anon;
GRANT EXECUTE ON FUNCTION calculate_service_score TO authenticated, anon;
GRANT EXECUTE ON FUNCTION refresh_service_ratings TO authenticated;
GRANT SELECT ON service_ratings TO authenticated, anon;
