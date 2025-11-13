/*
  # Fix Security Audit Issues - Part 2: Optimize RLS Policies
  
  ## Summary
  This migration optimizes RLS policies to use (select auth.uid()) pattern
  instead of direct auth.uid() calls. This prevents re-evaluation of 
  current_setting() for each row, dramatically improving query performance
  at scale.
  
  ## Changes Made
  
  1. **Optimize super_admin_audit RLS policies**
     - Update "Super admins can view audit logs" policy
  
  2. **Optimize service_variants RLS policies**
     - Update "Professionals can insert variants for their services"
     - Update "Professionals can update variants for their services"
     - Update "Professionals can delete variants for their services"
  
  3. **Optimize notifications RLS policies**
     - Update "Users can view own notifications"
     - Update "Users can update own notifications"
  
  4. **Optimize contact_messages RLS policies**
     - Update "Super admins can delete contact messages"
     - Update "Super admins can view all contact messages"
     - Update "Super admins can update contact messages"
  
  5. **Optimize service_team_members RLS policies**
     - Update "Service owners can add team members"
     - Update "Service owners can update team members"
     - Update "Service owners can delete team members"
  
  6. **Optimize audit_log RLS policies**
     - Update "Professionals can view their own audit logs"
     - Update "System can insert audit logs"
  
  7. **Optimize service_professionals RLS policies**
     - Update "Service owners can add professionals to their services"
     - Update "Service owners can remove professionals from their services"
  
  ## Performance Impact
  - Reduces query time by avoiding repeated auth function calls
  - Single evaluation of auth.uid() per query instead of per row
  - Recommended by Supabase for production workloads
*/

-- 1. Optimize super_admin_audit policies
DROP POLICY IF EXISTS "Super admins can view audit logs" ON super_admin_audit;

CREATE POLICY "Super admins can view audit logs"
  ON super_admin_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = (select auth.uid())
      AND profiles.role = 'super_admin'
    )
  );

-- 2. Optimize service_variants policies
DROP POLICY IF EXISTS "Professionals can insert variants for their services" ON service_variants;
DROP POLICY IF EXISTS "Professionals can update variants for their services" ON service_variants;
DROP POLICY IF EXISTS "Professionals can delete variants for their services" ON service_variants;

CREATE POLICY "Professionals can insert variants for their services"
  ON service_variants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_variants.service_id
      AND services.professional_id = (select auth.uid())
    )
  );

CREATE POLICY "Professionals can update variants for their services"
  ON service_variants FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_variants.service_id
      AND services.professional_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_variants.service_id
      AND services.professional_id = (select auth.uid())
    )
  );

CREATE POLICY "Professionals can delete variants for their services"
  ON service_variants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM services
      WHERE services.id = service_variants.service_id
      AND services.professional_id = (select auth.uid())
    )
  );

-- 3. Optimize notifications policies
DROP POLICY IF EXISTS "Users can view own notifications" ON notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON notifications;

CREATE POLICY "Users can view own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

-- 4. Optimize contact_messages policies (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'contact_messages') THEN
    DROP POLICY IF EXISTS "Super admins can delete contact messages" ON contact_messages;
    DROP POLICY IF EXISTS "Super admins can view all contact messages" ON contact_messages;
    DROP POLICY IF EXISTS "Super admins can update contact messages" ON contact_messages;

    CREATE POLICY "Super admins can delete contact messages"
      ON contact_messages FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = (select auth.uid())
          AND role = 'super_admin'
        )
      );

    CREATE POLICY "Super admins can view all contact messages"
      ON contact_messages FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = (select auth.uid())
          AND role = 'super_admin'
        )
      );

    CREATE POLICY "Super admins can update contact messages"
      ON contact_messages FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = (select auth.uid())
          AND role = 'super_admin'
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = (select auth.uid())
          AND role = 'super_admin'
        )
      );
  END IF;
END $$;

-- 5. Optimize service_team_members policies (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_team_members') THEN
    DROP POLICY IF EXISTS "Service owners can add team members" ON service_team_members;
    DROP POLICY IF EXISTS "Service owners can update team members" ON service_team_members;
    DROP POLICY IF EXISTS "Service owners can delete team members" ON service_team_members;

    CREATE POLICY "Service owners can add team members"
      ON service_team_members FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM services
          WHERE services.id = service_team_members.service_id
          AND services.professional_id = (select auth.uid())
        )
      );

    CREATE POLICY "Service owners can update team members"
      ON service_team_members FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM services
          WHERE services.id = service_team_members.service_id
          AND services.professional_id = (select auth.uid())
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM services
          WHERE services.id = service_team_members.service_id
          AND services.professional_id = (select auth.uid())
        )
      );

    CREATE POLICY "Service owners can delete team members"
      ON service_team_members FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM services
          WHERE services.id = service_team_members.service_id
          AND services.professional_id = (select auth.uid())
        )
      );
  END IF;
END $$;

-- 6. Optimize audit_log policies (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
    DROP POLICY IF EXISTS "Professionals can view their own audit logs" ON audit_log;
    DROP POLICY IF EXISTS "System can insert audit logs" ON audit_log;

    CREATE POLICY "Professionals can view their own audit logs"
      ON audit_log FOR SELECT
      TO authenticated
      USING (
        performed_by = (select auth.uid()) AND
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = (select auth.uid())
          AND role IN ('professional', 'admin', 'super_admin')
        )
      );

    CREATE POLICY "System can insert audit logs"
      ON audit_log FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE id = (select auth.uid())
          AND role IN ('professional', 'admin', 'super_admin')
        )
      );
  END IF;
END $$;

-- 7. Optimize service_professionals policies (if table exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_professionals') THEN
    DROP POLICY IF EXISTS "Service owners can add professionals to their services" ON service_professionals;
    DROP POLICY IF EXISTS "Service owners can remove professionals from their services" ON service_professionals;

    CREATE POLICY "Service owners can add professionals to their services"
      ON service_professionals FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM services
          WHERE services.id = service_professionals.service_id
          AND services.professional_id = (select auth.uid())
        )
      );

    CREATE POLICY "Service owners can remove professionals from their services"
      ON service_professionals FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM services
          WHERE services.id = service_professionals.service_id
          AND services.professional_id = (select auth.uid())
        )
      );
  END IF;
END $$;
