import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pin, PinOff } from "lucide-react";
import { listAllPosts, deletePost, updatePostOrder } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/posts/")({
  component: PostsList,
});

const STATUS_CLASS: Record<string, string> = {
  draft: "text-muted-foreground border-border",
  scheduled: "text-yellow-300/80 border-yellow-300/30",
  published: "text-terminal border-terminal/50",
  archived: "text-destructive/80 border-destructive/40",
};

type SortMode = "smart" | "newest" | "oldest" | "updated" | "manual";

const SORT_LABELS: Record<SortMode, string> = {
  smart: "pinned + newest",
  newest: "newest first",
  oldest: "oldest first",
  updated: "recently updated",
  manual: "manual order",
};

type Row = {
  id: string;
  slug: string;
  title: string;
  status: string;
  published_at: string | null;
  scheduled_for: string | null;
  updated_at: string;
  is_pinned?: boolean;
  priority?: number;
};

function PostsList() {
  const qc = useQueryClient();
  const [sort, setSort] = useState<SortMode>("smart");
  const [priorityDrafts, setPriorityDrafts] = useState<Record<string, string>>({});

  const { data, isLoading } = useQuery({
    queryKey: ["admin-posts"],
    queryFn: () => listAllPosts() as Promise<Row[]>,
  });

  const del = useMutation({
    mutationFn: (id: string) => deletePost({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-posts"] }),
  });

  const order = useMutation({
    mutationFn: (input: { id: string; is_pinned?: boolean; priority?: number }) =>
      updatePostOrder({ data: input }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-posts"] }),
  });

  const sorted = useMemo(() => {
    const rows = [...(data ?? [])];
    const tPublished = (r: Row) => new Date(r.published_at ?? r.updated_at).getTime();
    switch (sort) {
      case "newest":
        rows.sort((a, b) => tPublished(b) - tPublished(a));
        break;
      case "oldest":
        rows.sort((a, b) => tPublished(a) - tPublished(b));
        break;
      case "updated":
        rows.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        break;
      case "manual":
        rows.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));
        break;
      case "smart":
      default:
        rows.sort((a, b) => {
          const pinDiff = Number(b.is_pinned ?? false) - Number(a.is_pinned ?? false);
          if (pinDiff !== 0) return pinDiff;
          const prDiff = (b.priority ?? 0) - (a.priority ?? 0);
          if (prDiff !== 0) return prDiff;
          return tPublished(b) - tPublished(a);
        });
    }
    return rows;
  }, [data, sort]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <p className="mono text-[11px] uppercase tracking-[0.24em] text-terminal-dim">
            <span className="text-terminal">$</span> ls -la ./posts --sort={sort}
          </p>
          <h1 className="text-2xl font-semibold tracking-tight mt-1">Posts</h1>
        </div>
        <div className="flex items-center gap-2">
          <label className="mono text-[10px] uppercase tracking-[0.24em] text-terminal-dim">sort:</label>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortMode)}
            className="rounded-md border border-border bg-surface px-2 py-1.5 mono text-xs outline-none focus:border-terminal focus:ring-2 focus:ring-terminal/30"
          >
            {(Object.keys(SORT_LABELS) as SortMode[]).map((k) => (
              <option key={k} value={k}>{SORT_LABELS[k]}</option>
            ))}
          </select>
          <Link
            to="/admin/posts/new"
            className="rounded-md bg-terminal px-4 py-2 mono text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground hover:brightness-110 transition"
          >
            + new post
          </Link>
        </div>
      </div>

      {isLoading && (
        <p className="mono text-xs text-terminal animate-pulse">reading manifest…</p>
      )}
      {data && data.length === 0 && (
        <p className="mono text-sm text-muted-foreground">
          <span className="text-terminal-dim">//</span> no posts yet. spawn one with{" "}
          <Link to="/admin/posts/new" className="text-terminal hover:underline">new post</Link>.
        </p>
      )}
      {data && data.length > 0 && (
        <div className="rounded-md border border-border bg-surface overflow-hidden">
          <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 px-4 py-2 mono text-[10px] uppercase tracking-[0.24em] text-terminal-dim border-b border-border">
            <span>pin</span>
            <span>title</span>
            <span>priority</span>
            <span>status</span>
            <span>updated</span>
            <span className="text-right">op</span>
          </div>
          <ul>
            {sorted.map((p) => {
              const pinned = !!p.is_pinned;
              const draft = priorityDrafts[p.id];
              const currentPriority = draft !== undefined ? draft : String(p.priority ?? 0);
              return (
                <li
                  key={p.id}
                  className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-4 px-4 py-3 border-b border-border/60 last:border-b-0 transition ${
                    pinned ? "bg-terminal/5 hover:bg-terminal/10" : "hover:bg-accent/30"
                  }`}
                >
                  <button
                    onClick={() => order.mutate({ id: p.id, is_pinned: !pinned })}
                    disabled={order.isPending}
                    title={pinned ? "unpin" : "pin to top"}
                    className={`rounded-sm p-1 transition ${
                      pinned
                        ? "text-terminal hover:text-destructive/80"
                        : "text-muted-foreground hover:text-terminal"
                    }`}
                  >
                    {pinned ? <Pin size={14} fill="currentColor" /> : <PinOff size={14} />}
                  </button>

                  <Link
                    to="/admin/posts/$id"
                    params={{ id: p.id }}
                    className="text-sm font-medium text-foreground hover:text-terminal truncate"
                  >
                    {p.title || <span className="text-muted-foreground italic">untitled</span>}
                  </Link>

                  <input
                    type="number"
                    value={currentPriority}
                    onChange={(e) => setPriorityDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                    onBlur={() => {
                      const next = Number(currentPriority) || 0;
                      if (next !== (p.priority ?? 0)) {
                        order.mutate({ id: p.id, priority: next });
                      }
                      setPriorityDrafts((d) => {
                        const { [p.id]: _, ...rest } = d;
                        return rest;
                      });
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    }}
                    className="w-14 rounded-sm border border-border bg-background px-1.5 py-0.5 mono text-xs text-center tabular-nums outline-none focus:border-terminal"
                    title="priority (higher = top)"
                  />

                  <span
                    className={`mono text-[10px] uppercase tracking-[0.14em] rounded-sm border px-2 py-0.5 ${STATUS_CLASS[p.status] ?? "border-border text-muted-foreground"}`}
                  >
                    {p.status}
                  </span>
                  <span className="mono text-[11px] text-muted-foreground tabular-nums">
                    {new Date(p.updated_at).toISOString().slice(0, 10).replace(/-/g, ".")}
                  </span>
                  <button
                    onClick={() => confirm(`archive "${p.title}"?`) && del.mutate(p.id)}
                    className="mono text-[11px] uppercase tracking-[0.14em] text-destructive/80 hover:text-destructive justify-self-end"
                  >
                    rm
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <p className="mt-4 mono text-[10px] text-terminal-dim">
        // pin toggles a post to the top of public listings. priority (higher wins) breaks ties among pinned or ordinary posts.
      </p>
    </div>
  );
}
