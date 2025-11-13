/*
  # Create storage buckets and policies

  1. New Storage Buckets
    - `services` bucket for service images
    - `avatars` bucket for user profile pictures

  2. Security
    - Enable RLS on storage.objects table
    - Create buckets with public access
    - Set up RLS policies for each bucket
*/

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Create buckets
INSERT INTO storage.buckets (id, name, public)
VALUES ('services', 'services', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist
DO $$
BEGIN
    DROP POLICY IF EXISTS "Anyone can view service images" ON storage.objects;
    DROP POLICY IF EXISTS "Professionals can upload service images" ON storage.objects;
    DROP POLICY IF EXISTS "Professionals can update their own service images" ON storage.objects;
    DROP POLICY IF EXISTS "Professionals can delete their own service images" ON storage.objects;
    DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Authenticated users can upload avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
    DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
EXCEPTION
    WHEN others THEN null;
END $$;

-- Create policies for services bucket
CREATE POLICY "Anyone can view service images"
ON storage.objects FOR SELECT
USING ( bucket_id = 'services' );

CREATE POLICY "Professionals can upload service images"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'services'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
    AND role = 'professional'
  )
);

CREATE POLICY "Professionals can update their own service images"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'services'
  AND auth.uid() = owner
);

CREATE POLICY "Professionals can delete their own service images"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'services'
  AND auth.uid() = owner
);

-- Create policies for avatars bucket
CREATE POLICY "Anyone can view avatars"
ON storage.objects FOR SELECT
USING ( bucket_id = 'avatars' );

CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars'
  AND auth.role() = 'authenticated'
);

CREATE POLICY "Users can update their own avatars"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'avatars'
  AND auth.uid() = owner
);

CREATE POLICY "Users can delete their own avatars"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'avatars'
  AND auth.uid() = owner
);