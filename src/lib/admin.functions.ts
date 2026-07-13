// Admin server functions — require signed-in admin user.
// Uses requireSupabaseAuth (RLS as that user) plus a has_role('admin') check.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { renderMarkdownToHtml } from "@/lib/blog.server";
import { computeReadingMinutes, slugify } from "@/lib/markdown";

async function assertAdmin(ctx: { supabase: any; userId: string; claims?: any }) {
  // Enforce AAL2 (MFA) before any admin action. If the user has a verified
  // TOTP factor and their session is still AAL1, reject — otherwise a stolen
  // password alone would grant full admin access.
  const aal = ctx.claims?.aal;
  if (aal !== "aal2") {
    const { data: factors, error: fErr } = await ctx.supabase.auth.mfa.listFactors();
    if (fErr) throw fErr;
    const hasVerified =
      (factors?.totp ?? []).some((f: any) => f.status === "verified") ||
      (factors?.all ?? []).some((f: any) => f.status === "verified");
    if (hasVerified) throw new Error("Unauthorized: AAL2 (MFA) required");
  }

  // user_roles has an RLS policy allowing authenticated users to read their own rows,
  // so we can check the role directly without a SECURITY DEFINER helper.
  const { data, error } = await ctx.supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", ctx.userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("forbidden");
}

const postInput = z.object({
  id: z.string().uuid().optional(),
  title: z.string().trim().min(1).max(240),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(120)
    .regex(/^[a-z0-9-]+$/, "invalid slug"),
  excerpt: z.string().max(500).optional().nullable(),
  content_md: z.string().max(200_000),
  cover_url: z.string().url().max(2000).optional().nullable(),
  status: z.enum(["draft", "scheduled", "published", "archived"]),
  category_id: z.string().uuid().optional().nullable(),
  scheduled_for: z.string().datetime().optional().nullable(),
  published_at: z.string().datetime().optional().nullable(),
  seo_title: z.string().max(240).optional().nullable(),
  seo_description: z.string().max(500).optional().nullable(),
  canonical_url: z.string().url().max(2000).optional().nullable(),
  og_image_url: z.string().url().max(2000).optional().nullable(),
  tag_ids: z.array(z.string().uuid()).max(50).default([]),
});

export const savePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => postInput.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const content_html = await renderMarkdownToHtml(data.content_md);
    const reading_minutes = computeReadingMinutes(data.content_md);
    const payload = {
      title: data.title,
      slug: data.slug,
      excerpt: data.excerpt ?? null,
      content_md: data.content_md,
      content_html,
      cover_url: data.cover_url ?? null,
      status: data.status,
      category_id: data.category_id ?? null,
      scheduled_for: data.scheduled_for ?? null,
      published_at:
        data.status === "published"
          ? (data.published_at ?? new Date().toISOString())
          : (data.published_at ?? null),
      seo_title: data.seo_title ?? null,
      seo_description: data.seo_description ?? null,
      canonical_url: data.canonical_url ?? null,
      og_image_url: data.og_image_url ?? null,
      reading_minutes,
      author_id: context.userId,
    };

    let postId = data.id;
    if (postId) {
      const { error } = await context.supabase.from("posts").update(payload).eq("id", postId);
      if (error) throw error;
    } else {
      const { data: inserted, error } = await context.supabase
        .from("posts")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      postId = inserted.id;
    }

    // Revision snapshot
    await context.supabase.from("post_revisions").insert({
      post_id: postId,
      editor_id: context.userId,
      title: data.title,
      excerpt: data.excerpt ?? null,
      content_md: data.content_md,
    });

    // Sync tags
    await context.supabase.from("post_tags").delete().eq("post_id", postId);
    if (data.tag_ids.length) {
      await context.supabase
        .from("post_tags")
        .insert(data.tag_ids.map((tag_id) => ({ post_id: postId, tag_id })));
    }

    return { id: postId };
  });

export const listAllPosts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { data, error } = await context.supabase
      .from("posts")
      .select(
        "id, slug, title, status, published_at, scheduled_for, updated_at, is_pinned, priority",
      )
      .is("deleted_at", null)
      .order("is_pinned", { ascending: false })
      .order("priority", { ascending: false })
      .order("updated_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as any[];
  });

export const updatePostOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({
        id: z.string().uuid(),
        is_pinned: z.boolean().optional(),
        priority: z.number().int().min(-9999).max(9999).optional(),
      })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const patch: Record<string, unknown> = {};
    if (data.is_pinned !== undefined) patch.is_pinned = data.is_pinned;
    if (data.priority !== undefined) patch.priority = data.priority;
    if (Object.keys(patch).length === 0) return { ok: true };
    const { error } = await (context.supabase.from("posts") as any).update(patch).eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const getPostForEdit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: post, error } = await context.supabase
      .from("posts")
      .select(
        "id, author_id, slug, title, excerpt, content_md, content_html, cover_url, reading_minutes, status, category_id, published_at, scheduled_for, seo_title, seo_description, canonical_url, og_image_url, created_at, updated_at, deleted_at, post_tags(tag_id)",
      )
      .eq("id", data.id)
      .single();
    if (error) throw error;
    return {
      ...post,
      tag_ids: ((post as any).post_tags ?? []).map((t: any) => t.tag_id) as string[],
    };
  });

export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase
      .from("posts")
      .update({ deleted_at: new Date().toISOString(), status: "archived" })
      .eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const listRevisions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ post_id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { data: rows, error } = await context.supabase
      .from("post_revisions")
      .select("id, title, excerpt, created_at")
      .eq("post_id", data.post_id)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) throw error;
    return rows ?? [];
  });

// Taxonomy management
const taxInput = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z0-9-]+$/)
    .optional(),
  parent_id: z.string().uuid().optional().nullable(),
  description: z.string().max(500).optional().nullable(),
});

export const saveCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => taxInput.parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const slug = data.slug ?? slugify(data.name);
    const payload = {
      name: data.name,
      slug,
      parent_id: data.parent_id ?? null,
      description: data.description ?? null,
    };
    if (data.id) {
      const { error } = await context.supabase.from("categories").update(payload).eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("categories").insert(payload);
      if (error) throw error;
    }
    return { ok: true };
  });

export const saveTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({ id: z.string().uuid().optional(), name: z.string().trim().min(1).max(60) })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const slug = slugify(data.name);
    if (data.id) {
      const { error } = await context.supabase
        .from("tags")
        .update({ name: data.name, slug })
        .eq("id", data.id);
      if (error) throw error;
    } else {
      const { error } = await context.supabase.from("tags").insert({ name: data.name, slug });
      if (error) throw error;
    }
    return { ok: true };
  });

export const deleteCategory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("categories").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const deleteTag = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) => z.object({ id: z.string().uuid() }).parse(raw))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { error } = await context.supabase.from("tags").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

// Admin slug operations — RPC functions are locked down to service_role,
// so we call them via the admin (service role) client after verifying the caller is admin.
export const getCurrentAdminSlug = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_admin_slug");
    if (error) throw error;
    return { slug: data as string };
  });

export const rotateAdminSlug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("rotate_admin_slug");
    if (error) throw error;
    return { slug: data as string };
  });
export const getViewStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("get_post_view_stats");
    if (error) throw error;
    return (data ?? []) as {
      post_id: string;
      slug: string;
      title: string;
      total_views: number;
      unique_visitors: number;
      last_viewed_at: string | null;
    }[];
  });

export const getPostViewLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((raw) =>
    z
      .object({ post_id: z.string().uuid(), limit: z.number().int().min(1).max(200).default(100) })
      .parse(raw),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("post_views")
      .select("id, ip_address, user_agent, referrer, viewed_at")
      .eq("post_id", data.post_id)
      .order("viewed_at", { ascending: false })
      .limit(data.limit);
    if (error) throw error;
    return rows ?? [];
  });
