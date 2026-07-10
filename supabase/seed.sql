-- =============================================================================
-- 0xmfbk.dev — optional seed data.
-- Run AFTER schema.sql and AFTER you have created your first admin user.
-- Replace 'you@example.com' below with the email you signed up with.
-- Safe to re-run: uses ON CONFLICT DO NOTHING everywhere.
-- =============================================================================

-- Categories (used as the "tags --list" chips on the homepage) -----------------
insert into public.categories (name, slug, description, sort_order) values
  ('Cybersecurity', 'cybersecurity', 'Offensive and defensive security writeups.', 10),
  ('Networking',    'networking',    'Packets, protocols, and pivots.',            20),
  ('Systems',       'systems',       'Linux internals, kernels, and tooling.',     30),
  ('Web',           'web',           'Web application security and appsec notes.', 40)
on conflict (slug) do nothing;

-- Tags -------------------------------------------------------------------------
insert into public.tags (name, slug) values
  ('OWASP',  'owasp'),
  ('Python', 'python'),
  ('Linux',  'linux'),
  ('CTF',    'ctf'),
  ('Nmap',   'nmap')
on conflict (slug) do nothing;

-- Sample posts — attached to the admin user identified by email ---------------
-- If the user does not exist yet, this block is a no-op.
do $$
declare
  admin_id uuid;
  cat_cyber uuid;
  cat_web uuid;
  post_a uuid;
  post_b uuid;
  tag_owasp uuid;
  tag_python uuid;
  tag_ctf uuid;
begin
  select id into admin_id from auth.users where email = 'you@example.com' limit 1;
  if admin_id is null then
    raise notice 'Skipping sample posts: no user with email you@example.com. Edit seed.sql and re-run.';
    return;
  end if;

  select id into cat_cyber from public.categories where slug = 'cybersecurity';
  select id into cat_web   from public.categories where slug = 'web';
  select id into tag_owasp from public.tags where slug = 'owasp';
  select id into tag_python from public.tags where slug = 'python';
  select id into tag_ctf    from public.tags where slug = 'ctf';

  insert into public.posts (author_id, category_id, title, slug, excerpt, content_md, content_html, status, published_at, reading_minutes)
  values (
    admin_id, cat_web,
    'OWASP Top 10 — a practical walkthrough',
    'owasp-top-10-walkthrough',
    'A short tour of the OWASP Top 10 with real payload examples and remediation notes.',
    '# OWASP Top 10 — a practical walkthrough\n\nContent goes here…',
    '<h1>OWASP Top 10 — a practical walkthrough</h1><p>Content goes here…</p>',
    'published', now() - interval '2 days', 6
  )
  on conflict (slug) do nothing
  returning id into post_a;

  insert into public.posts (author_id, category_id, title, slug, excerpt, content_md, content_html, status, published_at, reading_minutes, is_pinned, priority)
  values (
    admin_id, cat_cyber,
    'Building a tiny Python port scanner',
    'python-port-scanner',
    'A minimal asyncio-based port scanner in under 60 lines of Python.',
    '# Building a tiny Python port scanner\n\nContent goes here…',
    '<h1>Building a tiny Python port scanner</h1><p>Content goes here…</p>',
    'published', now() - interval '5 days', 4,
    true, 10
  )
  on conflict (slug) do nothing
  returning id into post_b;

  -- post_tags — only insert when both sides exist and the post was just created.
  if post_a is not null then
    insert into public.post_tags (post_id, tag_id)
      values (post_a, tag_owasp)
      on conflict do nothing;
  end if;
  if post_b is not null then
    insert into public.post_tags (post_id, tag_id) values
      (post_b, tag_python),
      (post_b, tag_ctf)
    on conflict do nothing;
  end if;
end $$;
