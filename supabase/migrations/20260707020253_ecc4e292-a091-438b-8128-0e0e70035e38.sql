-- Lock down SECURITY DEFINER functions from the anon (unauthenticated) role.
-- admin_slug_matches is now called from a server function via the service-role client.
-- search_posts is no longer used by the app (search feature removed).
REVOKE ALL ON FUNCTION public.admin_slug_matches(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_posts(text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_admin_slug() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.rotate_admin_slug() FROM PUBLIC, anon, authenticated;

-- service_role retains execute (default for the owner role, but grant explicitly for clarity).
GRANT EXECUTE ON FUNCTION public.admin_slug_matches(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_posts(text, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_admin_slug() TO service_role;
GRANT EXECUTE ON FUNCTION public.rotate_admin_slug() TO service_role;