-- Read the current user's active profile without widening public.users SELECT RLS.
-- The function returns only the caller's own row and never exposes auth secrets.
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.users
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.*
  FROM public.users AS u
  WHERE u.id = (SELECT auth.uid())
    AND u.deleted_at IS NULL
    AND u.is_active = TRUE
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;
