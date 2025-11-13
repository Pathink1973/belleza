/*
  # Disable RLS temporarily for testing with local auth

  1. Changes
    - Disable RLS on all tables temporarily
    - This allows the app to work with local authentication
    - Re-enable with proper policies when ready for production

  2. Security
    - WARNING: This is for development/testing only
    - All tables become publicly accessible
    - Re-enable RLS before going to production
*/

-- Disable RLS on all tables
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS availability DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS blocked_dates DISABLE ROW LEVEL SECURITY;
