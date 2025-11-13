/*
  # Restore Service Ownership Data

  ## Problem
  Due to the bug in the previous RLS policy (fixed in migration 20251113003144),
  some services had their professional_id incorrectly changed when super admins
  edited them. This caused services to disappear from their original owner's
  dashboard.

  ## Services Affected
  Based on service_modifications_log analysis:
  
  1. **Salão Caty** (ID: 6751b97f-027c-42b7-9116-d7a9b4a21632)
     - Current (incorrect) professional_id: 6fb4e80b-f8c9-4d00-8b1f-48cfc2dd0694 (Patricio Brito - super_admin)
     - Original (correct) professional_id: 6b50d396-a3b9-4ae6-8bf2-82dc9df67b0f (Catarina Domingues - professional)
     - Last edited: 2025-11-13 00:03:15
     - Edit reason: "Vou corrigir a palavra 'Experiências'"

  ## Solution
  1. Temporarily disable the ownership immutability trigger
  2. Restore correct professional_id values using service_modifications_log
  3. Re-enable the trigger
  4. Log the restoration for audit purposes

  ## Safety Measures
  - Only update services where professional_id was changed to a super_admin
  - Only update if there's a corresponding entry in service_modifications_log
  - Create backup of current state before restoration
  - Log all changes made

  ## Verification
  After this migration:
  - Services should appear in the original owner's dashboard
  - service_modifications_log should remain intact as audit trail
  - Future super admin edits will not change ownership (trigger prevents it)
*/

-- Create a backup table of current service ownership state
CREATE TABLE IF NOT EXISTS service_ownership_restoration_backup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid NOT NULL,
  service_title text,
  old_professional_id uuid,
  new_professional_id uuid,
  restoration_reason text,
  restored_at timestamptz DEFAULT now(),
  restored_by text DEFAULT 'migration_20251113003303'
);

-- Temporarily disable the trigger to allow ownership restoration
ALTER TABLE services DISABLE TRIGGER enforce_service_ownership_immutable;

-- Backup current state before making changes
INSERT INTO service_ownership_restoration_backup (
  service_id,
  service_title,
  old_professional_id,
  new_professional_id,
  restoration_reason
)
SELECT 
  s.id,
  s.title,
  s.professional_id as old_professional_id,
  sml.professional_id as new_professional_id,
  'Restoring ownership after super admin edit bug. Original edit reason: ' || sml.reason
FROM services s
INNER JOIN service_modifications_log sml ON s.id = sml.service_id
INNER JOIN profiles p ON s.professional_id = p.id
WHERE 
  -- Service is currently owned by a super_admin
  p.role = 'super_admin'
  -- But the service_modifications_log shows a different original owner
  AND sml.professional_id != s.professional_id
  -- And that original owner is a professional (not an admin)
  AND EXISTS (
    SELECT 1 FROM profiles original_owner
    WHERE original_owner.id = sml.professional_id
    AND original_owner.role = 'professional'
  );

-- Restore correct professional_id values
UPDATE services
SET professional_id = subquery.correct_professional_id
FROM (
  SELECT 
    s.id as service_id,
    sml.professional_id as correct_professional_id
  FROM services s
  INNER JOIN service_modifications_log sml ON s.id = sml.service_id
  INNER JOIN profiles current_owner ON s.professional_id = current_owner.id
  INNER JOIN profiles original_owner ON sml.professional_id = original_owner.id
  WHERE 
    -- Service is currently owned by a super_admin
    current_owner.role = 'super_admin'
    -- But should be owned by the professional in the log
    AND sml.professional_id != s.professional_id
    -- Verify the original owner is a professional
    AND original_owner.role = 'professional'
) AS subquery
WHERE services.id = subquery.service_id;

-- Re-enable the trigger to enforce ownership immutability
ALTER TABLE services ENABLE TRIGGER enforce_service_ownership_immutable;

-- Create a summary report of what was restored
DO $$
DECLARE
  restoration_count INTEGER;
  rec RECORD;
BEGIN
  SELECT COUNT(*) INTO restoration_count
  FROM service_ownership_restoration_backup;
  
  RAISE NOTICE 'Service Ownership Restoration Complete';
  RAISE NOTICE '=====================================';
  RAISE NOTICE 'Services restored: %', restoration_count;
  RAISE NOTICE '';
  
  IF restoration_count > 0 THEN
    RAISE NOTICE 'Details of restored services:';
    
    FOR rec IN 
      SELECT 
        service_title,
        old_professional_id::text as old_owner,
        new_professional_id::text as new_owner,
        restoration_reason
      FROM service_ownership_restoration_backup
    LOOP
      RAISE NOTICE '  - Service: %', rec.service_title;
      RAISE NOTICE '    Changed from: %', rec.old_owner;
      RAISE NOTICE '    Restored to: %', rec.new_owner;
      RAISE NOTICE '    Reason: %', rec.restoration_reason;
      RAISE NOTICE '';
    END LOOP;
  ELSE
    RAISE NOTICE 'No services needed restoration.';
  END IF;
END $$;

-- Add RLS policy for the backup table
ALTER TABLE service_ownership_restoration_backup ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view restoration logs"
  ON service_ownership_restoration_backup FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
    )
  );

-- Add helpful comments
COMMENT ON TABLE service_ownership_restoration_backup IS
  'Audit log of service ownership restorations performed to fix the super admin edit bug. Contains before/after professional_id values.';

-- Verify the restoration was successful
DO $$
DECLARE
  salao_caty_owner uuid;
  expected_owner uuid := '6b50d396-a3b9-4ae6-8bf2-82dc9df67b0f';
BEGIN
  SELECT professional_id INTO salao_caty_owner
  FROM services
  WHERE id = '6751b97f-027c-42b7-9116-d7a9b4a21632';
  
  IF salao_caty_owner = expected_owner THEN
    RAISE NOTICE '';
    RAISE NOTICE '✅ SUCCESS: Salão Caty ownership restored to Catarina Domingues (%)!', expected_owner;
    RAISE NOTICE 'The service will now appear in Catarina''s dashboard.';
  ELSIF salao_caty_owner IS NULL THEN
    RAISE WARNING '⚠️  Salão Caty service not found in database';
  ELSE
    RAISE WARNING '⚠️  ATTENTION: Salão Caty professional_id is % but expected %', salao_caty_owner, expected_owner;
  END IF;
END $$;
