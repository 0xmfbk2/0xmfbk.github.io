import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions } from "@tanstack/react-query";
import { SiteHeader, SiteFooter } from "@/components/site-chrome";
import { listPublishedPosts, listCategories } from "@/lib/blog.functions";

const opts = (slug: string) =>
  queryOptions({
    queryKey: ["category", slug],
    queryFn: async () => {
      const [posts, cats] = await Promise.all([
        listPublishedPosts({ data: { limit: 50, offset: 0, categorySlug: slug } }),
        listCategories(),
      ]);
      const category = cats.find((c) => c.slug === slug) ?? null;
      return { posts: posts.posts, category };
    },
  });

export const Route = createFileRoute("/categories/$slug")({
  loader: ({ context, params }) => context.queryClient.ensureQueryData(opts(params.slug)),
  head: ({ loaderData, params }) => ({
    meta: [
      { title: loaderData?.category ? `${loaderData.category.name} — Notes & Writeups` : "Category" },
      { name: "description", content: loaderData?.category?.description ?? `Posts in ${params.slug}` },
      { property: "og:url", content: `/categories/${params.slug}` },
    ],
    links: [{ rel: "canonical", href: `/categories/${params.slug}` }],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const params = Route.useParams();
  const { data } = useSuspenseQuery(opts(params.slug));
  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground">
      <SiteHeader />
      <main className="flex-1 mx-auto w-full max-w-3xl px-4 py-12">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Category</p>
        <h1 className="text-3xl font-semibold tracking-tight mt-2 mb-8">
          {data.category?.name ?? params.slug}
        </h1>
        {data.posts.length === 0 ? (
          <p className="text-muted-foreground">No posts in this category yet.</p>
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
