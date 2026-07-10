import { createFileRoute, Link, notFound, useRouter } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { AuthorCard } from "@/components/author-card";
import { getPostBySlug } from "@/lib/blog.functions";

const postOpts = (slug: string) =>
  queryOptions({
    queryKey: ["post", slug],
    queryFn: async () => {
      const post = await getPostBySlug({ data: { slug } });
      if (!post) throw notFound();
      return post;
    },
  });

export const Route = createFileRoute("/posts/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(postOpts(params.slug)),
  head: ({ loaderData, params }) => {
    if (!loaderData) {
      return { meta: [{ title: "Not found" }, { name: "robots", content: "noindex" }] };
    }
    const title = loaderData.seo_title ?? loaderData.title;
    const desc = loaderData.seo_description ?? loaderData.excerpt ?? undefined;
    const meta: Array<Record<string, string>> = [
      { title },
      { property: "og:title", content: title },
      { property: "og:type", content: "article" },
      { property: "og:url", content: `/posts/${params.slug}` },
    ];
    if (desc) {
      meta.push({ name: "description", content: desc });
      meta.push({ property: "og:description", content: desc });
    }
    const img = loaderData.og_image_url ?? loaderData.cover_url;
    if (img) meta.push({ property: "og:image", content: img });
    return {
      meta,
      links: [
        { rel: "canonical", href: loaderData.canonical_url ?? `/posts/${params.slug}` },
      ],
      scripts: [
        {
          type: "application/ld+json",
          children: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Article",
            headline: loaderData.title,
            datePublished: loaderData.published_at,
            author: loaderData.author?.display_name
              ? { "@type": "Person", name: loaderData.author.display_name }
              : undefined,
            image: img ?? undefined,
          }),
        },
      ],
    };
  },
  component: PostPage,
  notFoundComponent: PostNotFound,
  errorComponent: PostError,
});

function PostPage() {
  const params = Route.useParams();
  const { data: post } = useSuspenseQuery(postOpts(params.slug));

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12">
        <article>
          <header className="mb-10">
            <div className="mono text-[11px] uppercase tracking-[0.24em] text-terminal-dim mb-4">
              <Link to="/posts" className="hover:text-terminal">~/posts</Link>{" "}
              <span className="text-terminal">/</span> {params.slug}
            </div>
            <div className="mb-5 flex flex-wrap items-center gap-2 mono text-[11px] uppercase tracking-[0.14em]">
              {post.category && (
                <Link
                  to="/categories/$slug"
                  params={{ slug: post.category.slug }}
                  className="terminal-chip hover:terminal-chip-active hover:text-terminal transition"
                >
                  {post.category.name}
                </Link>
              )}
              {post.published_at && (
                <span className="text-terminal-dim">
                  {new Date(post.published_at).toISOString().slice(0, 10).replace(/-/g, ".")}
                </span>
              )}
            </div>
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight leading-[1.08]">
              {post.title}
            </h1>
            {post.excerpt && (
              <p className="mt-4 text-lg text-muted-foreground leading-relaxed">{post.excerpt}</p>
            )}
            <hr className="ascii-divider mt-8" />
          </header>
          {post.cover_url && (
            <img
              src={post.cover_url}
              alt=""
              className="w-full rounded-lg border border-border mb-10"
              loading="lazy"
            />
          )}
          <div
            className="article-content max-w-none"
            dangerouslySetInnerHTML={{ __html: post.content_html }}
          />
          {post.tags.length > 0 && (
            <footer className="mt-14 pt-6 border-t border-border/70">
              <div className="mono text-[11px] uppercase tracking-[0.24em] text-terminal-dim mb-3">
                <span className="text-terminal">#</span> tags
              </div>
              <div className="flex flex-wrap gap-2">
                {post.tags.map((t) => (
                  <Link
                    key={t.slug}
                    to="/tags/$slug"
                    params={{ slug: t.slug }}
                    className="terminal-chip hover:terminal-chip-active hover:text-terminal transition"
                  >
                    #{t.name}
                  </Link>
                ))}
              </div>
            </footer>
          )}
        </article>

      </main>
      <SiteFooter />
    </div>
  );
}

function PostNotFound() {
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-3xl font-semibold">Post not found</h1>
        <p className="mt-2 text-muted-foreground">This writeup doesn't exist or has been unpublished.</p>
        <Link to="/posts" className="mt-6 inline-block text-sm underline">Back to all posts</Link>
      </main>
      <SiteFooter />
    </div>
  );
}

function PostError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  console.error(error);
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1 mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-3xl font-semibold">Something went wrong</h1>
        <button
          className="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground"
          onClick={() => {
            router.invalidate();
            reset();
          }}
        >
          Try again
        </button>
      </main>
      <SiteFooter />
    </div>
  );
}
