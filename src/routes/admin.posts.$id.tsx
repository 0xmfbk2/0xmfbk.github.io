import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPostForEdit } from "@/lib/admin.functions";
import { PostEditor } from "@/components/post-editor";

export const Route = createFileRoute("/admin/posts/$id")({
  component: EditPost,
});

function EditPost() {
  const params = Route.useParams();
  const { data, isLoading } = useQuery({
    queryKey: ["admin-post", params.id],
    queryFn: () => getPostForEdit({ data: { id: params.id } }),
  });

  if (isLoading || !data) return <p className="text-muted-foreground">Loading…</p>;
  return <PostEditor initial={data} />;
}
