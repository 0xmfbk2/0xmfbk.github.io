import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { listPublishedPosts } from "@/lib/blog.functions";

const opts = queryOptions({
  queryKey: ["posts", "all"],
  queryFn: () => listPublishedPosts({ data: { limit: 50, offset: 0 } }),
});

export const Route = createFileRoute("/posts/")({
  head: () => ({
    meta: [
      { title: "~/posts — 0xmfbk.dev" },
      { name: "description", content: "Complete archive of security writeups and technical notes by Mustafa Faek Banikhalaf." },
      { property: "og:title", content: "~/posts — 0xmfbk.dev" },
      { property: "og:description", content: "Complete archive of security writeups and technical notes by Mustafa Faek Banikhalaf." },
      { property: "og:url", content: "/posts" },
    ],
    links: [{ rel: "canonical", href: "/posts" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(opts),
  component: Posts,
});

function Posts() {
  const { data } = useSuspenseQuery(opts);
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12">
        <div className="mono text-[11px] uppercase tracking-[0.24em] text-terminal-dim mb-3">
          <span className="text-terminal">$</span> ls -la ~/posts
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-8">Archive</h1>
        {data.posts.length === 0 ? (
          <p className="mono text-sm text-muted-foreground">
            <span className="text-terminal-dim">//</span> nothing published yet.
          </p>
        ) : (
          <ul className="divide-y divide-border/70">
            {data.posts.map((p, i) => (
              <li key={p.id} className="py-6">
                <Link to="/posts/$slug" params={{ slug: p.slug }} className="group block">
                  <div className="flex items-baseline gap-3">
                    <span className="mono text-[11px] text-terminal-dim shrink-0 w-6">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h2 className="text-xl font-medium text-foreground group-hover:text-terminal transition">
                      {p.title}
                    </h2>
                  </div>
                  {p.excerpt && (
                    <p className="mt-2 pl-9 text-sm text-muted-foreground">{p.excerpt}</p>
                  )}
                  <div className="mt-2 pl-9 flex gap-3 mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {p.published_at && (
                      <time dateTime={p.published_at} className="text-terminal-dim">
                        {new Date(p.published_at).toISOString().slice(0, 10).replace(/-/g, ".")}
                      </time>
                    )}
                    {p.category && (
                      <span>
                        <span className="text-terminal-dim">cat=</span>
                        {p.category.name}
                      </span>
                    )}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
