"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { isTyping } from "@/components/app/AppShell";
import { ImportDialog } from "@/components/app/ImportDialog";
import { useKey } from "@/components/app/overlays";
import { ProblemDrawer } from "@/components/app/ProblemDrawer";
import { ago, describeDue, diffText, GRADES, Kbd, Picker } from "@/components/app/ui";
import { useApp } from "@/context/AppData";
import { FOLLOWED_LIST_ID, sectionsOf, type Problem } from "@/lib/catalog";
import type { Tracked } from "@/lib/derive";
import { daysBetween } from "@/lib/fsrs";
import { cn } from "@/lib/utils";

const HEAT = ["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"];
const level = (s: number, t: number) => (s === 0 ? 0 : Math.min(4, Math.ceil((s / t) * 4)));
const recallColor = (r: number) => (r < 0.5 ? "bg-forgot" : r < 0.75 ? "bg-struggled" : "bg-recalled");
type Sort = "weakest" | "due" | "title";

export default function LibraryPage() {
  return <Suspense><Library /></Suspense>;
}

function Library() {
  const app = useApp();
  const { model, data, today } = app;
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const topicRef = useRef<HTMLButtonElement>(null);
  const [focus, setFocus] = useState(0);
  const q = (params.get("q") ?? "").trim();
  const topic = params.get("topic") ?? "";
  const openId = params.get("p");
  const importing = params.has("import");
  const listId = params.get("list") ?? FOLLOWED_LIST_ID;
  const sort = (params.get("sort") as Sort) ?? "weakest";

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params);
    if (v) next.set(k, v); else next.delete(k);
    router.replace(`${path}?${next}`, { scroll: false });
  };

  const groups = useMemo(() => {
    if (!model) return [];
    const list = model.list(listId);
    const ql = q.toLowerCase();
    const sortRows = (rows: { p: Problem; t?: Tracked }[]) => rows.sort((a, b) =>
      sort === "title" ? a.p.title.localeCompare(b.p.title)
      : sort === "due" ? (a.t?.due ?? "9999").localeCompare(b.t?.due ?? "9999")
      : (a.t ? a.t.recall : 2) - (b.t ? b.t.recall : 2));
    return sectionsOf(list)
      .filter((name) => !topic || name === topic)
      .map((name) => {
        const ids = list.sections.filter((s) => s.section === name).map((s) => s.id);
        const all = ids.map((id) => ({ p: model.problem(id)!, t: model.tracked.get(id) })).filter((x) => x.p);
        const rows = sortRows(all.filter((x) => !ql || x.p.title.toLowerCase().includes(ql)));
        const reviewed = all.flatMap((x) => x.t?.history.map((h) => h.date) ?? []).sort().at(-1);
        return { name, rows, solved: all.filter((x) => x.t).length, total: all.length, reviewed };
      })
      .filter((g) => g.rows.length);
  }, [model, listId, topic, q, sort]);
  const flat = groups.flatMap((g) => g.rows);
  const topicMatch = q && model ? model.polygon.find((s) => s.name.toLowerCase().includes(q.toLowerCase()) && s.name !== topic) : null;

  useKey((e) => {
    if (e.key === "Escape" && !openId && !importing && (q || topic)) { router.replace(path); return; }
    if (isTyping(e) || e.metaKey || e.ctrlKey || openId || importing || !flat.length) return;
    if (e.key === "j") setFocus((f) => Math.min(flat.length - 1, f + 1));
    else if (e.key === "k") setFocus((f) => Math.max(0, f - 1));
    else if (e.key === "Enter") setParam("p", flat[Math.min(focus, flat.length - 1)].p.id);
    else if (e.key === "t") topicRef.current?.focus();
    else if (e.key === "u") setParam("import", "1");
    else if (e.key === "Tab" && topicMatch) setParam("topic", topicMatch.name);
    else return;
    e.preventDefault();
  });
  useEffect(() => { document.querySelector(`[data-row="${focus}"]`)?.scrollIntoView({ block: "nearest" }); }, [focus]);

  if (!model || !data) return <p className="p-8 text-sm text-muted-foreground">{app.error ? `Couldn't load your data — ${app.error}` : "Loading…"}</p>;
  const list = model.list(listId);
  let i = -1;

  return (
    <div className="mx-auto flex h-full max-w-[1440px] flex-col gap-4 px-4 pt-6 md:px-8">
      <h1 className="sr-only">Library</h1>
      <div className="flex flex-wrap items-center gap-2">
        <Picker label="List" value={listId} onChange={(v) => setParam("list", v === FOLLOWED_LIST_ID ? null : v)} options={[{ value: FOLLOWED_LIST_ID, label: "All followed lists" }, ...model.lists.map((l) => ({ value: l.id, label: l.name }))]} />
        <Picker label="Topic" triggerRef={topicRef} prefix="Topic:" active={!!topic} value={topic || "all"} onChange={(v) => setParam("topic", v === "all" ? null : v)}
          options={[{ value: "all", label: "all" }, ...sectionsOf(list).map((s) => ({ value: s, label: s }))]} />
        <Picker label="Sort" prefix="Sort:" value={sort} onChange={(v) => setParam("sort", v)}
          options={[{ value: "weakest", label: "weakest recall" }, { value: "due", label: "next due" }, { value: "title", label: "title" }]} />
        {q ? <button type="button" onClick={() => setParam("q", null)} className="rounded-md bg-primary-tint px-3 py-2 text-[13px] text-primary">Search: “{q}” ×</button> : null}
        <button type="button" onClick={() => setParam("import", "1")} className="ml-auto flex items-center gap-2 rounded-md border border-border px-3 py-2 text-[13px] font-semibold">Import CSV <Kbd>U</Kbd></button>
      </div>
      {topicMatch ? (
        <p className="flex w-fit items-center gap-2 rounded-md bg-primary-tint px-3 py-2 text-[13px] text-foreground-2">Topic match: <button type="button" className="font-semibold text-primary" onClick={() => setParam("topic", topicMatch.name)}>{topicMatch.name}</button><span className="text-xs text-muted-foreground">press Tab to filter by topic</span><Kbd>Tab</Kbd></p>
      ) : null}

      {flat.length ? (
        <div className="min-h-0 flex-1 overflow-y-auto pb-6">
          <div className="sticky top-0 z-10 hidden gap-4 bg-background px-3 py-2 font-mono text-[10px] text-muted-foreground md:flex">
            <span className="flex-1">PROBLEM</span><span className="w-40">RECALL</span><span className="w-24 text-right">LAST GRADE</span><span className="w-24 text-right">REVISED</span><span className="w-20 text-right">NEXT</span>
          </div>
          {groups.map((g) => (
            <section key={g.name} aria-label={g.name}>
              <h2 className="flex items-center gap-2.5 px-3 pt-4 pb-2">
                <span className="size-3.5 rounded-[3px]" style={{ background: HEAT[level(g.solved, g.total)] }} />
                <span className="text-[15px] font-semibold">{g.name}</span>
                <span className="font-mono text-xs text-muted-foreground">{g.solved}/{g.total} solved{g.reviewed ? ` · last reviewed ${ago(daysBetween(g.reviewed, today))}` : ""}</span>
              </h2>
              <ul className="overflow-hidden rounded-lg border border-border bg-card">
                {g.rows.map(({ p, t }) => {
                  i++;
                  const idx = i, focused = idx === Math.min(focus, flat.length - 1);
                  const hl = q ? p.title.toLowerCase().indexOf(q.toLowerCase()) : -1;
                  return (
                    <li key={p.id} data-row={idx}>
                      <button type="button" onMouseEnter={() => setFocus(idx)} onClick={() => setParam("p", p.id)}
                        className={cn("flex w-full flex-wrap items-center gap-x-4 gap-y-1 border-b border-border px-3 py-2.5 text-left last:border-0 md:flex-nowrap", focused && "border-l-[3px] border-l-primary bg-primary-tint")}>
                        <span className={cn("min-w-0 flex-1 basis-full truncate text-sm md:basis-auto", focused ? "font-semibold" : "font-medium")}>
                          {hl >= 0 ? <>{p.title.slice(0, hl)}<b className="text-primary">{p.title.slice(hl, hl + q.length)}</b>{p.title.slice(hl + q.length)}</> : p.title}
                          <span className={cn("ml-2 text-xs md:hidden", diffText[p.difficulty])}>{p.difficulty}</span>
                        </span>
                        <span className="flex flex-1 items-center gap-2 md:w-40 md:flex-none">
                          {t ? <><span className="h-1.5 w-28 overflow-hidden rounded-full bg-track"><span className={cn("block h-full rounded-full", recallColor(t.recall))} style={{ width: `${Math.max(3, t.recall * 100)}%` }} /></span><span className="font-mono text-xs font-medium text-foreground-2">{Math.round(t.recall * 100)}%</span></>
                            : <span className="font-mono text-xs text-muted-foreground">not solved</span>}
                        </span>
                        <span className={cn("hidden w-24 text-right text-xs font-semibold md:block", t?.lastGrade ? GRADES[t.lastGrade - 1].cls.split(" ").find((c) => c.startsWith("text-")) : "text-muted-foreground")}>{t?.lastGrade ? GRADES[t.lastGrade - 1].label : t ? "First solve" : "—"}</span>
                        <span className="hidden w-24 text-right font-mono text-xs text-muted-foreground md:block">{t ? ago(daysBetween(t.card.lastReview, today)) : "—"}</span>
                        <span className={cn("w-20 text-right font-mono text-xs", t && t.daysLate > 0 ? "font-semibold text-forgot-text" : "text-muted-foreground")}>{t ? describeDue(t.daysLate) : "new"}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <NoMatches q={q} topic={topic} listName={list.name} onClear={() => router.replace(path)} />
      )}
      {openId ? <ProblemDrawer id={openId} onClose={() => setParam("p", null)} /> : null}
      {importing ? <ImportDialog onClose={() => setParam("import", null)} /> : null}
    </div>
  );
}

function NoMatches({ q, topic, listName, onClear }: { q: string; topic: string; listName: string; onClear: () => void }) {
  const { addCustom } = useApp();
  const router = useRouter();
  return (
    <div className="mx-auto mt-10 flex w-full max-w-md flex-col items-center gap-3 rounded-xl border border-border bg-card px-6 py-9 text-center">
      <p className="text-lg font-bold">{q ? `No problems match “${q}”` : "Nothing here yet"}</p>
      <p className="text-[13px] text-muted-foreground">{q ? "Add it to your custom list and it joins your reviews." : `No problems in ${topic || listName}.`}</p>
      {q ? <button type="button" onClick={async () => { const id = await addCustom({ title: q }); if (id) router.replace(`/library?list=custom&p=${id}`); }}
        className="rounded-md bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground">+ Add “{q}” to My list</button> : null}
      <button type="button" onClick={onClear} className="flex items-center gap-2 text-[13px] text-muted-foreground">Clear filters <Kbd>Esc</Kbd></button>
    </div>
  );
}
