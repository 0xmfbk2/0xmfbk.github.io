import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const sb = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
        );
        const [{ data: posts }, { data: cats }, { data: tags }] = await Promise.all([
          sb
            .from("posts")
            .select("slug, updated_at, published_at")
            .eq("status", "published")
            .is("deleted_at", null)
            .lte("published_at", new Date().toISOString()),
          sb.from("categories").select("slug"),
          sb.from("tags").select("slug"),
        ]);

        const url = new URL(request.url);
        const origin = `${url.protocol}//${url.host}`;

        const urls: string[] = [`${origin}/`, `${origin}/posts`];
        (posts ?? []).forEach((p) => urls.push(`${origin}/posts/${p.slug}`));
        (cats ?? []).forEach((c) => urls.push(`${origin}/categories/${c.slug}`));
        (tags ?? []).forEach((t) => urls.push(`${origin}/tags/${t.slug}`));

        const xml = `<?xml version="1.0" encoding="UTF-8" ?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${u}</loc></url>`).join("\n")}
</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=600",
          },
        });
      },
    },
  },
});
