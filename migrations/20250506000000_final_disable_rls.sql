/*
  # Final RLS Configuration for Development

  1. Changes
    - Drop all existing RLS policies
    - Disable RLS on all tables for development
    - This allows authenticated and unauthenticated users to insert/update/delete

  2. Security
    - WARNING: This is for development/testing only
    - All tables are publicly accessible
    - Re-enable RLS with proper policies before production
*/

-- Drop all existing policies on services table
DO $$
BEGIN
  DROP POLICY IF EXISTS "Services are viewable by everyone" ON services;
  DROP POLICY IF EXISTS "Professionals can insert their services" ON services;
  DROP POLICY IF EXISTS "Professionals can update their services" ON services;
  DROP POLICY IF EXISTS "Professionals can insert their own services" ON services;
  DROP POLICY IF EXISTS "Professionals can update their own services" ON services;
  DROP POLICY IF EXISTS "Professionals can delete their own services" ON services;
  DROP POLICY IF EXISTS "Everyone can view services" ON services;
  DROP POLICY IF EXISTS "Authenticated users can insert services" ON services;
  DROP POLICY IF EXISTS "Users can update own services" ON services;
  DROP POLICY IF EXISTS "Users can delete own services" ON services;
  DROP POLICY IF EXISTS "Public read access for services" ON services;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- Disable RLS on all tables
ALTER TABLE IF EXISTS profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS services DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS bookings DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS availability DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS blocked_dates DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reviews DISABLE ROW LEVEL SECURITY;

-- Grant full access to authenticated and anon roles
GRANT ALL ON profiles TO authenticated, anon;
GRANT ALL ON services TO authenticated, anon;
GRANT ALL ON bookings TO authenticated, anon;
GRANT ALL ON clients TO authenticated, anon;
GRANT ALL ON availability TO authenticated, anon;
GRANT ALL ON blocked_dates TO authenticated, anon;
GRANT ALL ON reviews TO authenticated, anon;
