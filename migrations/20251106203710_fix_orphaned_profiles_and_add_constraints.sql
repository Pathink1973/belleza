/*
  # Fix Orphaned Profiles and Add Referential Integrity
  
  1. Changes
    - Add foreign key constraint to ensure profiles.id references auth.users(id)
    - Add ON DELETE CASCADE to automatically remove profiles when auth user is deleted
    - This prevents orphaned profile records
  
  2. Security
    - Ensures data integrity between auth.users and profiles tables
    - Prevents duplicate email issues from orphaned records
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'profiles_id_fkey'
  ) THEN
    ALTER TABLE profiles
    ADD CONSTRAINT profiles_id_fkey 
    FOREIGN KEY (id) 
    REFERENCES auth.users(id) 
    ON DELETE CASCADE;
  END IF;
END $$;
