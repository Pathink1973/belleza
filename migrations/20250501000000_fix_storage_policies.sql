/*
  # Fix Storage Policies for Public Upload

  1. Storage Policies
    - Allow public uploads to services bucket (since using local auth)
    - Maintain public read access
    - Allow anyone to manage images temporarily

  2. Notes
    - This is simplified for local authentication
    - In production, should use proper Supabase auth
*/

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Professionals can upload service images" ON storage.objects;
DROP POLICY IF EXISTS "Professionals can update their own service images" ON storage.objects;
DROP POLICY IF EXISTS "Professionals can delete their own service images" ON storage.objects;

-- Create permissive policies for local development
CREATE POLICY "Anyone can upload service images"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'services');

CREATE POLICY "Anyone can update service images"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'services')
WITH CHECK (bucket_id = 'services');

CREATE POLICY "Anyone can delete service images"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'services');