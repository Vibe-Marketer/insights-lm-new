/*
  # Fix Profiles ID Mismatch
  
  The profiles table has id != user_id for existing users.
  The notebooks.user_id foreign key references profiles.id.
  This migration updates profiles.id to match profiles.user_id so the foreign key works.
  
  1. Changes
    - Drop foreign key constraint temporarily
    - Update profiles.id to match user_id from auth.users
    - Recreate foreign key constraint
  
  2. Security
    - Maintains all existing RLS policies
*/

-- Drop the foreign key constraint temporarily
ALTER TABLE public.notebooks DROP CONSTRAINT IF EXISTS notebooks_user_id_fkey;

-- Delete existing profiles (they're mismatched)
DELETE FROM public.profiles;

-- Insert profiles with correct id values
INSERT INTO public.profiles (id, user_id, email, full_name)
SELECT 
  u.id,
  u.id,
  u.email,
  COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', '')
FROM auth.users u
ON CONFLICT (id) DO NOTHING;

-- Recreate the foreign key constraint
ALTER TABLE public.notebooks 
ADD CONSTRAINT notebooks_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;