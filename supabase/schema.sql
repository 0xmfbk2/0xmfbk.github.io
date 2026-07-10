-- =============================================================================
-- 0xmfbk.dev — full blog schema for a fresh Supabase project.
-- Paste this file into Supabase → SQL Editor and run once.
-- Idempotent: safe to re-run on the same project.
-- =============================================================================

-- Extensions -------------------------------------------------------------------
create extension if not exists pgcrypto;
create extension if not exists pg_trgm;

-- Enums ------------------------------------------------------------------------
do $$ begin
  create type public.app_role as enum ('admin', 'moderator', 'user');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.post_status as enum ('draft', 'scheduled', 'published', 'archived');
exception when duplicate_object then null; end $$;

-- Shared helper ----------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- =============================================================================
-- profiles
-- =============================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  bio text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select on public.profiles to anon;
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;

drop policy if exists "profiles_public_read" on public.profiles;
create policy "profiles_public_read" on public.profiles
  for select to anon, authenticated using (true);

drop policy if exists "profiles_self_update" on public.profiles;
create policy "profiles_self_update" on public.profiles
  for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- =============================================================================
-- user_roles + has_role()
-- =============================================================================
create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

drop policy if exists "user_roles_self_read" on public.user_roles;
create policy "user_roles_self_read" on public.user_roles
  for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role);
$$;
revoke all on function public.has_role(uuid, public.app_role) from public;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;

-- Auto-create profile row on signup -------------------------------------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- categories
-- =============================================================================
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  parent_id uuid references public.categories(id) on delete set null,
  description text,
  cover_url text,
  sort_order int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists categories_parent_idx on public.categories (parent_id);
grant select on public.categories to anon, authenticated;
grant all on public.categories to service_role;
alter table public.categories enable row level security;

drop policy if exists "categories_public_read" on public.categories;
create policy "categories_public_read" on public.categories
  for select to anon, authenticated using (true);

drop policy if exists "categories_admin_write" on public.categories;
create policy "categories_admin_write" on public.categories
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop trigger if exists trg_categories_updated_at on public.categories;
create trigger trg_categories_updated_at before update on public.categories
  for each row execute function public.set_updated_at();

-- =============================================================================
-- tags
-- =============================================================================
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  created_at timestamptz not null default now()
);
grant select on public.tags to anon, authenticated;
grant all on public.tags to service_role;
alter table public.tags enable row level security;

drop policy if exists "tags_public_read" on public.tags;
create policy "tags_public_read" on public.tags
  for select to anon, authenticated using (true);

drop policy if exists "tags_admin_write" on public.tags;
create policy "tags_admin_write" on public.tags
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- =============================================================================
-- posts
-- =============================================================================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete restrict,
  category_id uuid references public.categories(id) on delete set null,
  title text not null,
  slug text not null unique,
  excerpt text,
  content_md text not null default '',
  content_html text not null default '',
  cover_url text,
  status public.post_status not null default 'draft',
  reading_minutes int,
  seo_title text,
  seo_description text,
  canonical_url text,
  og_image_url text,
  published_at timestamptz,
  scheduled_for timestamptz,
  is_pinned boolean not null default false,
  priority integer not null default 0,
  deleted_at timestamptz,
  search_tsv tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(excerpt, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(content_md, '')), 'C')
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Backfill new columns if the table pre-existed from an older schema.
alter table public.posts add column if not exists is_pinned boolean not null default false;
alter table public.posts add column if not exists priority integer not null default 0;

create index if not exists posts_status_published_idx on public.posts (status, published_at desc);
create index if not exists posts_category_idx on public.posts (category_id);
create index if not exists posts_search_idx on public.posts using gin (search_tsv);
create index if not exists posts_title_trgm_idx on public.posts using gin (title gin_trgm_ops);
create index if not exists posts_ordering_idx on public.posts (is_pinned desc, priority desc, published_at desc nulls last);

grant select on public.posts to anon, authenticated;
grant insert, update, delete on public.posts to authenticated;
grant all on public.posts to service_role;
alter table public.posts enable row level security;

drop policy if exists "posts_public_read" on public.posts;
create policy "posts_public_read" on public.posts
  for select to anon, authenticated
  using (status = 'published' and deleted_at is null and (published_at is null or published_at <= now()));

drop policy if exists "posts_admin_all" on public.posts;
create policy "posts_admin_all" on public.posts
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop trigger if exists trg_posts_updated_at on public.posts;
create trigger trg_posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

-- =============================================================================
-- post_tags
-- =============================================================================
create table if not exists public.post_tags (
  post_id uuid not null references public.posts(id) on delete cascade,
  tag_id  uuid not null references public.tags(id)  on delete cascade,
  primary key (post_id, tag_id)
);
create index if not exists post_tags_tag_idx on public.post_tags (tag_id);
grant select on public.post_tags to anon, authenticated;
grant insert, delete on public.post_tags to authenticated;
grant all on public.post_tags to service_role;
alter table public.post_tags enable row level security;

drop policy if exists "post_tags_public_read" on public.post_tags;
create policy "post_tags_public_read" on public.post_tags
  for select to anon, authenticated using (true);

drop policy if exists "post_tags_admin_write" on public.post_tags;
create policy "post_tags_admin_write" on public.post_tags
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- =============================================================================
-- post_revisions
-- =============================================================================
create table if not exists public.post_revisions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  editor_id uuid not null references auth.users(id) on delete restrict,
  title text not null,
  excerpt text,
  content_md text not null,
  created_at timestamptz not null default now()
);
create index if not exists post_revisions_post_idx on public.post_revisions (post_id, created_at desc);
grant select, insert on public.post_revisions to authenticated;
grant all on public.post_revisions to service_role;
alter table public.post_revisions enable row level security;

drop policy if exists "post_revisions_admin_all" on public.post_revisions;
create policy "post_revisions_admin_all" on public.post_revisions
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- =============================================================================
-- admin_slug (legacy rotating admin URL; kept for backward compatibility)
-- =============================================================================
create table if not exists public.admin_slug (
  id int primary key check (id = 1),
  slug text not null,
  previous_slug text,
  previous_valid_until timestamptz,
  rotated_at timestamptz not null default now()
);
grant all on public.admin_slug to service_role;
alter table public.admin_slug enable row level security;
-- No policies: only accessed via SECURITY DEFINER functions below.
insert into public.admin_slug (id, slug)
  values (1, encode(gen_random_bytes(12), 'hex'))
  on conflict (id) do nothing;

create or replace function public.admin_slug_matches(_slug text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.admin_slug
    where id = 1 and (
      slug = _slug or (previous_slug = _slug and previous_valid_until > now())
    )
  );
$$;
revoke all on function public.admin_slug_matches(text) from public;
grant execute on function public.admin_slug_matches(text) to authenticated;

create or replace function public.get_admin_slug()
returns text language plpgsql stable security definer set search_path = public as $$
declare result text;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  select slug into result from public.admin_slug where id = 1;
  return result;
end $$;
revoke all on function public.get_admin_slug() from public;
grant execute on function public.get_admin_slug() to authenticated;

create or replace function public.rotate_admin_slug()
returns text language plpgsql security definer set search_path = public as $$
declare new_slug text;
begin
  if not public.has_role(auth.uid(), 'admin') then raise exception 'forbidden'; end if;
  new_slug := encode(gen_random_bytes(12), 'hex');
  update public.admin_slug
    set previous_slug = slug,
        previous_valid_until = now() + interval '10 minutes',
        slug = new_slug,
        rotated_at = now()
    where id = 1;
  return new_slug;
end $$;
revoke all on function public.rotate_admin_slug() from public;
grant execute on function public.rotate_admin_slug() to authenticated;

-- =============================================================================
-- search_posts RPC (used by the client-side search fallback)
-- =============================================================================
create or replace function public.search_posts(_q text, _limit integer default 20)
returns table (
  id uuid,
  slug text,
  title text,
  excerpt text,
  cover_url text,
  published_at timestamptz,
  rank real
) language sql stable security definer set search_path = public as $$
  select p.id, p.slug, p.title, p.excerpt, p.cover_url, p.published_at,
    ts_rank_cd(p.search_tsv, websearch_to_tsquery('english', _q)) +
    0.3 * similarity(p.title, _q) as rank
  from public.posts p
  where p.status = 'published'
    and p.deleted_at is null
    and (p.published_at is null or p.published_at <= now())
    and (
      p.search_tsv @@ websearch_to_tsquery('english', _q)
      or p.title % _q
    )
  order by rank desc, p.published_at desc nulls last
  limit least(_limit, 50);
$$;
revoke all on function public.search_posts(text, integer) from public;
grant execute on function public.search_posts(text, integer) to anon, authenticated;

-- =============================================================================
-- Bootstrapping the first admin:
--   1. Sign up through the app (creates auth.users + a profiles row).
--   2. In this SQL Editor, replacing the email:
--        insert into public.user_roles (user_id, role)
--        select id, 'admin' from auth.users where email = 'you@example.com';
--   3. Sign in at /admin.
-- =============================================================================
