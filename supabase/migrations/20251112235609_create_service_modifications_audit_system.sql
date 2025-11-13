/*
  # Create Service Modifications Audit System

  1. New Tables
    - `service_modifications_log`
      - `id` (uuid, primary key)
      - `service_id` (uuid) - References services table, nullable for deleted services
      - `service_title` (text) - Service title at time of modification
      - `professional_id` (uuid) - References profiles, the service owner
      - `admin_id` (uuid) - References profiles, the super admin who made changes
      - `action_type` (text) - Type of action: 'edited' or 'deleted'
      - `changes_made` (jsonb) - Detailed JSON of what changed
      - `reason` (text) - Reason provided by super admin for the modification
      - `created_at` (timestamptz) - When modification occurred

  2. Security
    - Enable RLS on service_modifications_log table
    - Super admins can insert modification logs
    - Professionals can view logs for their own services
    - Add policies for read access by service owners

  3. Indexes
    - Index on service_id for fast lookups by service
    - Index on professional_id for fast lookups by owner
    - Index on created_at for chronological sorting
    - Index on action_type for filtering

  4. Important Notes
    - Audit log persists even after service deletion
    - Contains complete snapshot of changes for transparency
    - Integrated with notification system
*/

-- Create service_modifications_log table
CREATE TABLE IF NOT EXISTS service_modifications_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id uuid,
  service_title text NOT NULL,
  professional_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  admin_id uuid REFERENCES profiles(id) ON DELETE SET NULL NOT NULL,
  action_type text NOT NULL CHECK (action_type IN ('edited', 'deleted')),
  changes_made jsonb DEFAULT '{}'::jsonb,
  reason text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_service_modifications_service_id 
  ON service_modifications_log(service_id);

CREATE INDEX IF NOT EXISTS idx_service_modifications_professional_id 
  ON service_modifications_log(professional_id);

CREATE INDEX IF NOT EXISTS idx_service_modifications_created_at 
  ON service_modifications_log(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_service_modifications_action_type 
  ON service_modifications_log(action_type);

-- Enable Row Level Security
ALTER TABLE service_modifications_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Super admins can insert modification logs
CREATE POLICY "Super admins can insert modification logs"
  ON service_modifications_log FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Professionals can view logs for their own services
CREATE POLICY "Professionals can view own service modification logs"
  ON service_modifications_log FOR SELECT
  TO authenticated
  USING (
    auth.uid() = professional_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Super admins can view all modification logs
CREATE POLICY "Super admins can view all modification logs"
  ON service_modifications_log FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'super_admin'
    )
  );

-- Update notifications table to support service_modification type
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
  
  -- Add new constraint with service_modification type
  ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
    CHECK (type IN ('booking', 'review', 'system', 'service_modification'));
END $$;

-- Function to notify professional when super admin modifies their service
CREATE OR REPLACE FUNCTION notify_service_modification()
RETURNS TRIGGER AS $$
DECLARE
  admin_name text;
  service_owner_id uuid;
  is_super_admin_action boolean;
BEGIN
  -- Check if the user making the change is a super admin
  SELECT role = 'super_admin', full_name INTO is_super_admin_action, admin_name
  FROM profiles
  WHERE id = auth.uid();
  
  -- Only proceed if this is a super admin action
  IF NOT is_super_admin_action THEN
    RETURN NEW;
  END IF;
  
  -- Get the service owner ID
  IF TG_OP = 'UPDATE' THEN
    service_owner_id := NEW.professional_id;
  ELSIF TG_OP = 'DELETE' THEN
    service_owner_id := OLD.professional_id;
  END IF;
  
  -- Don't notify if super admin is editing their own service
  IF service_owner_id = auth.uid() THEN
    RETURN NEW;
  END IF;
  
  -- Create notification for service owner
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      metadata,
      read
    ) VALUES (
      service_owner_id,
      'Super Admin editou o seu serviço',
      format('O Super Admin "%s" editou o seu serviço "%s".',
        COALESCE(admin_name, 'Administrador'),
        NEW.title
      ),
      'service_modification',
      jsonb_build_object(
        'service_id', NEW.id,
        'service_title', NEW.title,
        'action_type', 'edited',
        'admin_id', auth.uid(),
        'admin_name', admin_name,
        'modified_at', now()
      ),
      false
    );
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO notifications (
      user_id,
      title,
      message,
      type,
      metadata,
      read
    ) VALUES (
      service_owner_id,
      'Super Admin eliminou o seu serviço',
      format('O Super Admin "%s" eliminou o seu serviço "%s".',
        COALESCE(admin_name, 'Administrador'),
        OLD.title
      ),
      'service_modification',
      jsonb_build_object(
        'service_id', OLD.id,
        'service_title', OLD.title,
        'action_type', 'deleted',
        'admin_id', auth.uid(),
        'admin_name', admin_name,
        'modified_at', now()
      ),
      false
    );
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for service modifications
DROP TRIGGER IF EXISTS trigger_notify_service_update ON services;
CREATE TRIGGER trigger_notify_service_update
  AFTER UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION notify_service_modification();

DROP TRIGGER IF EXISTS trigger_notify_service_delete ON services;
CREATE TRIGGER trigger_notify_service_delete
  BEFORE DELETE ON services
  FOR EACH ROW
  EXECUTE FUNCTION notify_service_modification();