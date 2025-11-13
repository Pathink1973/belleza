/*
  # Create storage buckets for avatars and services

  1. New Storage Buckets
    - `avatars`: For storing user profile pictures
    - `services`: For storing service images
  
  2. Security
    - Enable public access for viewing images
    - Allow authenticated users to upload and manage their own files
*/

-- Create avatars bucket
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

-- Create services bucket
insert into storage.buckets (id, name, public)
values ('services', 'services', true);

-- Set up security policies for avatars bucket
create policy "Anyone can view avatars"
  on storage.objects for select
  using ( bucket_id = 'avatars' );

create policy "Authenticated users can upload avatars"
  on storage.objects for insert
  with check (
    bucket_id = 'avatars'
    and auth.role() = 'authenticated'
  );

create policy "Users can update their own avatars"
  on storage.objects for update
  using (
    bucket_id = 'avatars'
    and auth.uid() = owner
  );

create policy "Users can delete their own avatars"
  on storage.objects for delete
  using (
    bucket_id = 'avatars'
    and auth.uid() = owner
  );

-- Set up security policies for services bucket
create policy "Anyone can view service images"
  on storage.objects for select
  using ( bucket_id = 'services' );

create policy "Professionals can upload service images"
  on storage.objects for insert
  with check (
    bucket_id = 'services'
    and auth.role() = 'authenticated'
    and exists (
      select 1 from public.profiles
      where id = auth.uid()
      and role = 'professional'
    )
  );

create policy "Professionals can update their own service images"
  on storage.objects for update
  using (
    bucket_id = 'services'
    and auth.uid() = owner
  );

create policy "Professionals can delete their own service images"
  on storage.objects for delete
  using (
    bucket_id = 'services'
    and auth.uid() = owner
  );