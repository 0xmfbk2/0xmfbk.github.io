import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { PostEditor } from "@/components/post-editor";

export const Route = createFileRoute("/admin/posts/new")({
  component: NewPost,
});

function NewPost() {
  const navigate = useNavigate();
  return (
    <PostEditor
      onSaved={(id) => navigate({ to: "/admin/posts/$id", params: { id } })}
    />
  );
}
