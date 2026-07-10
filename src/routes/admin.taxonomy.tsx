import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { listCategories, listTags } from "@/lib/blog.functions";
import { saveCategory, saveTag, deleteCategory, deleteTag } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/taxonomy")({
  component: Taxonomy,
});

function Taxonomy() {
  const qc = useQueryClient();
  const cats = useQuery({ queryKey: ["categories"], queryFn: () => listCategories() });
  const tags = useQuery({ queryKey: ["tags"], queryFn: () => listTags() });

  const [catName, setCatName] = useState("");
  const [catParent, setCatParent] = useState("");
  const [tagName, setTagName] = useState("");

  const addCat = useMutation({
    mutationFn: () => saveCategory({ data: { name: catName, parent_id: catParent || null } }),
    onSuccess: () => {
      setCatName("");
      setCatParent("");
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
  });
  const addTag = useMutation({
    mutationFn: () => saveTag({ data: { name: tagName } }),
    onSuccess: () => {
      setTagName("");
      qc.invalidateQueries({ queryKey: ["tags"] });
    },
  });
  const delCat = useMutation({
    mutationFn: (id: string) => deleteCategory({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });
  const delTag = useMutation({
    mutationFn: (id: string) => deleteTag({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tags"] }),
  });

  return (
    <div>
      <div className="mono text-[11px] uppercase tracking-[0.24em] text-terminal-dim mb-2">
        <span className="text-terminal">$</span> taxonomy --edit
      </div>
      <h1 className="text-3xl font-semibold tracking-tight mb-8">Taxonomy</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <section className="rounded-md border border-border bg-surface p-5">
          <h2 className="mono text-sm uppercase tracking-[0.14em] text-terminal mb-4">/categories</h2>
          <div className="flex gap-2 mb-4">
            <input
              value={catName}
              onChange={(e) => setCatName(e.target.value)}
              placeholder="name"
              className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 mono text-sm outline-none focus:border-terminal focus:ring-2 focus:ring-terminal/30"
            />
            <select
              value={catParent}
              onChange={(e) => setCatParent(e.target.value)}
              className="rounded-md border border-border bg-background px-2 py-1.5 mono text-sm outline-none focus:border-terminal"
            >
              <option value="">— top level —</option>
              {(cats.data ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={() => catName && addCat.mutate()}
              className="rounded-md bg-terminal px-3 py-1.5 mono text-xs uppercase tracking-[0.14em] text-primary-foreground hover:brightness-110 transition"
            >
              add
            </button>
          </div>
          <ul className="divide-y divide-border/70">
            {(cats.data ?? []).length === 0 && (
              <li className="mono text-xs text-muted-foreground py-3">// empty</li>
            )}
            {(cats.data ?? []).map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2.5">
                <div>
                  <span className="text-sm text-foreground">{c.name}</span>{" "}
                  <span className="mono text-[11px] text-terminal-dim">/{c.slug}</span>
                </div>
                <button
                  onClick={() => confirm("delete category?") && delCat.mutate(c.id)}
                  className="mono text-[11px] uppercase tracking-[0.14em] text-destructive/80 hover:text-destructive"
                >
                  rm
                </button>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-md border border-border bg-surface p-5">
          <h2 className="mono text-sm uppercase tracking-[0.14em] text-terminal mb-4">#tags</h2>
          <div className="flex gap-2 mb-4">
            <input
              value={tagName}
              onChange={(e) => setTagName(e.target.value)}
              placeholder="name"
              className="flex-1 rounded-md border border-border bg-background px-2 py-1.5 mono text-sm outline-none focus:border-terminal focus:ring-2 focus:ring-terminal/30"
            />
            <button
              onClick={() => tagName && addTag.mutate()}
              className="rounded-md bg-terminal px-3 py-1.5 mono text-xs uppercase tracking-[0.14em] text-primary-foreground hover:brightness-110 transition"
            >
              add
            </button>
          </div>
          <ul className="flex flex-wrap gap-2">
            {(tags.data ?? []).length === 0 && (
              <li className="mono text-xs text-muted-foreground">// empty</li>
            )}
            {(tags.data ?? []).map((t) => (
              <li key={t.id} className="terminal-chip flex items-center gap-2 group hover:terminal-chip-active">
                #{t.name}
                <button
                  onClick={() => confirm("delete tag?") && delTag.mutate(t.id)}
                  className="opacity-60 hover:opacity-100 text-destructive"
                  aria-label="delete tag"
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
