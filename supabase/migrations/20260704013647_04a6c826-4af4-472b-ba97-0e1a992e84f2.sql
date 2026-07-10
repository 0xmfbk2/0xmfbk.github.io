
-- Create private schema not exposed via PostgREST
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA private TO service_role;

-- Move has_role into private schema
CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role);
$$;
REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated, service_role;

-- Recreate policies to reference private.has_role
DROP POLICY IF EXISTS "categories admin write" ON public.categories;
CREATE POLICY "categories admin write" ON public.categories
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "tags admin write" ON public.tags;
CREATE POLICY "tags admin write" ON public.tags
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "posts admin all" ON public.posts;
CREATE POLICY "posts admin all" ON public.posts
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "post_tags admin write" ON public.post_tags;
CREATE POLICY "post_tags admin write" ON public.post_tags
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "revisions admin all" ON public.post_revisions;
CREATE POLICY "revisions admin all" ON public.post_revisions
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'))
  WITH CHECK (private.has_role(auth.uid(), 'admin'));

-- Drop public.has_role now that policies no longer reference it
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);

-- Revoke public EXECUTE on remaining SECURITY DEFINER functions in public schema
-- and restrict to service_role only (server-only callers).
REVOKE ALL ON FUNCTION public.rotate_admin_slug() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rotate_admin_slug() TO service_role;

REVOKE ALL ON FUNCTION public.get_admin_slug() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_slug() TO service_role;

REVOKE ALL ON FUNCTION public.search_posts(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.search_posts(text, integer) TO service_role;

REVOKE ALL ON FUNCTION public.admin_slug_matches(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_slug_matches(text) TO service_role;

-- Trigger function - not called via API
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
