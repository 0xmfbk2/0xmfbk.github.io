import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { listPublishedPosts } from "@/lib/blog.functions";

const opts = (slug: string) =>
  queryOptions({
    queryKey: ["tag", slug],
    queryFn: () => listPublishedPosts({ data: { limit: 50, offset: 0, tagSlug: slug } }),
  });

export const Route = createFileRoute("/tags/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(opts(params.slug)),
  head: ({ params }) => ({
    meta: [
      { title: `#${params.slug} — Notes & Writeups` },
      { name: "description", content: `Posts tagged #${params.slug}` },
      { property: "og:url", content: `/tags/${params.slug}` },
    ],
    links: [{ rel: "canonical", href: `/tags/${params.slug}` }],
  }),
  component: TagPage,
});

function TagPage() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery(opts(params.slug));
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Tag</p>
        <h1 className="text-3xl font-semibold tracking-tight mt-2 mb-8">#{params.slug}</h1>
        {data.posts.length === 0 ? (
          <p className="text-muted-foreground">No posts with this tag yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {data.posts.map((p) => (
              <li key={p.id} className="py-6">
                <Link to="/posts/$slug" params={{ slug: p.slug }} className="group block">
                  <h2 className="text-xl font-medium group-hover:underline underline-offset-4">{p.title}</h2>
                  {p.excerpt && <p className="mt-2 text-sm text-muted-foreground">{p.excerpt}</p>}
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
