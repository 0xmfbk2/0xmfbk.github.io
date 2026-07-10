import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { listAllPosts } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/")({
  component: Dashboard,
});

const STATUSES: Array<{ id: "draft" | "scheduled" | "published" | "archived"; label: string; hint: string }> = [
  { id: "draft", label: "draft", hint: "unpublished" },
  { id: "scheduled", label: "scheduled", hint: "queued" },
  { id: "published", label: "published", hint: "live" },
  { id: "archived", label: "archived", hint: "cold" },
];

function Dashboard() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-posts"], queryFn: () => listAllPosts() });

  const stats = (data ?? []).reduce(
    (acc, p) => {
      acc[p.status] = (acc[p.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return (
    <div>
      <div className="mono text-[11px] uppercase tracking-[0.24em] text-terminal-dim mb-2">
        <span className="text-terminal">$</span> status --all
      </div>
      <h1 className="text-3xl font-semibold tracking-tight mb-8">
        Dashboard <span className="mono text-terminal">_</span>
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
        {STATUSES.map((s) => (
          <div
            key={s.id}
            className="rounded-md border border-border bg-surface p-4 hover:border-terminal/40 transition"
          >
            <p className="mono text-[10px] uppercase tracking-[0.24em] text-terminal-dim flex items-center gap-2">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-terminal" />
              {s.label}
            </p>
            <p className="mt-3 mono text-3xl font-semibold tabular-nums">
              {stats[s.id] ?? 0}
            </p>
            <p className="mt-1 mono text-[10px] text-muted-foreground">// {s.hint}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link to="/admin/posts/new" className="rounded-md bg-terminal px-4 py-2 mono text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground hover:brightness-110 transition">
          <span className="mr-1">+</span> new post
        </Link>
        <Link to="/admin/posts" className="rounded-md border border-border bg-surface px-4 py-2 mono text-xs uppercase tracking-[0.14em] hover:border-terminal/50 hover:text-terminal transition">
          ./all_posts
        </Link>
        <Link to="/admin/taxonomy" className="rounded-md border border-border bg-surface px-4 py-2 mono text-xs uppercase tracking-[0.14em] hover:border-terminal/50 hover:text-terminal transition">
          ./taxonomy
        </Link>
      </div>

      {isLoading && (
        <p className="mt-8 mono text-xs text-terminal animate-pulse">loading manifest…</p>
      )}
    </div>
  );
}
