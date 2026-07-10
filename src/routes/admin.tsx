import { createFileRoute, Outlet, Link, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({ meta: [{ name: "robots", content: "noindex, nofollow" }] }),
  component: AdminLayout,
  errorComponent: AdminErrorBoundary,
});

function AdminErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  console.error("[/admin] error boundary:", error);
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="max-w-md w-full rounded-md border border-border bg-surface">
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
          <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
          <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
          <span className="h-2.5 w-2.5 rounded-full bg-terminal/70" />
          <span className="ml-2 mono text-[11px] text-muted-foreground">
            admin — connection error
          </span>
        </div>
        <div className="p-5 mono text-sm">
          <p className="text-destructive">× auth channel unavailable</p>
          <p className="mt-2 text-xs text-muted-foreground break-words">
            {error?.message || "unknown error"}
          </p>
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="mt-5 w-full rounded-md bg-terminal text-primary-foreground py-2 text-xs font-semibold uppercase tracking-[0.14em] hover:brightness-110 transition"
          >
            retry
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminLayout() {
  const [session, setSession] = useState<any>(null);
  const [aal, setAal] = useState<{ currentLevel: string | null; nextLevel: string | null } | null>(
    null,
  );
  const [ready, setReady] = useState(false);

  async function refreshAal() {
    const { data } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setAal({ currentLevel: data?.currentLevel ?? null, nextLevel: data?.nextLevel ?? null });
  }

  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error; // إذا كان هناك خطأ في الجلسة، ارمِ الخطأ

        setSession(data.session);

        if (data.session) {
          await refreshAal();
        }
      } catch (err) {
        console.error("Session initialization failed:", err);
        setSession(null); // في حال فشل الجلسة، نعتبر المستخدم غير مسجل دخول
      } finally {
        setReady(true); // هذا السطر سيعمل دائماً مهما حدث، ولن تعلق الصفحة أبداً
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange(async (_e, s) => {
      setSession(s);
      if (s) await refreshAal();
      else setAal(null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready)
    return (
      <div className="min-h-screen flex items-center justify-center mono text-sm text-terminal animate-pulse">
        initializing session…
      </div>
    );

  if (!session) return <SignIn />;

  const needsMfa = aal?.nextLevel === "aal2" && aal?.currentLevel !== "aal2";
  if (needsMfa) return <MfaChallenge onVerified={refreshAal} />;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/70 bg-surface/60 backdrop-blur">
        <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-1 mono text-xs uppercase tracking-[0.14em]">
            <Link
              to="/admin"
              className="flex items-center gap-2 rounded-sm px-2 py-1 text-terminal hover:bg-accent/40"
            >
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-terminal animate-pulse" />
              root@admin
            </Link>
            <span className="text-terminal-dim px-1">:</span>
            <Link
              to="/admin/posts"
              activeOptions={{ exact: false }}
              activeProps={{ className: "text-terminal bg-accent/40" }}
              className="rounded-sm px-2 py-1 text-muted-foreground hover:text-terminal hover:bg-accent/40 transition"
            >
              posts
            </Link>
            <Link
              to="/admin/taxonomy"
              activeOptions={{ exact: false }}
              activeProps={{ className: "text-terminal bg-accent/40" }}
              className="rounded-sm px-2 py-1 text-muted-foreground hover:text-terminal hover:bg-accent/40 transition"
            >
              taxonomy
            </Link>
            <Link
              to="/admin/settings"
              activeOptions={{ exact: false }}
              activeProps={{ className: "text-terminal bg-accent/40" }}
              className="rounded-sm px-2 py-1 text-muted-foreground hover:text-terminal hover:bg-accent/40 transition"
            >
              settings
            </Link>
          </div>
          <button
            onClick={async () => {
              await supabase.auth.signOut();
              window.location.href = "/";
            }}
            className="mono text-xs uppercase tracking-[0.14em] text-muted-foreground hover:text-destructive transition rounded-sm px-2 py-1"
          >
            exit
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

function SignIn() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (e: any) {
      setErr(e.message ?? "Sign-in failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell subtitle="password + totp required · session bound to browser" err={err}>
      <form onSubmit={handlePassword} className="space-y-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email"
          autoComplete="email"
          className="w-full rounded-md border border-border bg-background px-3 py-2 mono text-sm outline-none focus:border-terminal focus:ring-2 focus:ring-terminal/30"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          autoComplete="current-password"
          className="w-full rounded-md border border-border bg-background px-3 py-2 mono text-sm outline-none focus:border-terminal focus:ring-2 focus:ring-terminal/30"
        />
        <button
          type="submit"
          disabled={busy}
          className="w-full rounded-md bg-terminal text-primary-foreground py-2 mono text-sm font-semibold uppercase tracking-[0.14em] disabled:opacity-50 hover:brightness-110 transition"
        >
          {busy ? "…" : "continue"}
        </button>
      </form>
    </AuthShell>
  );
}

function MfaChallenge({ onVerified }: { onVerified: () => Promise<void> | void }) {
  const [otp, setOtp] = useState("");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { data: factors, error } = await supabase.auth.mfa.listFactors();
        if (error) throw error;
        const totp = factors?.totp?.find((f) => f.status === "verified") ?? factors?.totp?.[0];
        if (!totp) throw new Error("No TOTP factor enrolled");
        const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: totp.id });
        if (chErr) throw chErr;
        setFactorId(totp.id);
        setChallengeId(ch.id);
      } catch (e: any) {
        setErr(e.message ?? "MFA setup failed");
      }
    })();
  }, []);

  async function handleOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!factorId || !challengeId) return;
    setBusy(true);
    setErr(null);
    try {
      const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code: otp });
      if (error) throw error;
      await onVerified();
    } catch (e: any) {
      setErr(e.message ?? "Invalid code");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AuthShell subtitle="second factor required · enter TOTP" err={err}>
      <form onSubmit={handleOtp} className="space-y-3">
        <p className="mono text-xs text-muted-foreground">
          <span className="text-terminal">&gt;</span> enter 6-digit TOTP code
        </p>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          required
          value={otp}
          onChange={(e) => setOtp(e.target.value)}
          placeholder="000000"
          className="w-full rounded-md border border-border bg-background px-3 py-2 mono text-lg text-center tracking-[0.5em] outline-none focus:border-terminal focus:ring-2 focus:ring-terminal/30"
        />
        <button
          type="submit"
          disabled={busy || !factorId}
          className="w-full rounded-md bg-terminal text-primary-foreground py-2 mono text-sm font-semibold uppercase tracking-[0.14em] disabled:opacity-50 hover:brightness-110 transition"
        >
          {busy ? "…" : "verify"}
        </button>
        <button
          type="button"
          onClick={async () => {
            await supabase.auth.signOut();
          }}
          className="w-full mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground hover:text-destructive transition"
        >
          cancel · sign out
        </button>
      </form>
    </AuthShell>
  );
}

function AuthShell({
  subtitle,
  err,
  children,
}: {
  subtitle: string;
  err: string | null;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 rounded-md border border-border bg-surface">
          <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
            <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40" />
            <span className="h-2.5 w-2.5 rounded-full bg-terminal/70" />
            <span className="ml-2 mono text-[11px] text-muted-foreground">auth — ssh session</span>
          </div>
          <div className="p-5">
            <p className="mono text-[11px] text-terminal-dim mb-1">$ ./login --secure</p>
            <h1 className="mono text-lg font-semibold mb-1">
              <span className="text-terminal">&gt;</span> authenticate
            </h1>
            <p className="mono text-[11px] text-muted-foreground mb-4">{subtitle}</p>
            {err && (
              <p className="mb-4 mono text-xs text-destructive">
                <span className="text-destructive">×</span> {err}
              </p>
            )}
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
