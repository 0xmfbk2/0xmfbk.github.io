# Supabase Migration Guide

Step-by-step instructions to self-host this blog on **your own** Supabase
project. It walks you through the SQL files, environment variables, and the
common errors you may hit in the Supabase SQL Editor.

---

## 1. Prerequisites

- A Supabase project (free tier is fine). Note down:
  - **Project URL** — `https://<ref>.supabase.co`
  - **Project ref** — the `<ref>` from the URL
  - **Publishable / anon key** (Settings → API)
  - **Service role key** (Settings → API — keep this secret; server-only)
- The two SQL files shipped in this repo:
  - `supabase/schema.sql`
  - `supabase/seed.sql` *(optional sample data)*
- A local checkout of this project with `bun install` completed.

---

## 2. Environment variables

Create/update `.env` at the repo root:

```env
# Client-visible (Vite build-time replacement)
VITE_SUPABASE_URL=https://<ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
VITE_SUPABASE_PROJECT_ID=<ref>

# Server-only (SSR + server functions)
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_PUBLISHABLE_KEY=<publishable-or-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

For your deploy target (Vercel, Cloudflare, Fly, etc.) set the same values as
project-level environment variables. Never expose `SUPABASE_SERVICE_ROLE_KEY`
to the browser.

---

## 3. Run the schema

1. Open the Supabase dashboard → **SQL Editor** → **New query**.
2. Paste the entire contents of `supabase/schema.sql` and click **Run**.
3. You should see `Success. No rows returned.`

The file is idempotent — it uses `create ... if not exists`, `drop policy if
exists ... create policy`, and `create or replace function`, so re-running it
on the same project is safe.

What it creates:

- Extensions: `pgcrypto`, `pg_trgm`.
- Enums: `app_role`, `post_status`.
- Tables: `profiles`, `user_roles`, `categories`, `tags`, `posts`,
  `post_tags`, `post_revisions`, `admin_slug`.
- RLS policies + explicit GRANTs for every table.
- Functions/RPCs: `has_role`, `handle_new_user`, `admin_slug_matches`,
  `get_admin_slug`, `rotate_admin_slug`, `search_posts`.
- Triggers: `on_auth_user_created`, `updated_at` triggers, and the
  generated `posts.search_tsv` column with GIN index.

---

## 4. Create the first admin

1. Start the app locally (`bun run dev`) or on your deploy, and **sign up**
   with your email through the normal signup flow. That creates a row in
   `auth.users` and (via `handle_new_user`) a row in `public.profiles`.
2. Back in the SQL Editor, promote yourself to admin (replace the email):

   ```sql
   insert into public.user_roles (user_id, role)
   select id, 'admin' from auth.users where email = 'you@example.com';
   ```

3. Sign in at `/admin`. You should land on the admin dashboard.

---

## 5. (Optional) Load seed data

`supabase/seed.sql` inserts a handful of categories/tags plus two sample
posts.

1. Open `supabase/seed.sql` in your editor and change `'you@example.com'`
   inside the `do $$` block to the email you promoted in step 4.
2. Paste the file into the SQL Editor and click **Run**.
3. If the user lookup fails, the block prints a `NOTICE` and skips the
   posts — the categories and tags still land. Fix the email and re-run.

---

## 6. Regenerate TypeScript types (optional)

If you customise the schema, refresh the local types file so the app stays
type-safe:

```bash
bunx supabase gen types typescript --project-id <ref> > src/integrations/supabase/types.ts
```

Log in first with `bunx supabase login` if you have not already.

---

## 7. Common errors

- **`permission denied for schema public`** on any `select`/`insert`.
  Supabase does not grant Data-API privileges by default. The schema file
  contains explicit `grant`s for `anon` / `authenticated` / `service_role`
  on every table — re-run the section that failed and confirm the grants
  are present.

- **`must be owner of relation users`** when installing the
  `on_auth_user_created` trigger. Run the schema as the project owner
  (the default identity in the Supabase SQL Editor). If you connected with
  a role that lacks ownership, switch the editor role to `postgres`.

- **`type "app_role" already exists`** or similar. The enum-creation blocks
  are wrapped in `do $$ … exception when duplicate_object then null; end $$;`,
  so this error should already be swallowed. If it surfaces from a manual
  edit, wrap it the same way.

- **`Expected 3 parts in JWT; got 1`** from a server function reading public
  data. That means the server is being handed an `sb_secret_*` opaque key
  when it expected a JWT-format publishable/anon key. Make sure
  `SUPABASE_PUBLISHABLE_KEY` in your deploy env matches the JWT-format
  publishable/anon key from **Settings → API**.

- **`new row violates row-level security policy`** when the admin UI writes.
  Confirm you completed step 4 (a row in `public.user_roles` with
  `role = 'admin'`).

---

## 8. Deploy checklist

- [ ] `supabase/schema.sql` executed successfully.
- [ ] First admin promoted in `public.user_roles`.
- [ ] `.env` and deploy-target env vars populated.
- [ ] Site published; `/` renders and `/admin` accepts login.
- [ ] A test post created in the admin dashboard shows up on the homepage.

You are good to go.
