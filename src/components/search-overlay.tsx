import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import Fuse from "fuse.js";
import { Search as SearchIcon, X } from "lucide-react";
import { listPublishedPosts } from "@/lib/blog.functions";
import { useDebounce } from "@/hooks/use-debounce";

type PostHit = {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  published_at: string | null;
  category: { slug: string; name: string } | null;
};

export function SearchOverlay({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const debounced = useDebounce(q, 120);
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ["search-index"],
    queryFn: () => listPublishedPosts({ data: { limit: 50, offset: 0 } }),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  const posts = (data?.posts ?? []) as PostHit[];

  const fuse = useMemo(
    () =>
      new Fuse(posts, {
        keys: [
          { name: "title", weight: 0.6 },
          { name: "excerpt", weight: 0.25 },
          { name: "category.name", weight: 0.15 },
        ],
        threshold: 0.4,
        ignoreLocation: true,
        includeMatches: true,
        minMatchCharLength: 2,
      }),
    [posts],
  );

  const results = useMemo(() => {
    const term = debounced.trim();
    if (!term) return posts.slice(0, 8).map((p) => ({ item: p, score: 0 }));
    return fuse.search(term, { limit: 10 });
  }, [debounced, fuse, posts]);

  useEffect(() => {
    setCursor(0);
  }, [debounced]);

  useEffect(() => {
    if (!open) return;
    setQ("");
    setCursor(0);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, Math.max(0, results.length - 1)));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(0, c - 1));
      } else if (e.key === "Enter") {
        const hit = results[cursor];
        if (hit) {
          e.preventDefault();
          navigate({ to: "/posts/$slug", params: { slug: hit.item.slug } });
          onClose();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, results, cursor, navigate, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-start justify-center px-4 pt-[10vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-2xl rounded-md border border-border bg-surface shadow-2xl overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-terminal/70" />
          <span className="ml-2 mono text-[11px] text-muted-foreground">search — grep ./posts</span>
          <button
            onClick={onClose}
            className="ml-auto rounded-sm p-1 text-muted-foreground hover:text-terminal hover:bg-accent/40 transition"
            aria-label="close search"
          >
            <X size={14} />
          </button>
        </div>

        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <SearchIcon size={16} className="text-terminal" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="grep pattern…"
            className="flex-1 bg-transparent outline-none mono text-sm placeholder:text-muted-foreground"
            spellCheck={false}
            autoComplete="off"
          />
          <kbd className="mono text-[10px] text-terminal-dim border border-border rounded-sm px-1.5 py-0.5">
            ESC
          </kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {results.length === 0 && debounced.trim() && (
            <p className="mono text-xs text-muted-foreground p-6 text-center">
              <span className="text-terminal-dim">//</span> no matches for "{debounced}"
            </p>
          )}
          {results.length === 0 && !debounced.trim() && (
            <p className="mono text-xs text-muted-foreground p-6 text-center">
              <span className="text-terminal-dim">//</span> type to search titles, excerpts, categories…
            </p>
          )}
          <ul>
            {results.map((r, i) => {
              const p = r.item;
              const active = i === cursor;
              return (
                <li key={p.id}>
                  <button
                    onMouseEnter={() => setCursor(i)}
                    onClick={() => {
                      navigate({ to: "/posts/$slug", params: { slug: p.slug } });
                      onClose();
                    }}
                    className={`w-full text-left px-4 py-3 border-b border-border/60 last:border-b-0 transition ${
                      active ? "bg-accent/40" : "hover:bg-accent/30"
                    }`}
                  >
                    <div className="flex items-baseline gap-3">
                      <span className="mono text-[11px] text-terminal-dim shrink-0">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <span
                        className={`text-sm font-medium ${active ? "text-terminal" : "text-foreground"}`}
                      >
                        {p.title}
                      </span>
                    </div>
                    {p.excerpt && (
                      <p className="mt-1 pl-8 text-xs text-muted-foreground line-clamp-2">
                        {p.excerpt}
                      </p>
                    )}
                    <div className="mt-1.5 pl-8 flex gap-3 mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {p.published_at && (
                        <time className="text-terminal-dim">
                          {new Date(p.published_at).toISOString().slice(0, 10).replace(/-/g, ".")}
                        </time>
                      )}
                      {p.category && (
                        <span>
                          <span className="text-terminal-dim">cat=</span>
                          {p.category.name}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center gap-3 px-4 py-2 border-t border-border mono text-[10px] uppercase tracking-[0.14em] text-terminal-dim">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>esc close</span>
        </div>
      </div>
    </div>
  );
}
