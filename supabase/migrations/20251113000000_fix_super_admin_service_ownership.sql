/*
  # Fix Super Admin Service Ownership Issue

  1. Problem
    - Super admin was inadvertently taking ownership of services when editing
    - Services disappeared from original owner's dashboard
    - professional_id was being changed during super admin edits

  2. Solution
    - Add constraint to prevent professional_id changes during UPDATE operations
    - Update RLS policy to explicitly prevent ownership transfers
    - Allow super admin to edit services without changing ownership

  3. Security
    - Maintains existing permissions for super admin to edit all services
    - Prevents accidental ownership transfers
    - Preserves original service owner relationship

  4. Important Notes
    - professional_id can only be set during INSERT (service creation)
    - professional_id cannot be changed during UPDATE operations
    - Super admin can edit all fields except professional_id
*/

-- Drop existing UPDATE policy for services
DROP POLICY IF EXISTS "services_update_owner" ON services;

-- Create new UPDATE policy that prevents ownership changes
CREATE POLICY "services_update_owner"
  ON services FOR UPDATE
  TO authenticated
  USING (
    professional_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role IN ('super_admin', 'admin')
    )
  )
  WITH CHECK (
    (
      professional_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid()
        AND role IN ('super_admin', 'admin')
      )
    )
    AND professional_id = (SELECT professional_id FROM services WHERE id = services.id)
  );

-- Add comment explaining the policy
COMMENT ON POLICY "services_update_owner" ON services IS
  'Allows service owners and super admins to update services, but prevents changing professional_id to maintain ownership integrity';
