/*
  # Add RLS policies for services table

  1. Security Changes
    - Enable RLS on services table
    - Add policies for professionals to:
      - Insert their own services
      - Update their own services
      - Delete their own services
      - View all services (public access)
    
  2. Policy Details
    - Professionals can only manage (create/update/delete) services where they are the professional_id
    - Everyone can view all services
    - All operations require the user to have the 'professional' role
*/

-- Enable RLS
ALTER TABLE services ENABLE ROW LEVEL SECURITY;

-- Allow professionals to insert their own services
CREATE POLICY "Professionals can insert their own services"
ON services
FOR INSERT
TO authenticated
WITH CHECK (
  professional_id = auth.uid() 
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'professional'
  )
);

-- Allow professionals to update their own services
CREATE POLICY "Professionals can update their own services"
ON services
FOR UPDATE
TO authenticated
USING (
  professional_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'professional'
  )
)
WITH CHECK (
  professional_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'professional'
  )
);

-- Allow professionals to delete their own services
CREATE POLICY "Professionals can delete their own services"
ON services
FOR DELETE
TO authenticated
USING (
  professional_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid()
    AND role = 'professional'
  )
);

-- Allow public access to view all services
CREATE POLICY "Everyone can view services"
ON services
FOR SELECT
TO public
USING (true);