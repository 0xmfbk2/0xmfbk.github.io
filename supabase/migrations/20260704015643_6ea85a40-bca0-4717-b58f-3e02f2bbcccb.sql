
CREATE OR REPLACE FUNCTION public.debug_current_role()
RETURNS text
LANGUAGE sql
STABLE
AS $$ SELECT current_user::text || '/' || session_user::text; $$;
GRANT EXECUTE ON FUNCTION public.debug_current_role() TO anon, authenticated, service_role;
