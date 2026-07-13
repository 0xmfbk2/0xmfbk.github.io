import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  getViewStats,
  getPostViewLog,
  exportPostViews,
  clearPostViews,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/analytics")({
  component: Analytics,
});

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

async function handleExport(format: "json" | "ndjson", postId?: string) {
  const rows = await exportPostViews({ data: { post_id: postId } });
  const stamp = new Date().toISOString().slice(0, 10);
  if (format === "json") {
    downloadFile(JSON.stringify(rows, null, 2), `post-views-${stamp}.json`, "application/json");
  } else {
    const ndjson = rows.map((r: any) => JSON.stringify(r)).join("\n");
    downloadFile(ndjson, `post-views-${stamp}.ndjson`, "application/x-ndjson");
  }
}

async function handleClear(postId?: string, onDone?: () => void) {
  const label = postId ? "this article" : "all site records";
  const typed = window.prompt(`Type "DELETE" to confirm — ${label} will be permanently deleted`);
  if (typed !== "DELETE") return;
  await clearPostViews({ data: { post_id: postId, confirm: true } });
  onDone?.();
}

function Analytics() {
  const {
    data: stats,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["admin-views"],
    queryFn: () => getViewStats(),
  });
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  const totalViews = (stats ?? []).reduce((sum, s) => sum + Number(s.total_views), 0);
  const totalUnique = (stats ?? []).reduce((sum, s) => sum + Number(s.unique_visitors), 0);

  return (
    <div>
      <div className="mono text-[11px] uppercase tracking-[0.24em] text-terminal-dim mb-2">
        <span className="text-terminal">$</span> analytics --visitors
      </div>
      <h1 className="text-3xl font-semibold tracking-tight mb-8">
        Analytics <span className="mono text-terminal">_</span>
      </h1>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
        <StatCard label="total posts tracked" value={stats?.length ?? 0} />
        <StatCard label="total views" value={totalViews} />
        <StatCard label="unique visitors" value={totalUnique} />
      </div>

      <div className="flex flex-wrap gap-2 mb-10">
        <button
          onClick={() => handleExport("json")}
          className="mono text-[11px] uppercase tracking-[0.14em] rounded-md border border-border px-3 py-1.5 hover:border-terminal/50 hover:text-terminal transition"
        >
          export json
        </button>
        <button
          onClick={() => handleExport("ndjson")}
          className="mono text-[11px] uppercase tracking-[0.14em] rounded-md border border-border px-3 py-1.5 hover:border-terminal/50 hover:text-terminal transition"
        >
          export ndjson (splunk)
        </button>
        <button
          onClick={() => handleClear(undefined, refetch)}
          className="mono text-[11px] uppercase tracking-[0.14em] rounded-md border border-destructive/50 text-destructive px-3 py-1.5 hover:bg-destructive/10 transition"
        >
          clear all logs
        </button>
      </div>

      {isLoading && <p className="mono text-xs text-terminal animate-pulse">loading manifest…</p>}

      {!isLoading && (stats ?? []).length === 0 && (
        <p className="mono text-sm text-muted-foreground">// no views recorded yet</p>
      )}

      {!isLoading && (stats ?? []).length > 0 && (
        <div className="rounded-md border border-border bg-surface overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border mono text-[10px] uppercase tracking-[0.14em] text-terminal-dim">
                <th className="text-left px-4 py-3">post</th>
                <th className="text-right px-4 py-3">views</th>
                <th className="text-right px-4 py-3">unique</th>
                <th className="text-right px-4 py-3">last visit</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70">
              {(stats ?? []).map((s) => (
                <>
                  <tr key={s.post_id} className="hover:bg-accent/20 transition">
                    <td className="px-4 py-3">
                      <p className="font-medium">{s.title}</p>
                      <p className="mono text-[11px] text-muted-foreground">/{s.slug}</p>
                    </td>
                    <td className="px-4 py-3 text-right mono tabular-nums">{s.total_views}</td>
                    <td className="px-4 py-3 text-right mono tabular-nums text-terminal">
                      {s.unique_visitors}
                    </td>
                    <td className="px-4 py-3 text-right mono text-[11px] text-muted-foreground">
                      {s.last_viewed_at ? new Date(s.last_viewed_at).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        onClick={() =>
                          setSelectedPostId(selectedPostId === s.post_id ? null : s.post_id)
                        }
                        className="mono text-[11px] uppercase tracking-[0.14em] text-terminal hover:underline"
                      >
                        {selectedPostId === s.post_id ? "hide log" : "view log"}
                      </button>
                      <button
                        onClick={() => handleClear(s.post_id, refetch)}
                        className="mono text-[11px] uppercase tracking-[0.14em] text-destructive/70 hover:text-destructive hover:underline ml-3"
                      >
                        clear
                      </button>
                    </td>
                  </tr>
                  {selectedPostId === s.post_id && (
                    <tr>
                      <td colSpan={5} className="px-4 py-4 bg-background/40">
                        <ViewLog postId={s.post_id} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-surface p-4">
      <p className="mono text-[10px] uppercase tracking-[0.24em] text-terminal-dim">{label}</p>
      <p className="mt-3 mono text-3xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}

function ViewLog({ postId }: { postId: string }) {
  const { data: log, isLoading } = useQuery({
    queryKey: ["admin-view-log", postId],
    queryFn: () => getPostViewLog({ data: { post_id: postId, limit: 100 } }),
  });

  if (isLoading) return <p className="mono text-xs text-terminal animate-pulse">loading log…</p>;
  if (!log || log.length === 0)
    return <p className="mono text-xs text-muted-foreground">// no visits logged</p>;

  return (
    <div className="max-h-64 overflow-y-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="mono text-[10px] uppercase tracking-[0.14em] text-terminal-dim">
            <th className="text-left py-1.5">ip</th>
            <th className="text-left py-1.5">user agent</th>
            <th className="text-left py-1.5">referrer</th>
            <th className="text-right py-1.5">time</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50 mono">
          {log.map((v: any) => (
            <tr key={v.id}>
              <td className="py-1.5 tabular-nums">{v.ip_address}</td>
              <td className="py-1.5 text-muted-foreground truncate max-w-[220px]">
                {v.user_agent ?? "—"}
              </td>
              <td className="py-1.5 text-muted-foreground truncate max-w-[160px]">
                {v.referrer ?? "—"}
              </td>
              <td className="py-1.5 text-right text-muted-foreground">
                {new Date(v.viewed_at).toLocaleString()}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
