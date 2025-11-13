/*
  # Fix Security Audit Issues - Part 5: Remove Unused Indexes
  
  ## Summary
  This migration removes unused indexes that are consuming disk space and
  slowing down write operations without providing any query performance benefits.
  
  ## Indexes Removed
  
  Only removing truly unused indexes that don't benefit common queries:
  
  1. **Services Table**
     - idx_services_team (unused, no queries use this)
  
  2. **Profiles Table** 
     - profiles_business_name_idx (keeping search index instead)
     - profiles_created_at_idx (rarely queried by creation date)
     - profiles_business_phone_idx (phone not commonly searched)
  
  3. **Reviews Table**
     - reviews_rating_idx (rating queries are infrequent)
  
  4. **Client Notes Table**
     - idx_client_notes_created (creation date rarely queried)
  
  5. **Availability Table**
     - availability_day_of_week_idx (covered by composite index)
  
  6. **Blocked Dates Table**
     - blocked_dates_date_idx (date queries are infrequent)
  
  7. **Service Ratings Materialized View**
     - idx_service_ratings_avg (materialized view, rarely queried directly)
  
  8. **Notifications Table**
     - idx_notifications_created_at (covered by composite user_read index)
  
  9. **Contact Messages Table**
     - idx_contact_messages_sender_email (email search is infrequent)
  
  ## Indexes KEPT (even if marked unused)
  
  These indexes support important queries and should be kept:
  - profiles_email_idx (essential for auth lookups)
  - idx_profiles_role (essential for role-based queries)
  - reviews_booking_id_idx (essential for booking-review relationship)
  - bookings_active_idx (essential for professional dashboard)
  - bookings_archived_at_idx (essential for archival queries)
  - audit_log indexes (essential for audit queries)
  - idx_bookings_service_variant_id (essential for variant bookings)
  - idx_services_search (essential for text search)
  - idx_profiles_is_guest (essential for guest user queries)
  - idx_profiles_guest_email (essential for guest validation)
  - idx_profiles_business_address (essential for location search)
  - idx_services_price (essential for price filtering)
  - idx_contact_messages_category (essential for filtering)
  - idx_contact_messages_assigned (essential for admin dashboard)
  - idx_services_featured (essential for featured services)
  - idx_bookings_client_status (essential for client dashboard)
  - idx_bookings_client_start_time (essential for client booking list)
  - idx_bookings_archived (essential for archival system)
  - idx_availability_professional_day (essential for availability lookups)
  - idx_service_professionals_profile_id (essential for team queries)
  - idx_service_team_members_display_order (essential for team ordering)
  - idx_bookings_team_member_id (essential for team member schedules)
  
  ## Performance Impact
  - Reduces index maintenance overhead on writes
  - Frees up disk space
  - Maintains performance for all actual queries
*/

-- Remove unused indexes that don't benefit queries

-- Services table
DROP INDEX IF EXISTS idx_services_team;

-- Profiles table
DROP INDEX IF EXISTS profiles_business_name_idx;
DROP INDEX IF EXISTS profiles_created_at_idx;
DROP INDEX IF EXISTS profiles_business_phone_idx;

-- Reviews table
DROP INDEX IF EXISTS reviews_rating_idx;

-- Client notes table
DROP INDEX IF EXISTS idx_client_notes_created;

-- Availability table
DROP INDEX IF EXISTS availability_day_of_week_idx;

-- Blocked dates table
DROP INDEX IF EXISTS blocked_dates_date_idx;

-- Service ratings materialized view
DROP INDEX IF EXISTS idx_service_ratings_avg;

-- Notifications table (keeping user_read composite index which covers created_at queries)
DROP INDEX IF EXISTS idx_notifications_created_at;

-- Contact messages table
DROP INDEX IF EXISTS idx_contact_messages_sender_email;

-- Note: All other indexes marked as "unused" in the audit are actually important
-- for application functionality and should be kept. They may show as unused if:
-- 1. The application is still in development/testing
-- 2. Those features haven't been used yet
-- 3. The statistics collection period was too short
