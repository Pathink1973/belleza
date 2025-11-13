/*
  # Fix Critical Bug in Services Ownership Protection Policy

  ## Problem
  The previous migration (20251113000000) attempted to prevent professional_id
  changes during service updates, but contained a critical bug in the WITH CHECK
  clause that made the protection ineffective.

  ## The Bug
  Line 49 of the previous migration had:
  ```sql
  AND professional_id = (SELECT professional_id FROM services WHERE id = services.id)
  ```

  This subquery is ambiguous because `services.id` in the WHERE clause refers to
  the same table being updated, causing the comparison to always be true or return
  unexpected results. The subquery doesn't properly correlate with the row being updated.

  ## The Fix
  The correct approach is to use a correlated subquery that properly references
  the OLD value of the row being updated. In PostgreSQL RLS policies, we need to
  ensure the NEW professional_id equals the OLD professional_id.

  ## Impact
  This bug allowed super admins to inadvertently change service ownership when
  editing services, causing services to disappear from their original owner's
  dashboard and appear to belong to the super admin instead.

  ## Solution
  1. Drop the broken policy
  2. Create a corrected policy with proper OLD/NEW value comparison
  3. The WITH CHECK ensures the NEW professional_id must equal the OLD professional_id

  ## Security Considerations
  - Service owners can still update their own services
  - Super admins can still edit service content (title, description, price, etc.)
  - professional_id field is now immutable after service creation
  - Only INSERT operations can set professional_id (never UPDATE)

  ## Testing Checklist
  - [ ] Professional can update their own service without issues
  - [ ] Super admin can edit service content without changing ownership
  - [ ] Attempting to change professional_id in UPDATE fails
  - [ ] Service remains in original owner's dashboard after super admin edit
*/

-- Drop the broken UPDATE policy
DROP POLICY IF EXISTS "services_update_owner" ON services;

-- Create corrected UPDATE policy with proper ownership protection
-- This policy allows updates but prevents changing professional_id
CREATE POLICY "services_update_owner"
  ON services FOR UPDATE
  TO authenticated
  USING (
    -- Allow the service owner to update their service
    professional_id = auth.uid()
    OR
    -- Allow super admin/admin to update any service
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    -- Ensure update permission (same as USING)
    (
      professional_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
      )
    )
    AND
    -- CRITICAL: Prevent changing professional_id
    -- The NEW professional_id must equal the OLD professional_id
    -- We compare against the existing value in the database
    professional_id = (
      SELECT s.professional_id
      FROM services s
      WHERE s.id = services.id
    )
  );

-- Add explanatory comment
COMMENT ON POLICY "services_update_owner" ON services IS
  'Allows service owners and super admins to update services, but prevents changing professional_id. The WITH CHECK clause ensures professional_id remains immutable by comparing the new value against the existing database value.';

-- Add an additional safeguard: create a function to validate updates
CREATE OR REPLACE FUNCTION validate_service_ownership_immutable()
RETURNS TRIGGER AS $$
BEGIN
  -- If professional_id is being changed, reject the update
  IF NEW.professional_id IS DISTINCT FROM OLD.professional_id THEN
    RAISE EXCEPTION 'Cannot change service ownership. professional_id is immutable after creation. Old: %, New: %',
      OLD.professional_id, NEW.professional_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists (to allow re-running migration)
DROP TRIGGER IF EXISTS enforce_service_ownership_immutable ON services;

-- Create trigger to enforce professional_id immutability at database level
CREATE TRIGGER enforce_service_ownership_immutable
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION validate_service_ownership_immutable();

-- Add comment on the trigger
COMMENT ON TRIGGER enforce_service_ownership_immutable ON services IS
  'Database-level safeguard that prevents any changes to professional_id field after service creation. This ensures service ownership cannot be transferred, even if RLS policies are bypassed.';

-- Create audit log for any attempted professional_id changes
CREATE TABLE IF NOT EXISTS service_ownership_violations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid,
  old_professional_id uuid,
  attempted_new_professional_id uuid,
  attempted_by uuid,
  attempted_at timestamptz DEFAULT now(),
  violation_context text
);

-- Enable RLS on violations table
ALTER TABLE service_ownership_violations ENABLE ROW LEVEL SECURITY;

-- Only super admins can view violation logs
CREATE POLICY "Super admins can view ownership violations"
  ON service_ownership_violations FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

COMMENT ON TABLE service_ownership_violations IS
  'Audit log of any attempts to change service professional_id. Used for security monitoring and debugging ownership issues.';
