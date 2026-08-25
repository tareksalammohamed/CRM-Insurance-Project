-- Restore execution of the existing SECURITY DEFINER helpers used by the
-- public.users RLS policies. This does not grant table access; it only lets
-- authenticated requests evaluate the policies that already define access.
GRANT EXECUTE ON FUNCTION public.get_user_subtree(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;
