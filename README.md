# Notes & Writeups — Personal Technical Blog

A dynamic, SSR technical blog with a hidden, rotating admin panel.

## Stack

- **TanStack Start** (React 19, SSR, file-based routing)
- **Lovable Cloud** (Postgres + Auth + Storage) for backend
- **Tailwind v4** for styling
- **remark/rehype** pipeline for server-rendered, sanitized Markdown
- **Postgres tsvector + pg_trgm** for full-text search with typo tolerance

## Architecture Highlights

### Hidden rotating admin URL

The admin panel lives at `/{ADMIN_SLUG}` where the slug is a random 24-char
hex token stored in the `admin_slug` table. Anything that doesn't match the
current slug (or the previous slug during a 10-minute grace window) throws
`notFound()` — the URL is indistinguishable from any other 404.

The current slug is:

```
/9e480b69daf625c2d7aa620c
```

Rotate it any time from Admin → Settings → "Rotate now". After rotating,
the old slug remains valid for 10 minutes so an active session isn't cut off.

### Data model

- `profiles` (mirrors `auth.users`, auto-created via trigger)
- `user_roles` + `has_role()` SECURITY DEFINER (roles NEVER on profiles)
- `categories` (hierarchical), `tags`, `post_tags`
- `posts` with generated `tsvector search_tsv`, soft-delete, and lifecycle
  status (`draft` / `scheduled` / `published` / `archived`)
- `post_revisions` — snapshot appended on every save
- `admin_slug` (single-row) — RLS-locked, only reachable via
  `admin_slug_matches()` / `get_admin_slug()` / `rotate_admin_slug()`

### RLS posture

- `anon` can SELECT `posts` only where
  `status='published' AND deleted_at IS NULL AND published_at <= now()`.
  Drafts and scheduled posts are invisible without auth.
- All admin writes gated by `public.has_role(auth.uid(),'admin')`.
- Public read policies also apply to `categories`, `tags`, `post_tags`,
  `profiles` (safe fields).
- `user_roles`, `post_revisions`, `admin_slug` — no anon access.

### Security headers

Applied in `src/start.ts` via a global request middleware:

- Content-Security-Policy (strict default-src, `frame-ancestors 'none'`)
- Strict-Transport-Security (2 years, includeSubDomains, preload)
- X-Frame-Options DENY, X-Content-Type-Options nosniff
- Referrer-Policy strict-origin-when-cross-origin
- Permissions-Policy restrictive
- `X-Powered-By` / `Server` stripped

### Two-factor auth (TOTP)

Enroll from Admin → Settings → "Add authenticator". Sign-in is a two-step
flow: password → TOTP challenge if a verified factor exists.

## Bootstrapping the admin

The first admin user is not created automatically — you must:

1. Create an auth user with your email (Lovable Cloud → Users → Add user,
   or invite yourself with a temporary password).
2. Assign the admin role by running once:

```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin' FROM auth.users WHERE email = 'you@example.com';
```

3. Visit `/{ADMIN_SLUG}` (see above), sign in, then Settings → enroll TOTP.

## Public routes

- `/` — homepage (latest + featured + categories)
- `/posts` — archive
- `/posts/$slug` — article (SSR, JSON-LD, canonical, OG tags)
- `/categories/$slug`, `/tags/$slug`
- `/search` — full-text search (tsvector + pg_trgm typo fallback)
- `/rss.xml`, `/sitemap.xml`, `/robots.txt`

## Admin routes

All under `/{ADMIN_SLUG}/`:

- `/` dashboard (status counts, quick links)
- `/posts` list with archive action
- `/posts/new`, `/posts/$id` editor with live preview + revision history
- `/taxonomy` categories + tags CRUD
- `/settings` slug rotation, MFA enrollment

## v1 non-goals (deferred)

- Scheduled cron publish (schema is ready; wire up pg_cron to a
  `/api/public/hooks/publish-scheduled` route pointing at the stable
  `project--{id}.lovable.app` URL when needed)
- Image upload pipeline (WebP conversion, blurhash) — use direct URLs for now
- IP-based login rate limiting (add a `login_attempts` ledger + server route
  when abuse becomes a real threat; Supabase Auth applies its own throttles)
- Search index (Meilisearch etc.) — Postgres full-text handles this scale
