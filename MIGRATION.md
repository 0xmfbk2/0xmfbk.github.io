# Self-hosting `0xmfbk.dev` on your own Supabase

This project currently runs on Lovable Cloud. To move it to your own Supabase
project, follow these steps end-to-end.

## 1. Create a new Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Copy these values from **Project Settings → API**:
   - `Project URL` → `SUPABASE_URL` / `VITE_SUPABASE_URL`
   - `anon` / `publishable` key → `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (server-only, never expose)

## 2. Run the schema

Open **SQL Editor** and paste the contents of `supabase/schema.sql` in one go.
It is idempotent — safe to re-run. It creates:

- `profiles`, `user_roles`, `categories`, `tags`, `posts`, `post_tags`, `post_revisions`, `admin_slug`
- Enums `app_role`, `post_status`
- Helpers `has_role`, `handle_new_user`, `set_updated_at`
- Admin-URL helpers `admin_slug_matches`, `get_admin_slug`, `rotate_admin_slug`
- Row-Level Security enabled everywhere, with public read on published posts and admin-only writes.

## 3. Configure environment variables

Set these in your hosting platform (Vercel / Cloudflare / etc.):

```
VITE_SUPABASE_URL=<Project URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_URL=<Project URL>
SUPABASE_PUBLISHABLE_KEY=<publishable key>
SUPABASE_SERVICE_ROLE_KEY=<service role key>
```

## 4. Create your admin user

1. Start the app and sign up with your email at `/{admin-slug}` (see step 5 to find it).
2. In Supabase SQL editor:

```sql
insert into public.user_roles (user_id, role)
select id, 'admin' from auth.users where email = 'you@example.com';
```

3. Enable TOTP MFA for your account from within the app (Settings → MFA).

## 5. Find (or rotate) your admin URL

```sql
select slug from public.admin_slug where id = 1;
```

Visit `/<slug>` to reach the admin dashboard. Rotate anytime from **Settings** in the admin UI.

## 6. Personalize the site

Edit `src/config/profile.ts` — name, job title, bio, avatar path. Drop your
avatar image at `public/images/avatar.jpg` (or point `avatar` at any URL).
Header, footer, homepage hero, and post author cards all read from that one file.

## What's NOT included

`supabase/schema.sql` intentionally omits every experimental migration and
unused table from Lovable Cloud. It's the minimum surface the running app
touches. If you later add features that need new tables, create a new
migration in `supabase/migrations/` and apply it on top.
