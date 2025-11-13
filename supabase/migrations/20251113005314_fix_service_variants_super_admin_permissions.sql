/*
  # Allow Super Admin to Edit Service Variants for Any Service

  ## Overview
  This migration updates the RLS policies on the service_variants table to allow Super Admins 
  to create, update, and delete variants for any service, not just their own. This enables 
  Super Admins to provide complete maintenance support to professionals, including managing 
  service pricing options.

  ## Changes

  1. **Updated RLS Policies on service_variants**
    - Modified INSERT policy: Allow service owners OR super admins to create variants
    - Modified UPDATE policy: Allow service owners OR super admins to update variants
    - Modified DELETE policy: Allow service owners OR super admins to delete variants
    - SELECT policy remains unchanged (public access)

  2. **Security Considerations**
    - Super Admin actions are logged in service_modifications_log table
    - Service owners are notified via notifications system when Super Admin edits variants
    - All variant changes require a reason from Super Admin (enforced in application)

  ## Important Notes
  - This does NOT change ownership of services - owner remains the original professional
  - Super Admin is acting in a maintenance/support capacity
  - All changes are fully auditable through the service_modifications_log table
  - Service owners receive automatic notifications of any Super Admin edits
*/

-- Drop existing policies on service_variants
DROP POLICY IF EXISTS "Professionals can insert variants for their services" ON service_variants;
DROP POLICY IF EXISTS "Professionals can update variants for their services" ON service_variants;
DROP POLICY IF EXISTS "Professionals can delete variants for their services" ON service_variants;

-- CREATE new INSERT policy: Service owner OR Super Admin can create variants
CREATE POLICY "Service owners and super admins can insert variants"
  ON service_variants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_variants.service_id
      AND services.professional_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- CREATE new UPDATE policy: Service owner OR Super Admin can update variants
CREATE POLICY "Service owners and super admins can update variants"
  ON service_variants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_variants.service_id
      AND services.professional_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_variants.service_id
      AND services.professional_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- CREATE new DELETE policy: Service owner OR Super Admin can delete variants
CREATE POLICY "Service owners and super admins can delete variants"
  ON service_variants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_variants.service_id
      AND services.professional_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );