"use client";

import { Check, Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useApp } from "@/context/AppData";
import { BUILTIN_LISTS, builtinProblem, type Problem } from "@/lib/catalog";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { useTheme, type Theme } from "@/lib/theme";
import { InfoTip, Kbd, Meta, describeDue } from "./ui";

export function Overlay({ onClose, children, className, label }: { onClose: () => void; children: ReactNode; className?: string; label: string }) {
  useKey((e) => { if (e.key === "Escape") onClose(); });
  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={label}>
      <div className="absolute inset-0 bg-[var(--scrim)] animate-in fade-in-0 duration-200" onClick={onClose} />
      <div className="absolute inset-x-0 flex justify-center px-4" style={{ top: 0 }}>
        <div className={cn("relative rounded-xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200 ease-out", className)}>{children}</div>
      </div>
    </div>
  );
}

const ALL_PROBLEMS: Problem[] = [...new Map(BUILTIN_LISTS.flatMap((l) => l.sections.map((s) => [s.id, builtinProblem(s.id)!]))).values()];

/** Header search results: topics, problems, add action. ↑↓ move, ↵ open, Tab = all results in Library. */
export function SearchPanel({ query, onClose }: { query: string; onClose: () => void }) {
  const { model, data, addCustom } = useApp();
  const router = useRouter();
  const [sel, setSel] = useState(0);
  const q = query.trim().toLowerCase();
  type R = { kind: "topic"; name: string; total: number } | { kind: "problem"; p: Problem } | { kind: "add" };
  const results = useMemo<R[]>(() => {
    if (!q || !model || !data) return [];
    const topics = model.polygon.filter((s) => s.name.toLowerCase().includes(q)).slice(0, 3).map((s) => ({ kind: "topic" as const, name: s.name, total: s.total }));
    const problems = [...ALL_PROBLEMS, ...data.customProblems].filter((p) => p.title.toLowerCase().includes(q)).slice(0, 6).map((p) => ({ kind: "problem" as const, p }));
    return [...topics, ...problems, { kind: "add" as const }];
  }, [q, model, data]);
  useEffect(() => setSel(0), [q]);

  const open = async (i: number) => {
    const r = results[i]; if (!r) return;
    onClose();
    if (r.kind === "topic") router.push(`/library?topic=${encodeURIComponent(r.name)}`);
    else if (r.kind === "problem") router.push(`/library?p=${encodeURIComponent(r.p.id)}`);
    else { const id = await addCustom({ title: query.trim() }); if (id) router.push(`/library?p=${id}`); }
  };
  useKey((e) => {
    if (!q) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(results.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); open(sel); }
    else if (e.key === "Tab") { e.preventDefault(); onClose(); router.push(`/library?q=${encodeURIComponent(query.trim())}`); }
  });
  if (!q) return null;

  const hl = (title: string) => { const i = title.toLowerCase().indexOf(q); return i < 0 ? title : <>{title.slice(0, i)}<b className="font-semibold text-primary">{title.slice(i, i + q.length)}</b>{title.slice(i + q.length)}</>; };
  const label = { topic: "TOPICS", problem: "PROBLEMS", add: "ACTIONS" } as const;
  return (
    <div className="absolute top-full left-1/2 z-50 mt-2 w-[560px] max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in fade-in-0 slide-in-from-top-1 duration-150">
      {results.map((r, i) => {
        const t = r.kind === "problem" ? model?.tracked.get(r.p.id) : undefined;
        return (
          <div key={i}>
            {i === 0 || results[i - 1].kind !== r.kind ? <p className="px-3.5 pt-2.5 pb-1 font-mono text-[10px] text-muted-foreground">{label[r.kind]}</p> : null}
            <button type="button" onMouseEnter={() => setSel(i)} onClick={() => open(i)} className={cn("flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors", sel === i && "bg-primary-tint")}>
              {r.kind === "topic" ? <><span className="size-3 rounded-[3px] bg-heat-3" /><span className="flex-1 text-sm font-medium">{hl(r.name)}</span><span className="text-xs text-muted-foreground">{r.total} problems · open in Library</span></> : null}
              {r.kind === "problem" ? <><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{hl(r.p.title)}</span><Meta topic={r.p.topics[0]} difficulty={r.p.difficulty} /></span>
                <span className={cn("font-mono text-xs", t && t.daysLate > 0 ? "font-semibold text-forgot-text" : "text-muted-foreground")}>{t ? describeDue(t.daysLate) : "not solved"}</span></> : null}
              {r.kind === "add" ? <span className="text-sm font-medium text-primary">+ Add “{query.trim()}” to My list</span> : null}
              {sel === i ? <Kbd>↵</Kbd> : null}
            </button>
          </div>
        );
      })}
      <div className="flex gap-3.5 border-t border-border bg-muted px-3.5 py-2">
        {[["↑↓", "move"], ["↵", "open"], ["Tab", "all results in Library"], ["Esc", "close"]].map(([k, l]) => <span key={l} className="flex items-center gap-1 text-xs text-muted-foreground"><Kbd>{k}</Kbd>{l}</span>)}
      </div>
    </div>
  );
}

/** Subscribe to keydown while mounted. */
export function useKey(handler: (e: KeyboardEvent) => void) {
  const ref = useRef(handler);
  useEffect(() => { ref.current = handler; });
  useEffect(() => { const h = (e: KeyboardEvent) => ref.current(e); window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);
}

export function ListPicker({ onClose }: { onClose: () => void }) {
  const { data, model, saveSettings } = useApp();
  if (!data || !model) return null;
  const followed = new Set(data.settings.followedLists);
  const toggle = (id: string) => {
    const next = followed.has(id) ? [...followed].filter((x) => x !== id) : [...followed, id];
    if (next.length) saveSettings({ followedLists: next });
  };
  return (
    <div className="absolute top-full left-0 z-50 mt-2 w-[340px] overflow-hidden rounded-xl border border-border bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 slide-in-from-top-1 duration-150 origin-top-left">
      <p className="px-3.5 pt-2.5 pb-1 font-mono text-[10px] text-muted-foreground">LISTS YOU FOLLOW</p>
      {model.lists.map((l) => {
        const on = followed.has(l.id);
        const solved = l.sections.filter((s) => model.tracked.has(s.id)).length;
        return (
          <button key={l.id} type="button" onClick={() => toggle(l.id)} className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left transition-colors hover:bg-primary-tint">
            <span className={cn("flex size-4 items-center justify-center rounded-[4px]", on ? "bg-primary text-primary-foreground" : "border-[1.5px] border-icon-inactive")}>{on ? <Check className="size-3" strokeWidth={3} /> : null}</span>
            <span className={cn("flex-1 text-sm", on ? "font-medium" : "text-muted-foreground")}>{l.name}</span>
            <span className="font-mono text-xs text-muted-foreground">{solved}/{l.sections.length}</span>
          </button>
        );
      })}
      <div className="my-1 h-px bg-border" />
      <Link href="/library?import=1" onClick={onClose} className="flex items-center gap-2 px-3.5 py-2 text-sm font-medium text-primary hover:bg-primary-tint"><Plus className="size-4" />Import CSV to My list <Kbd className="ml-auto">U</Kbd></Link>
      <p className="px-3.5 pt-2 pb-3 text-xs text-muted-foreground">Reviews come from every list you follow. A problem in two lists shows up once.</p>
    </div>
  );
}

export function ShortcutsDialog({ onClose }: { onClose: () => void }) {
  const groups: [string, [string[], string][]][] = [
    ["QUEUE", [[["J", "K"], "Move down / up"], [["Enter"], "Open on LeetCode"], [["1", "–", "4"], "Grade focused problem"], [["Z"], "Undo last grade"]]],
    ["GO TO", [[["G", "T"], "Today"], [["G", "L"], "Library"], [["G", "P"], "Progress"], [["/"], "Search"], [[","], "Settings"]]],
    ["LOG", [[["A"], "Log a solve"], [["Tab"], "Next field"], [["Enter"], "Add"]]],
    ["GENERAL", [[["L"], "List picker"], [["?"], "This help"], [["Esc"], "Close dialog"]]],
  ];
  return (
    <Overlay onClose={onClose} label="Keyboard shortcuts" className="mt-[15vh] w-[720px] max-w-[calc(100vw-32px)] p-7">
      <div className="mb-5 flex items-center"><h2 className="flex-1 text-xl font-bold">Keyboard shortcuts</h2><Kbd>?</Kbd></div>
      <div className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
        {groups.map(([g, rows]) => (
          <div key={g} className="space-y-2.5">
            <p className="font-mono text-[11px] font-medium text-primary">{g}</p>
            {rows.map(([keys, label]) => <div key={label} className="flex items-center gap-1.5 text-sm text-foreground-2"><span className="flex-1">{label}</span>{keys.map((k) => <Kbd key={k}>{k}</Kbd>)}</div>)}
          </div>
        ))}
      </div>
    </Overlay>
  );
}

const RECALL_TIP = "Your chance of still remembering a problem when it comes back. FSRS schedules each review for the day your predicted recall drops to this value. Higher = shorter gaps and more reviews; lower = fewer reviews, more forgetting.";

export function SettingsDialog({ onClose }: { onClose: () => void }) {
  const { data, saveSettings } = useApp();
  if (!data) return null;
  const s = data.settings;
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const { theme, setTheme } = useTheme();
  const signOut = async () => { await fetch("/api/logout", { method: "POST" }); window.location.assign("/login"); };
  return (
    <Overlay onClose={onClose} label="Settings" className="mt-[8vh] max-h-[84vh] w-[560px] max-w-[calc(100vw-32px)] space-y-5 overflow-y-auto p-7">
      <div className="flex items-center"><h2 className="flex-1 text-xl font-bold">Settings</h2><Kbd>Esc</Kbd></div>
      <div className="flex items-center gap-4">
        <div className="flex-1"><p className="text-[13px] font-medium">Appearance</p><p className="text-xs text-muted-foreground">Light is the default</p></div>
        <div className="flex rounded-md bg-muted p-0.5" role="radiogroup" aria-label="Appearance">
          {(["light", "dark", "system"] as Theme[]).map((t) => (
            <button key={t} type="button" role="radio" aria-checked={theme === t} onClick={() => setTheme(t)}
              className={cn("rounded-[6px] px-3 py-1.5 text-[13px] capitalize transition-all", theme === t ? "bg-card font-semibold text-primary shadow-sm" : "text-muted-foreground hover:text-foreground")}>{t}</button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="flex-1"><p className="text-[13px] font-medium">New problems per day</p><p className="text-xs text-muted-foreground">Reviews always come first</p></div>
        <div className="flex overflow-hidden rounded-md border border-border">
          <button type="button" aria-label="Fewer" className="w-11 bg-muted py-2" onClick={() => saveSettings({ newPerDay: Math.max(0, s.newPerDay - 1) })}>−</button>
          <span className="w-14 py-2 text-center font-mono font-semibold">{s.newPerDay}</span>
          <button type="button" aria-label="More" className="w-11 bg-muted py-2" onClick={() => saveSettings({ newPerDay: Math.min(20, s.newPerDay + 1) })}>+</button>
        </div>
      </div>
      <div className="space-y-2">
        <div className="flex items-center gap-1.5"><label htmlFor="recall" className="text-[13px] font-medium">Target recall</label><InfoTip text={RECALL_TIP} /><span className="ml-auto font-mono text-sm font-semibold text-primary">{Math.round(s.targetRecall * 100)}%</span></div>
        <input id="recall" type="range" min={70} max={97} value={Math.round(s.targetRecall * 100)} onChange={(e) => saveSettings({ targetRecall: Number(e.target.value) / 100 })} className="w-full accent-primary" />
        <div className="flex justify-between text-[11px] text-muted-foreground"><span>70% · fewer reviews</span><span>97% · more reviews</span></div>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex-1"><p className="text-[13px] font-medium">Daily review reminder</p><p className="text-xs text-muted-foreground">Browser notification when reviews are due (while Recursify is open)</p></div>
        <input type="time" value={s.reminder.time} onChange={(e) => saveSettings({ reminder: { ...s.reminder, time: e.target.value } })} className="rounded-md border border-border bg-card px-3 py-2 text-sm" />
        <Switch aria-label="Reminder on" checked={s.reminder.enabled} onCheckedChange={async (enabled) => { if (enabled && typeof Notification !== "undefined" && Notification.permission === "default") await Notification.requestPermission(); saveSettings({ reminder: { ...s.reminder, enabled } }); }} />
      </div>
      <div className="h-px bg-border" />
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex-1 text-[13px] font-medium">Data</span>
        <a href="/api/export" className="rounded-md border border-border px-3.5 py-2 text-[13px] font-semibold hover:bg-muted">Export CSV</a>
        <Link href="/library?import=1" onClick={onClose} className="rounded-md border border-border px-3.5 py-2 text-[13px] font-semibold hover:bg-muted">Import CSV</Link>
        <button type="button" onClick={signOut} className="rounded-md border border-border px-3.5 py-2 text-[13px] font-semibold hover:bg-muted">Sign out</button>
      </div>
      <ResetData />
      <p className="text-center text-xs text-muted-foreground">Recursify · made by <a className="underline-offset-2 hover:underline" href="https://x.com/jammutkarsh">@jammutkarsh</a></p>
    </Overlay>
  );
}

const RESET_PHRASE = "delete all my data";

function ResetData() {
  const { reload, setToast } = useApp();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ok = typed.trim().toLowerCase() === RESET_PHRASE;
  const reset = async () => {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/data", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ confirm: typed }) });
      const out = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(out.error ?? "Reset failed");
      await reload();
      setOpen(false); setTyped("");
      setToast({ kind: "info", message: "All progress deleted. Starting fresh." });
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  if (!open) return (
    <div className="flex items-center gap-3 rounded-lg border border-forgot/40 px-4 py-3">
      <div className="flex-1"><p className="text-[13px] font-medium text-forgot-text">Reset all progress</p><p className="text-xs text-muted-foreground">Deletes every review, custom problem, My list and your settings.</p></div>
      <button type="button" onClick={() => setOpen(true)} className="rounded-md border border-forgot px-3.5 py-2 text-[13px] font-semibold text-forgot-text transition hover:bg-forgot-tint">Reset…</button>
    </div>
  );
  return (
    <div className="space-y-2.5 rounded-lg border border-forgot bg-forgot-tint px-4 py-3.5 animate-in fade-in-0 duration-200">
      <p className="text-[13px] font-semibold text-forgot-text">This can&rsquo;t be undone.</p>
      <p className="text-xs text-foreground-2">Export a CSV first if you might want your history back. To confirm, type <b className="font-mono">{RESET_PHRASE}</b> below.</p>
      <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && ok) reset(); }}
        aria-label={`Type ${RESET_PHRASE} to confirm`} placeholder={RESET_PHRASE} spellCheck={false} autoComplete="off"
        className="w-full rounded-md border border-forgot/50 bg-card px-3 py-2 font-mono text-sm outline-none focus:border-forgot" />
      {error ? <p className="text-xs text-forgot-text" role="alert">{error}</p> : null}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => { setOpen(false); setTyped(""); setError(null); }} className="rounded-md border border-border bg-card px-3.5 py-2 text-[13px] font-semibold">Cancel</button>
        <button type="button" disabled={!ok || busy} onClick={reset} className="rounded-md bg-forgot px-3.5 py-2 text-[13px] font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Deleting…" : "Delete everything"}</button>
      </div>
    </div>
  );
}
