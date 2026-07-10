import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/admin/settings")({
  component: Settings,
});

function Settings() {
  return (
    <div className="max-w-2xl">
      <div className="mono text-[11px] uppercase tracking-[0.24em] text-terminal-dim mb-2">
        <span className="text-terminal">$</span> settings --secure
      </div>
      <h1 className="text-3xl font-semibold tracking-tight mb-8">Settings</h1>
      <MfaSection />
    </div>
  );
}

function MfaSection() {
  const [enrolling, setEnrolling] = useState(false);
  const [factors, setFactors] = useState<any[]>([]);
  const [enrollData, setEnrollData] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors(data?.totp ?? []);
  }
  useEffect(() => {
    refresh();
  }, []);

  async function startEnroll() {
    setErr(null);
    setEnrolling(true);
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: "totp" });
    if (error) {
      setErr(error.message);
      setEnrolling(false);
      return;
    }
    setEnrollData({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret });
  }

  async function verifyEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollData) return;
    const { data: ch, error: chErr } = await supabase.auth.mfa.challenge({ factorId: enrollData.id });
    if (chErr) return setErr(chErr.message);
    const { error } = await supabase.auth.mfa.verify({ factorId: enrollData.id, challengeId: ch.id, code });
    if (error) return setErr(error.message);
    setEnrollData(null);
    setCode("");
    setEnrolling(false);
    refresh();
  }

  async function unenroll(id: string) {
    if (!confirm("remove this authenticator?")) return;
    await supabase.auth.mfa.unenroll({ factorId: id });
    refresh();
  }

  return (
    <section className="rounded-md border border-border bg-surface p-5">
      <h2 className="mono text-sm uppercase tracking-[0.14em] text-terminal mb-2">2fa --totp</h2>
      <p className="mono text-xs text-muted-foreground mb-4 leading-relaxed">
        // add a TOTP authenticator (Authy, 1Password, Google Authenticator). required alongside password on next login.
      </p>
      {factors.length > 0 ? (
        <ul className="divide-y divide-border rounded-md border border-border">
          {factors.map((f) => (
            <li key={f.id} className="flex items-center justify-between px-3 py-2">
              <span className="mono text-xs">
                <span className="text-terminal">✓</span>{" "}
                {f.friendly_name || "authenticator"}{" "}
                <span className="text-terminal-dim">({f.status})</span>
              </span>
              <button
                onClick={() => unenroll(f.id)}
                className="mono text-[11px] uppercase tracking-[0.14em] text-destructive/80 hover:text-destructive"
              >
                remove
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mono text-xs text-muted-foreground">// no authenticators enrolled.</p>
      )}

      {!enrolling && (
        <button
          onClick={startEnroll}
          className="mt-4 rounded-md border border-border bg-background px-4 py-2 mono text-xs uppercase tracking-[0.14em] hover:border-terminal/50 hover:text-terminal transition"
        >
          + add authenticator
        </button>
      )}

      {enrollData && (
        <form onSubmit={verifyEnroll} className="mt-6 rounded-md border border-border bg-background p-4 space-y-3">
          <p className="mono text-xs text-muted-foreground">
            <span className="text-terminal">&gt;</span> scan the QR then enter the 6-digit code:
          </p>
          <img src={enrollData.qr} alt="TOTP QR code" className="border border-border rounded-md bg-white p-2" />
          <p className="mono text-[10px] text-muted-foreground break-all">
            secret: <span className="text-terminal">{enrollData.secret}</span>
          </p>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputMode="numeric"
            maxLength={6}
            className="rounded-md border border-border bg-background px-2 py-1 mono text-lg text-center tracking-[0.5em] outline-none focus:border-terminal focus:ring-2 focus:ring-terminal/30"
            placeholder="000000"
          />
          <button className="rounded-md bg-terminal px-4 py-2 mono text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground hover:brightness-110">
            verify & enable
          </button>
        </form>
      )}
      {err && (
        <p className="mt-2 mono text-xs text-destructive">
          <span>×</span> {err}
        </p>
      )}
    </section>
  );
}
