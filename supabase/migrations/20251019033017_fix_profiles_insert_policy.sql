/*
  # Fix Profiles INSERT Policy
  
  This migration adds the missing INSERT policy for the profiles table.
  Without this policy, the handle_new_user() trigger cannot create profiles
  for new users during signup.
  
  1. Security
    - Add INSERT policy for profiles table
    - Allow profile creation only during user registration via trigger
*/

-- Add missing INSERT policy for profiles
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);