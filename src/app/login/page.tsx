"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogoMark } from "@/components/app/AppShell";
import { Kbd } from "@/components/app/ui";
import { cn } from "@/lib/utils";

export default function LoginPage() {
  const [token, setToken] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token }) });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(res.status === 401 ? "That token didn't match. Check SITE_TOKEN in your Cloudflare Worker secrets." : data.error || "Sign-in failed");
        return;
      }
      router.push("/today");
      router.refresh();
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main id="main-content" className="flex min-h-dvh items-center justify-center bg-background p-4">
      <form onSubmit={submit} className="flex w-full max-w-[420px] flex-col items-center gap-5 rounded-xl border border-border bg-card px-9 py-9 shadow-xl">
        <LogoMark size={56} />
        <div className="text-center">
          <h1 className="text-[28px] font-bold">Recursify</h1>
          <p className="text-sm text-muted-foreground">Solve it. Let it fade. Recur.</p>
        </div>
        <label className="w-full space-y-1.5">
          <span className="text-[13px] font-medium">Site token</span>
          <input type="password" autoFocus required autoComplete="current-password" value={token} onChange={(e) => setToken(e.target.value)} aria-invalid={!!error}
            className={cn("w-full rounded-lg border bg-card px-3 py-2.5 text-sm outline-none focus:border-2 focus:border-primary", error ? "border-2 border-forgot" : "border-border")} />
          <span className={cn("block text-xs", error ? "text-forgot-text" : "text-muted-foreground")} role={error ? "alert" : undefined}>
            {error || "Set as SITE_TOKEN in your Cloudflare Worker secrets"}
          </span>
        </label>
        <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60">
          {loading ? "Signing in…" : "Sign in"} <Kbd onPrimary>↵</Kbd>
        </button>
        <p className="text-xs text-muted-foreground">Self-hosted · your data stays in your D1</p>
        <p className="-mt-3 text-xs text-muted-foreground">made by <a href="https://x.com/jammutkarsh" className="hover:text-foreground">@jammutkarsh</a></p>
      </form>
    </main>
  );
}
