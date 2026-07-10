
-- Cleanup debug helper
DROP FUNCTION IF EXISTS public.debug_current_role();

-- Restore anon EXECUTE on the two lookup functions the app calls without a bearer token.
-- These functions are narrow: search_posts returns only published, non-deleted rows;
-- admin_slug_matches returns only a boolean.
GRANT EXECUTE ON FUNCTION public.admin_slug_matches(text) TO anon;
GRANT EXECUTE ON FUNCTION public.search_posts(text, integer) TO anon;
