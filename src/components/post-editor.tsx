import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ReactMarkdown, markdownPlugins, slugify } from "@/lib/markdown";
import { savePost, listRevisions } from "@/lib/admin.functions";
import { listCategories, listTags } from "@/lib/blog.functions";

type Initial = {
  id?: string;
  title?: string;
  slug?: string;
  excerpt?: string | null;
  content_md?: string;
  cover_url?: string | null;
  status?: "draft" | "scheduled" | "published" | "archived";
  category_id?: string | null;
  scheduled_for?: string | null;
  seo_title?: string | null;
  seo_description?: string | null;
  canonical_url?: string | null;
  og_image_url?: string | null;
  tag_ids?: string[];
};

const STATUS_DOT: Record<string, string> = {
  draft: "bg-muted-foreground",
  scheduled: "bg-yellow-300",
  published: "bg-terminal",
  archived: "bg-destructive",
};

const inputBase =
  "w-full rounded-md border border-border bg-background px-3 py-2 mono text-sm outline-none focus:border-terminal focus:ring-2 focus:ring-terminal/30 transition";

export function PostEditor({
  initial,
  onSaved,
}: {
  initial?: Initial;
  onSaved?: (id: string) => void;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [content, setContent] = useState(initial?.content_md ?? "");
  const [cover, setCover] = useState(initial?.cover_url ?? "");
  const [status, setStatus] = useState<Initial["status"]>(initial?.status ?? "draft");
  const [categoryId, setCategoryId] = useState<string>(initial?.category_id ?? "");
  const [scheduledFor, setScheduledFor] = useState(initial?.scheduled_for ?? "");
  const [seoTitle, setSeoTitle] = useState(initial?.seo_title ?? "");
  const [seoDesc, setSeoDesc] = useState(initial?.seo_description ?? "");
  const [tagIds, setTagIds] = useState<string[]>(initial?.tag_ids ?? []);
  const [rightTab, setRightTab] = useState<"preview" | "revisions">("preview");

  const cats = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const tags = useQuery({ queryKey: ["tags"], queryFn: () => listTags() });
  const revisions = useQuery({
    queryKey: ["revisions", initial?.id],
    queryFn: () => listRevisions({ data: { post_id: initial!.id! } }),
    enabled: !!initial?.id,
  });

  const save = useMutation({
    mutationFn: () =>
      savePost({
        data: {
          id: initial?.id,
          title: title.trim(),
          slug: (slug || slugify(title)).trim(),
          excerpt: excerpt || null,
          content_md: content,
          cover_url: cover || null,
          status: status ?? "draft",
          category_id: categoryId || null,
          scheduled_for:
            status === "scheduled" && scheduledFor ? new Date(scheduledFor).toISOString() : null,
          seo_title: seoTitle || null,
          seo_description: seoDesc || null,
          canonical_url: null,
          og_image_url: null,
          tag_ids: tagIds,
        },
      }),
    onSuccess: ({ id }) => {
      qc.invalidateQueries({ queryKey: ["admin-posts"] });
      qc.invalidateQueries({ queryKey: ["admin-post", id] });
      qc.invalidateQueries({ queryKey: ["revisions", id] });
      onSaved?.(id);
    },
  });

  const autoSlug = useMemo(() => slugify(title), [title]);
  const wordCount = useMemo(() => content.trim().split(/\s+/).filter(Boolean).length, [content]);
  const readingMinutes = Math.max(1, Math.round(wordCount / 220));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left: editor */}
      <div className="space-y-4">
        <div className="rounded-md border border-border bg-surface">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border">
            <span
              className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[status ?? "draft"]}`}
              aria-hidden
            />
            <span className="mono text-[10px] uppercase tracking-[0.24em] text-terminal-dim">
              editor // {initial?.id ? "edit" : "new"}.md
            </span>
            <div className="ml-auto mono text-[10px] text-muted-foreground tabular-nums">
              {wordCount} words · ~{readingMinutes}min
            </div>
          </div>
          <div className="p-4 space-y-3">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title…"
              className="w-full text-2xl md:text-3xl font-semibold bg-transparent border-b border-border py-2 outline-none focus:border-terminal transition"
            />
            <div className="flex items-center gap-2 mono text-sm">
              <span className="text-terminal-dim">/posts/</span>
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder={autoSlug || "auto-slug"}
                className="flex-1 bg-transparent border-b border-border py-1 outline-none focus:border-terminal text-terminal transition"
              />
            </div>
            <textarea
              value={excerpt ?? ""}
              onChange={(e) => setExcerpt(e.target.value)}
              placeholder="excerpt — shown in listings & social previews"
              className={inputBase}
              rows={2}
            />
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="# Write in Markdown…"
              spellCheck={false}
              className={`${inputBase} font-mono leading-relaxed`}
              rows={22}
            />
          </div>
        </div>

        <div className="rounded-md border border-border bg-surface p-4 grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="mono text-[10px] uppercase tracking-[0.24em] text-terminal-dim">
              status
            </span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className={inputBase}
            >
              <option value="draft">draft</option>
              <option value="scheduled">scheduled</option>
              <option value="published">published</option>
              <option value="archived">archived</option>
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="mono text-[10px] uppercase tracking-[0.24em] text-terminal-dim">
              category
            </span>
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={inputBase}
            >
              <option value="">— none —</option>
              {(cats.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          {status === "scheduled" && (
            <label className="col-span-2 flex flex-col gap-1.5">
              <span className="mono text-[10px] uppercase tracking-[0.24em] text-terminal-dim">
                publish_at (local)
              </span>
              <input
                type="datetime-local"
                value={scheduledFor ?? ""}
                onChange={(e) => setScheduledFor(e.target.value)}
                className={inputBase}
              />
            </label>
          )}
          <label className="col-span-2 flex flex-col gap-1.5">
            <span className="mono text-[10px] uppercase tracking-[0.24em] text-terminal-dim">
              cover_url
            </span>
            <input
              value={cover ?? ""}
              onChange={(e) => setCover(e.target.value)}
              placeholder="https://…"
              className={inputBase}
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1.5">
            <span className="mono text-[10px] uppercase tracking-[0.24em] text-terminal-dim">
              seo.title
            </span>
            <input
              value={seoTitle ?? ""}
              onChange={(e) => setSeoTitle(e.target.value)}
              className={inputBase}
            />
          </label>
          <label className="col-span-2 flex flex-col gap-1.5">
            <span className="mono text-[10px] uppercase tracking-[0.24em] text-terminal-dim">
              seo.description
            </span>
            <textarea
              value={seoDesc ?? ""}
              onChange={(e) => setSeoDesc(e.target.value)}
              rows={2}
              className={inputBase}
            />
          </label>

          <div className="col-span-2">
            <span className="block mono text-[10px] uppercase tracking-[0.24em] text-terminal-dim mb-2">
              tags
            </span>
            {(tags.data ?? []).length === 0 && (
              <p className="mono text-xs text-muted-foreground">
                // no tags yet — add some in <span className="text-terminal">./taxonomy</span>.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              {(tags.data ?? []).map((t) => {
                const active = tagIds.includes(t.id);
                return (
                  <button
                    type="button"
                    key={t.id}
                    onClick={() =>
                      setTagIds((prev) =>
                        active ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                      )
                    }
                    className={`terminal-chip ${active ? "terminal-chip-active text-terminal" : "hover:text-terminal"}`}
                  >
                    #{t.name}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => save.mutate()}
            disabled={save.isPending || !title.trim()}
            className="rounded-md bg-terminal px-5 py-2.5 mono text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground hover:brightness-110 transition disabled:opacity-50"
          >
            {save.isPending ? "committing…" : "✓ save"}
          </button>
          {save.isError && (
            <span className="mono text-xs text-destructive">× {(save.error as Error).message}</span>
          )}
          {save.isSuccess && <span className="mono text-xs text-terminal">✓ committed</span>}
        </div>
      </div>

      {/* Right: preview / revisions */}
      <div className="lg:sticky lg:top-24 self-start">
        <div className="rounded-md border border-border bg-surface">
          <div className="flex items-center gap-1 px-3 py-2 border-b border-border">
            <TabBtn active={rightTab === "preview"} onClick={() => setRightTab("preview")}>
              preview.md
            </TabBtn>
            <TabBtn active={rightTab === "revisions"} onClick={() => setRightTab("revisions")}>
              revisions ({revisions.data?.length ?? 0})
            </TabBtn>
          </div>
          {rightTab === "preview" ? (
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              <h1 className="text-3xl font-semibold tracking-tight">
                {title || <span className="text-muted-foreground italic">Untitled</span>}
              </h1>
              {excerpt && <p className="mt-2 text-muted-foreground">{excerpt}</p>}
              <hr className="ascii-divider my-6" />
              <div className="article-content max-w-none">
                <ReactMarkdown {...markdownPlugins}>{content || "*Start writing…*"}</ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="p-4 max-h-[80vh] overflow-y-auto">
              {!initial?.id && (
                <p className="mono text-xs text-muted-foreground">
                  // save this post first to start a revision log.
                </p>
              )}
              {revisions.data && revisions.data.length === 0 && (
                <p className="mono text-xs text-muted-foreground">// no revisions yet.</p>
              )}
              {revisions.data && revisions.data.length > 0 && (
                <ol className="space-y-3">
                  {revisions.data.map((r: any, i: number) => (
                    <li
                      key={r.id}
                      className="flex items-baseline gap-3 mono text-xs border-l-2 border-terminal/40 pl-3"
                    >
                      <span className="text-terminal-dim tabular-nums shrink-0">
                        r{String(revisions.data.length - i).padStart(3, "0")}
                      </span>
                      <div className="flex-1">
                        <div className="text-foreground">{r.title}</div>
                        <div className="text-muted-foreground">
                          {new Date(r.created_at).toLocaleString()}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`mono text-[11px] uppercase tracking-[0.14em] rounded-sm px-2 py-1 transition ${
        active
          ? "text-terminal bg-accent/40"
          : "text-muted-foreground hover:text-terminal hover:bg-accent/40"
      }`}
    >
      {children}
    </button>
  );
}
