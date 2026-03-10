-- Fix RLS recursion issue in profiles table
-- The admin check policy causes infinite recursion

-- Drop the problematic policy
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

-- Create a security definer function to check admin status without RLS recursion
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Recreate admin policy using the security definer function
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (public.is_admin());

-- Also fix the is_owner function to be security definer
CREATE OR REPLACE FUNCTION public.is_owner(check_user_id uuid)
RETURNS boolean AS $$
BEGIN
  RETURN auth.uid() = check_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
