import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { AuthorCard } from "@/components/author-card";
import { listPublishedPosts, listCategories } from "@/lib/blog.functions";

const homeOpts = queryOptions({
  queryKey: ["home"],
  queryFn: async () => {
    const [posts, categories] = await Promise.all([
      listPublishedPosts({ data: { limit: 50, offset: 0 } }),
      listCategories(),
    ]);
    return { posts: posts.posts, categories };
  },
});

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>) => ({
    page: search.page ? Number(search.page) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "0xmfbk.sec" },
      {
        name: "description",
        content:
          "Offensive & Defensive Security — Web Application Penetration Testing, OWASP Top 10 vulnerability assessment, and custom security scripting using Python.",
      },
      { property: "og:title", content: "0xmfbk.sec" },
      {
        property: "og:description",
        content:
          "Offensive & Defensive Security — Web Application Penetration Testing, OWASP Top 10 vulnerability assessment, and custom security scripting using Python.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "/" },
    ],
    links: [{ rel: "canonical", href: "/" }],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(homeOpts),
  component: Home,
});

const PAGE_SIZE = 8;

function Home() {
  const { data } = useSuspenseQuery(homeOpts);
  const navigate = useNavigate();
  const allPosts = data.posts;

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredPosts = selectedCategory
    ? allPosts.filter((p) => p.category?.slug === selectedCategory)
    : allPosts;

  // Client-side pagination over the (filtered) set.
  const search = Route.useSearch();
  const page = Math.max(1, Number(search.page ?? 1));
  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filteredPosts.slice(start, start + PAGE_SIZE);

  const selectCategory = (slug: string | null) => {
    setSelectedCategory(slug);
    // Reset pagination when the filter changes.
    navigate({ to: "/", search: { page: undefined }, replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-5xl px-4">
        {/* Hero */}
        <section className="pt-16 md:pt-24 pb-14 border-b border-border/70 flex gap-8">
          <div className="md:w-[1000px] md:shrink-0">
            <AuthorCard />
          </div>
        </section>

        {/* Tags list — moved ABOVE writeups, filters the list below */}
        {data.categories.length > 0 && (
          <section className="pt-12 pb-6">
            <div className="mono text-[11px] uppercase tracking-[0.24em] text-terminal-dim mb-4">
              <span className="text-terminal">&gt;</span> tags --list
              {selectedCategory && (
                <span className="ml-2 text-muted-foreground">
                  --filter=<span className="text-terminal">{selectedCategory}</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => selectCategory(null)}
                className={
                  "terminal-chip transition mono text-xs " +
                  (selectedCategory === null
                    ? "terminal-chip-active text-terminal"
                    : "hover:terminal-chip-active hover:text-terminal")
                }
                aria-pressed={selectedCategory === null}
              >
                {selectedCategory === null ? "> " : ""}all
              </button>
              {data.categories.map((c) => {
                const active = selectedCategory === c.slug;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => selectCategory(active ? null : c.slug)}
                    className={
                      "terminal-chip transition mono text-xs " +
                      (active
                        ? "terminal-chip-active text-terminal"
                        : "hover:terminal-chip-active hover:text-terminal")
                    }
                    aria-pressed={active}
                  >
                    {active ? "> " : ""}
                    {c.name}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Writeups */}
        <section className="pb-14">
          <div className="mono text-[11px] uppercase tracking-[0.24em] text-terminal-dim mb-6 flex items-center justify-between">
            <span>
              <span className="text-terminal">&gt;</span> ls ./writeups
              {selectedCategory && (
                <span className="ml-2 text-muted-foreground normal-case tracking-normal">
                  ({filteredPosts.length} match{filteredPosts.length === 1 ? "" : "es"})
                </span>
              )}
            </span>
            <span className="text-terminal-dim">
              page {currentPage}/{totalPages}
            </span>
          </div>

          {pageItems.length === 0 ? (
            <p className="mono text-sm text-muted-foreground">
              No writeups match this tag yet.{" "}
              <button
                type="button"
                onClick={() => selectCategory(null)}
                className="text-terminal hover:underline"
              >
                clear filter
              </button>
            </p>
          ) : (
            <ul className="divide-y divide-border/70">
              {pageItems.map((p, i) => (
                <li key={p.id} className="py-6">
                  <Link to="/posts/$slug" params={{ slug: p.slug }} className="group block">
                    <div className="flex items-baseline gap-3">
                      <span className="mono text-xs text-terminal-dim shrink-0 w-8 tabular-nums">
                        {String(start + i + 1).padStart(2, "0")}
                      </span>
                      <h3 className="text-xl font-medium text-foreground group-hover:text-terminal transition">
                        {p.title}
                      </h3>
                    </div>
                    {p.excerpt && (
                      <p className="mt-2 pl-11 text-sm text-muted-foreground leading-relaxed">
                        {p.excerpt}
                      </p>
                    )}
                    <div className="pl-11">
                      <PostMeta post={p} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}

          {totalPages > 1 && (
            <nav className="mt-10 flex items-center justify-between mono text-xs">
              {currentPage > 1 ? (
                <Link
                  to="/"
                  search={{ page: currentPage - 1 }}
                  className="terminal-chip hover:text-terminal transition"
                >
                  ← prev
                </Link>
              ) : (
                <span className="terminal-chip opacity-40 cursor-not-allowed">← prev</span>
              )}
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }).map((_, i) => {
                  const n = i + 1;
                  const active = n === currentPage;
                  return (
                    <Link
                      key={n}
                      to="/"
                      search={{ page: n }}
                      className={
                        "rounded-sm px-2 py-1 tabular-nums transition " +
                        (active
                          ? "text-terminal bg-accent/40"
                          : "text-muted-foreground hover:text-terminal hover:bg-accent/40")
                      }
                    >
                      {String(n).padStart(2, "0")}
                    </Link>
                  );
                })}
              </div>
              {currentPage < totalPages ? (
                <Link
                  to="/"
                  search={{ page: currentPage + 1 }}
                  className="terminal-chip hover:text-terminal transition"
                >
                  next →
                </Link>
              ) : (
                <span className="terminal-chip opacity-40 cursor-not-allowed">next →</span>
              )}
            </nav>
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

function PostMeta({
  post,
}: {
  post: {
    published_at: string | null;
    category: { slug: string; name: string } | null;
  };
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
      {post.published_at && (
        <time dateTime={post.published_at} className="text-terminal-dim">
          {new Date(post.published_at).toISOString().slice(0, 10).replace(/-/g, ".")}
        </time>
      )}
      {post.category && (
        <span>
          <span className="text-terminal-dim">cat=</span>
          {post.category.name}
        </span>
      )}
    </div>
  );
}
