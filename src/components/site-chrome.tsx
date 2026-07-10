import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Search as SearchIcon, Sun, Moon } from "lucide-react";
import { profile } from "@/config/profile";
import { SearchOverlay } from "@/components/search-overlay";
import { useTheme } from "@/hooks/use-theme";

export function SiteHeader() {
  const [searchOpen, setSearchOpen] = useState(false);
  const { theme, toggle } = useTheme();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="border-b border-border/70 bg-background/85 backdrop-blur sticky top-0 z-40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link
            to="/"
            className="group flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground mono"
          >
            <span className="text-terminal">$</span>
            <span>{profile.handle}</span>
            <span className="ml-0.5 inline-block h-3.5 w-1.5 translate-y-[1px] bg-terminal group-hover:animate-pulse" aria-hidden />
          </Link>
          <nav className="flex items-center gap-1 text-xs mono uppercase tracking-[0.14em] text-muted-foreground">
            <NavLink to="/posts">~/posts</NavLink>
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="search"
              title="Search (⌘K)"
              className="rounded-sm px-2 py-1 hover:text-terminal hover:bg-accent/40 transition flex items-center gap-1.5"
            >
              <SearchIcon size={13} />
              <span className="hidden sm:inline">search</span>
              <kbd className="hidden md:inline mono text-[9px] text-terminal-dim border border-border rounded-sm px-1 py-0">
                ⌘K
              </kbd>
            </button>
            <button
              onClick={toggle}
              aria-label={theme === "dark" ? "switch to light theme" : "switch to dark theme"}
              title={theme === "dark" ? "light mode" : "dark mode"}
              className="rounded-sm px-2 py-1 hover:text-terminal hover:bg-accent/40 transition"
            >
              {theme === "dark" ? <Sun size={14} /> : <Moon size={14} />}
            </button>
          </nav>
        </div>
      </header>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeProps={{ className: "text-terminal bg-accent/40" }}
      className="rounded-sm px-2 py-1 hover:text-terminal hover:bg-accent/40 transition"
    >
      {children}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 mt-24">
      <div className="mx-auto max-w-5xl px-4 py-8 mono text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
        <span>
          <span className="text-terminal">#</span> © {new Date().getFullYear()} {profile.handle} — {profile.name}.
        </span>
      </div>
    </footer>
  );
}
