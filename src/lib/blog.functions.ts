// Public blog server functions (no auth required).
// Reads use a server-side publishable-key Supabase client so they work during
// SSR without a bearer token. RLS still applies as the anon role.
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { getRequestHeader, getRequestIP } from "@tanstack/react-start/server";

function serverPublicClient() {
  return createClient<Database>(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export type PostCard = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  cover_url: string | null;
  published_at: string | null;
  reading_minutes: number | null;
  category: { slug: string; name: string } | null;
};

export const listPublishedPosts = createServerFn({ method: "GET" })
  .inputValidator((raw) =>
    z
      .object({
        limit: z.number().int().min(1).max(50).default(20),
        offset: z.number().int().min(0).default(0),
        categorySlug: z.string().optional(),
        tagSlug: z.string().optional(),
      })
      .parse(raw ?? {}),
  )
  .handler(async ({ data }): Promise<{ posts: PostCard[]; total: number }> => {
    const sb = serverPublicClient();
    let query = sb
      .from("posts")
      .select(
        "id, slug, title, excerpt, cover_url, published_at, reading_minutes, categories(slug, name), post_tags!inner(tags!inner(slug))",
        { count: "exact" },
      )
      .eq("status", "published")
      .is("deleted_at", null)
      .lte("published_at", new Date().toISOString())
      .order("published_at", { ascending: false })
      .range(data.offset, data.offset + data.limit - 1);

    if (data.categorySlug) {
      const { data: cat } = await sb
        .from("categories")
        .select("id")
        .eq("slug", data.categorySlug)
        .maybeSingle();
      if (cat) query = query.eq("category_id", cat.id);
    }
    if (data.tagSlug) query = query.eq("post_tags.tags.slug", data.tagSlug);

    // Fallback path when no tag filter — the inner join above forces posts to
    // have at least one tag, which is wrong for the general listing. Re-issue
    // without the join in that case.
    if (!data.tagSlug) {
      let q2 = (sb.from("posts") as any)
        .select(
          "id, slug, title, excerpt, cover_url, published_at, reading_minutes, is_pinned, priority, categories(slug, name)",
          {
            count: "exact",
          },
        )
        .eq("status", "published")
        .is("deleted_at", null)
        .lte("published_at", new Date().toISOString())
        .order("is_pinned", { ascending: false })
        .order("priority", { ascending: false })
        .order("published_at", { ascending: false })
        .range(data.offset, data.offset + data.limit - 1);
      if (data.categorySlug) {
        const { data: cat } = await sb
          .from("categories")
          .select("id")
          .eq("slug", data.categorySlug)
          .maybeSingle();
        if (cat) q2 = q2.eq("category_id", cat.id);
      }
      const { data: rows, count, error } = await q2;
      if (error) throw error;
      return {
        posts: (rows ?? []).map((r: any) => ({
          id: r.id,
          slug: r.slug,
          title: r.title,
          excerpt: r.excerpt,
          cover_url: r.cover_url,
          published_at: r.published_at,
          reading_minutes: r.reading_minutes,
          category: r.categories ? { slug: r.categories.slug, name: r.categories.name } : null,
        })),
        total: count ?? 0,
      };
    }

    const { data: rows, count, error } = await query;
    if (error) throw error;
    return {
      posts: (rows ?? []).map((r: any) => ({
        id: r.id,
        slug: r.slug,
        title: r.title,
        excerpt: r.excerpt,
        cover_url: r.cover_url,
        published_at: r.published_at,
        reading_minutes: r.reading_minutes,
        category: r.categories ? { slug: r.categories.slug, name: r.categories.name } : null,
      })),
      total: count ?? 0,
    };
  });

export type PostDetail = PostCard & {
  content_html: string;
  content_md: string;
  seo_title: string | null;
  seo_description: string | null;
  canonical_url: string | null;
  og_image_url: string | null;
  tags: { slug: string; name: string }[];
  author: { display_name: string | null; avatar_url: string | null; bio: string | null } | null;
};

export const getPostBySlug = createServerFn({ method: "GET" })
  .inputValidator((raw) => z.object({ slug: z.string().min(1).max(120) }).parse(raw))
  .handler(async ({ data }): Promise<PostDetail | null> => {
    const sb = serverPublicClient();
    const { data: post, error } = await sb
      .from("posts")
      .select(
        "id, slug, title, excerpt, cover_url, published_at, reading_minutes, content_html, content_md, seo_title, seo_description, canonical_url, og_image_url, author_id, categories(slug, name), post_tags(tags(slug, name))",
      )
      .eq("slug", data.slug)
      .eq("status", "published")
      .is("deleted_at", null)
      .lte("published_at", new Date().toISOString())
      .maybeSingle();
    if (error) throw error;
    if (!post) return null;

    const { data: author } = await sb
      .from("profiles")
      .select("display_name, avatar_url, bio")
      .eq("id", post.author_id)
      .maybeSingle();

    return {
      id: post.id,
      slug: post.slug,
      title: post.title,
      excerpt: post.excerpt,
      cover_url: post.cover_url,
      published_at: post.published_at,
      reading_minutes: post.reading_minutes,
      content_html: post.content_html,
      content_md: post.content_md,
      seo_title: post.seo_title,
      seo_description: post.seo_description,
      canonical_url: post.canonical_url,
      og_image_url: post.og_image_url,
      category: post.categories ? { slug: post.categories.slug, name: post.categories.name } : null,
      tags: (post.post_tags ?? [])
        .map((pt: any) => pt.tags)
        .filter(Boolean)
        .map((t: any) => ({ slug: t.slug, name: t.name })),
      author: author ?? null,
    };
  });

export const listCategories = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverPublicClient();
  const { data, error } = await sb
    .from("categories")
    .select("id, slug, name, parent_id, description")
    .order("sort_order");
  if (error) throw error;
  return data ?? [];
});

export const listTags = createServerFn({ method: "GET" }).handler(async () => {
  const sb = serverPublicClient();
  const { data, error } = await sb.from("tags").select("id, slug, name").order("name");
  if (error) throw error;
  return data ?? [];
});

export const resolveAdminSlug = createServerFn({ method: "GET" })
  .inputValidator((raw) => z.object({ slug: z.string().min(1).max(120) }).parse(raw))
  .handler(async ({ data }) => {
    // EXECUTE on `admin_slug_matches` is restricted to service_role, so use
    // the admin client. This runs server-side only and never exposes the key.
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: ok, error } = await supabaseAdmin.rpc("admin_slug_matches", {
        _slug: data.slug,
      });
      if (error) throw error;
      return { ok: !!ok };
    } catch (err) {
      console.error("[resolveAdminSlug] rpc failed:", err);
      return { ok: false };
    }
  });

const BOT_UA_PATTERN =
  /bot|crawler|spider|curl|wget|python-requests|scrapy|headless|monitor|pingdom|uptimerobot/i;

export const recordPostView = createServerFn({ method: "POST" })
  .inputValidator((raw) => z.object({ post_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data }) => {
    const ip = getRequestIP({ xForwardedFor: true }) || "0.0.0.0";
    const userAgent = getRequestHeader("user-agent") ?? null;
    const referrer = getRequestHeader("referer") ?? null;
    const isBot = userAgent ? BOT_UA_PATTERN.test(userAgent) : false;

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Flood protection: skip if this IP already viewed this post in the last 30 min
      const { data: recent } = await supabaseAdmin
        .from("post_views")
        .select("id")
        .eq("post_id", data.post_id)
        .eq("ip_address", ip)
        .gte("viewed_at", new Date(Date.now() - 30 * 60 * 1000).toISOString())
        .limit(1)
        .maybeSingle();

      if (!recent) {
        await supabaseAdmin.from("post_views").insert({
          post_id: data.post_id,
          ip_address: ip,
          user_agent: userAgent,
          referrer,
          is_bot: isBot,
        });
      }
    } catch (err) {
      console.error("[recordPostView] insert failed:", err);
    }
    return { ok: true };
  });