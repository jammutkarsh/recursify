"use client";

import { CalendarCheck, ChartNoAxesColumn, LibraryBig, Plus, Search, Settings as Gear } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useApp } from "@/context/AppData";
import { cn } from "@/lib/utils";
import { ListPicker, SearchPanel, SettingsDialog, ShortcutsDialog, useKey } from "./overlays";
import { Kbd, KeyHints } from "./ui";

const RAMP = ["#216E39", "#30A14E", "#40C463", "#9BE9A8", "#EBEDF0", "#30A14E"];
export function LogoMark({ size = 22 }: { size?: number }) {
  const v = (k: number) => { const a = ((-120 + 60 * k) * Math.PI) / 180; return `${32 + 31 * Math.cos(a)} ${32 + 31 * Math.sin(a)}`; };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      {RAMP.map((c, k) => <path key={k} d={`M32 32 L${v(k)} L${v(k + 1)} Z`} fill={c} stroke="#fff" strokeWidth={1.5} />)}
    </svg>
  );
}

export const isTyping = (e: KeyboardEvent) => {
  const t = e.target as HTMLElement | null;
  return !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable);
};

const FOOTERS: Record<string, [string[], string][]> = {
  "/today": [[["J", "K"], "move"], [["Enter"], "open on LeetCode"], [["1", "–", "4"], "grade focused"], [["Z"], "undo"], [["Esc"], "clear"]],
  "/library": [[["J", "K"], "move"], [["Enter"], "open"], [["T"], "pick topic"], [["G", "T"], "go to Today"]],
  "/progress": [[["G", "T"], "go to Today"], [["G", "L"], "Library"], [["?"], "keys"]],
};

export function AppShell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const { model, data } = useApp();
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<null | "keys" | "settings" | "lists">(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const gPending = useRef(0);

  useKey((e) => {
    if (e.key === "Escape") { setDialog(null); setQuery(""); searchRef.current?.blur(); return; }
    if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (Date.now() - gPending.current < 1000) {
      gPending.current = 0;
      const to = { t: "/today", l: "/library", p: "/progress" }[e.key.toLowerCase()];
      if (to) { e.preventDefault(); router.push(to); }
      return;
    }
    if (e.key === "g") { gPending.current = Date.now(); return; }
    if (e.key === "/") { e.preventDefault(); searchRef.current?.focus(); }
    else if (e.key === "?") setDialog((d) => (d === "keys" ? null : "keys"));
    else if (e.key === ",") setDialog((d) => (d === "settings" ? null : "settings"));
    else if (e.key === "l") setDialog((d) => (d === "lists" ? null : "lists"));
    else if (e.key === "a") { e.preventDefault(); if (path === "/today") window.dispatchEvent(new Event("recursify:log")); else router.push("/today?log=1"); }
  });

  useReminder();
  const polyName = model?.list(data?.settings.followedLists[0] ?? "neetcode150").name ?? "Lists";
  const extra = (data?.settings.followedLists.length ?? 1) - 1;
  const nav = [["/today", "Today"], ["/library", "Library"], ["/progress", "Progress"]];

  return (
    <div className="flex h-dvh flex-col">
      <header className="relative z-30 flex shrink-0 items-center gap-4 border-b border-border bg-card px-4 py-3 md:px-8">
        <Link href="/today" className="flex items-center gap-2 text-base font-bold"><LogoMark />Recursify</Link>
        <nav className="hidden items-center gap-5 text-sm md:flex">
          {nav.map(([href, label]) => (
            <Link key={href} href={href} aria-current={path === href ? "page" : undefined} className={cn(path === href ? "font-semibold text-primary" : "text-muted-foreground hover:text-foreground")}>{label}</Link>
          ))}
        </nav>
        <div className="relative hidden md:block">
          <button type="button" onClick={() => setDialog((d) => (d === "lists" ? null : "lists"))} aria-expanded={dialog === "lists"}
            className={cn("flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[13px]", dialog === "lists" ? "border-primary" : "border-border")}>
            <span className="font-medium">{polyName}</span>{extra > 0 ? <span className="font-mono text-[11px] text-muted-foreground">+{extra}</span> : null}<span className="text-[11px] text-muted-foreground">▾</span><Kbd>L</Kbd>
          </button>
          {dialog === "lists" ? <ListPicker onClose={() => setDialog(null)} /> : null}
        </div>
        <div className="flex flex-1 justify-center">
          <div className="relative w-full max-w-[400px]">
            <label className={cn("flex items-center gap-2 rounded-lg border bg-muted py-1.5 pr-2 pl-3", query ? "border-primary bg-card ring-1 ring-primary" : "border-border")}>
              <Search className="size-4 text-muted-foreground" />
              <input ref={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search problems or topics" aria-label="Search problems or topics"
                className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-muted-foreground" />
              <Kbd>/</Kbd>
            </label>
            <SearchPanel query={query} onClose={() => { setQuery(""); searchRef.current?.blur(); }} />
          </div>
        </div>
        <div className="hidden items-center gap-4 lg:flex">
          <button type="button" onClick={() => (path === "/today" ? window.dispatchEvent(new Event("recursify:log")) : router.push("/today?log=1"))} className="flex items-center gap-1 text-xs text-muted-foreground"><Kbd>A</Kbd>add</button>
          <button type="button" onClick={() => setDialog("keys")} className="flex items-center gap-1 text-xs text-muted-foreground"><Kbd>?</Kbd>keys</button>
        </div>
        <button type="button" onClick={() => setDialog("settings")} aria-label="Settings" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Gear className="size-4" /><Kbd className="hidden lg:inline-flex">,</Kbd><span className="hidden lg:inline">settings</span>
        </button>
      </header>
      <main id="main-content" className="min-h-0 flex-1">{children}</main>
      {FOOTERS[path] ? <footer className="hidden shrink-0 border-t border-border bg-card px-8 py-3 md:block"><KeyHints items={FOOTERS[path]} /></footer> : null}
      <MobileTabs path={path} onSettings={() => setDialog("settings")} />
      {dialog === "keys" ? <ShortcutsDialog onClose={() => setDialog(null)} /> : null}
      {dialog === "settings" ? <SettingsDialog onClose={() => setDialog(null)} /> : null}
    </div>
  );
}

/** Daily review reminder: a browser notification at the chosen time while the app is open and reviews are due. */
function useReminder() {
  const { data, model, today } = useApp();
  const due = model?.queue.length ?? 0;
  const reminder = data?.settings.reminder;
  useEffect(() => {
    if (!reminder?.enabled || typeof Notification === "undefined") return;
    const check = () => {
      const now = new Date();
      const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      let shown: string | null = null;
      try { shown = localStorage.getItem("recursify-reminded"); } catch { /* storage blocked */ }
      if (hhmm < reminder.time || shown === today || due === 0 || Notification.permission !== "granted") return;
      new Notification("Recursify", { body: `${due} ${due === 1 ? "review is" : "reviews are"} due today.`, icon: "/icon.png" });
      try { localStorage.setItem("recursify-reminded", today); } catch { /* storage blocked */ }
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, [reminder, due, today]);
}

function MobileTabs({ path, onSettings }: { path: string; onSettings: () => void }) {
  const tab = (active: boolean) => cn("flex flex-1 flex-col items-center gap-1 text-[11px]", active ? "font-semibold text-primary" : "font-medium text-muted-foreground");
  return (
    <nav aria-label="Primary" className="flex shrink-0 items-center border-t border-border bg-card pt-2.5 pb-[max(env(safe-area-inset-bottom),14px)] md:hidden">
      <Link href="/today" className={tab(path === "/today")}><CalendarCheck className="size-6" />Today</Link>
      <Link href="/library" className={tab(path === "/library")}><LibraryBig className="size-6" />Library</Link>
      <span className="flex flex-1 justify-center"><Link href="/today?log=1" aria-label="Log a solve" className="flex size-12 items-center justify-center rounded-full bg-primary text-primary-foreground"><Plus className="size-6" /></Link></span>
      <Link href="/progress" className={tab(path === "/progress")}><ChartNoAxesColumn className="size-6" />Progress</Link>
      <button type="button" onClick={onSettings} className={tab(false)}><Gear className="size-6" />Settings</button>
    </nav>
  );
}
