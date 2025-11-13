/*
  # Fix Security Audit Issues - Part 1: Indexes and Critical RLS
  
  ## Summary
  This migration addresses critical security and performance issues identified 
  in the Supabase Security Advisor audit.
  
  ## Changes Made
  
  1. **Missing Foreign Key Index**
     - Add index on client_notes.professional_id for better query performance
  
  2. **Remove Duplicate Indexes**
     - Drop duplicate index idx_profiles_role (keeping profiles_role_idx)
     - Drop duplicate index idx_reviews_booking (keeping reviews_booking_id_idx)
     - Drop duplicate index idx_services_category (keeping services_category_idx)
  
  3. **Enable RLS on All Public Tables (CRITICAL)**
     - Enable RLS on: clients, client_notes, bookings, profiles, services
     - Enable RLS on: reviews, availability, blocked_dates, calendar_notes
     - This fixes the most critical security vulnerability
  
  ## Security Impact
  - Restores Row Level Security protection on all tables
  - Existing RLS policies will now be enforced
  - Prevents unauthorized access to sensitive data
  
  ## Performance Impact
  - Adds missing index for foreign key lookups
  - Removes duplicate indexes to improve write performance
*/

-- 1. Add missing foreign key index on client_notes
CREATE INDEX IF NOT EXISTS idx_client_notes_professional_id 
  ON client_notes(professional_id);

-- 2. Remove duplicate indexes
DROP INDEX IF EXISTS idx_profiles_role;
DROP INDEX IF EXISTS idx_reviews_booking;
DROP INDEX IF EXISTS idx_services_category;

-- 3. Enable RLS on all public tables (CRITICAL SECURITY FIX)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocked_dates ENABLE ROW LEVEL SECURITY;
ALTER TABLE calendar_notes ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for tables that don't have them yet

-- Drop existing policies if they exist to avoid conflicts
DO $$
BEGIN
  DROP POLICY IF EXISTS "Professionals can view their own clients" ON clients;
  DROP POLICY IF EXISTS "Professionals can insert their own clients" ON clients;
  DROP POLICY IF EXISTS "Professionals can update their own clients" ON clients;
  DROP POLICY IF EXISTS "Professionals can delete their own clients" ON clients;
  DROP POLICY IF EXISTS "Professionals can view their own client notes" ON client_notes;
  DROP POLICY IF EXISTS "Professionals can insert their own client notes" ON client_notes;
  DROP POLICY IF EXISTS "Professionals can update their own client notes" ON client_notes;
  DROP POLICY IF EXISTS "Professionals can delete their own client notes" ON client_notes;
  DROP POLICY IF EXISTS "Professionals can manage their own availability" ON availability;
  DROP POLICY IF EXISTS "Public can view professional availability" ON availability;
  DROP POLICY IF EXISTS "Professionals can manage their blocked dates" ON blocked_dates;
  DROP POLICY IF EXISTS "Public can view blocked dates" ON blocked_dates;
  DROP POLICY IF EXISTS "Professionals can manage their calendar notes" ON calendar_notes;
  DROP POLICY IF EXISTS "Public can view all reviews" ON reviews;
  DROP POLICY IF EXISTS "Clients can create reviews for their bookings" ON reviews;
  DROP POLICY IF EXISTS "Public can view all services" ON services;
  DROP POLICY IF EXISTS "Professionals can manage their own services" ON services;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

-- clients table policies
CREATE POLICY "Professionals can view their own clients"
  ON clients
  FOR SELECT
  TO authenticated
  USING (professional_id = auth.uid());

CREATE POLICY "Professionals can insert their own clients"
  ON clients
  FOR INSERT
  TO authenticated
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Professionals can update their own clients"
  ON clients
  FOR UPDATE
  TO authenticated
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Professionals can delete their own clients"
  ON clients
  FOR DELETE
  TO authenticated
  USING (professional_id = auth.uid());

-- client_notes table policies
CREATE POLICY "Professionals can view their own client notes"
  ON client_notes
  FOR SELECT
  TO authenticated
  USING (professional_id = auth.uid());

CREATE POLICY "Professionals can insert their own client notes"
  ON client_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Professionals can update their own client notes"
  ON client_notes
  FOR UPDATE
  TO authenticated
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Professionals can delete their own client notes"
  ON client_notes
  FOR DELETE
  TO authenticated
  USING (professional_id = auth.uid());

-- availability table policies
CREATE POLICY "Professionals can manage their own availability"
  ON availability
  FOR ALL
  TO authenticated
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Public can view professional availability"
  ON availability
  FOR SELECT
  USING (true);

-- blocked_dates table policies
CREATE POLICY "Professionals can manage their blocked dates"
  ON blocked_dates
  FOR ALL
  TO authenticated
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

CREATE POLICY "Public can view blocked dates"
  ON blocked_dates
  FOR SELECT
  USING (true);

-- calendar_notes table policies
CREATE POLICY "Professionals can manage their calendar notes"
  ON calendar_notes
  FOR ALL
  TO authenticated
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid());

-- reviews table policies (add missing ones)
CREATE POLICY "Public can view all reviews"
  ON reviews
  FOR SELECT
  USING (true);

CREATE POLICY "Clients can create reviews for their bookings"
  ON reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = booking_id
      AND bookings.client_id = auth.uid()
      AND bookings.status = 'completed'
    )
  );

-- services table policies (add missing ones)
CREATE POLICY "Public can view all services"
  ON services
  FOR SELECT
  USING (true);

CREATE POLICY "Professionals can manage their own services"
  ON services
  FOR ALL
  TO authenticated
  USING (
    professional_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND (role = 'super_admin' OR role = 'admin')
    )
  )
  WITH CHECK (
    professional_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() 
      AND (role = 'super_admin' OR role = 'admin')
    )
  );
