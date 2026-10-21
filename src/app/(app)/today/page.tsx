"use client";

import { Check, Plus, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { isTyping } from "@/components/app/AppShell";
import { useKey } from "@/components/app/overlays";
import { HeatLegend, TopicPolygon } from "@/components/app/TopicPolygon";
import { Banner, describeDue, GRADES, GradeButtons, InfoTip, Kbd, Meta } from "@/components/app/ui";
import { useApp, type Toast } from "@/context/AppData";
import { BUILTIN_LISTS, builtinProblem, slugFromUrl, type Problem } from "@/lib/catalog";
import { gradeIntervals, type Tracked } from "@/lib/derive";
import { daysBetween, intervalDays, type Difficulty } from "@/lib/fsrs";
import { lookupLeetCode } from "@/lib/leetcode";
import { cn } from "@/lib/utils";

const POLY_TIP = "Each wedge is a topic across all the lists you follow; a problem in several lists counts once. Greener = more of it solved. Hover a wedge for its stats; click it to open that topic in Library.";
const ALL: Problem[] = [...new Map(BUILTIN_LISTS.flatMap((l) => l.sections.map((s) => [s.id, builtinProblem(s.id)!]))).values()];

export default function TodayPage() {
  const app = useApp();
  const { model, data, today } = app;
  if (!model || !data) return <Loading error={app.error} />;
  return (
    <div className="mx-auto flex h-full max-w-[1440px] flex-col gap-6 overflow-y-auto px-4 pt-4 pb-4 md:px-8 md:pt-8 lg:flex-row lg:gap-12 lg:overflow-visible">
      <section aria-label="Topic hold" className="rounded-xl border border-border bg-card p-3 lg:hidden">
        <TopicPolygon sections={model.polygon} today={today} compact />
        <p className="px-1 text-center text-xs text-muted-foreground">Tap a wedge to open that topic</p>
      </section>
      <section aria-label="Topic hold" className="hidden w-[650px] shrink-0 flex-col gap-3 lg:flex">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold">Topic hold</h1>
          <InfoTip text={POLY_TIP} />
          <span className="ml-auto truncate text-[13px] text-muted-foreground" title="The polygon combines every list you follow">
            {data.settings.followedLists.map((id) => model.list(id).name).join(" + ")}
          </span>
        </div>
        <TopicPolygon sections={model.polygon} today={today} />
        <HeatLegend />
      </section>
      <section className="flex min-w-0 flex-1 flex-col lg:min-h-0">
        <TopBanner />
        <Suspense><TodaySection /></Suspense>
        <ReviewQueue />
      </section>
      <ToastBar />
    </div>
  );
}

function Loading({ error }: { error: string | null }) {
  return <p className="p-8 text-sm text-muted-foreground">{error ? `Couldn't load your data — ${error}` : "Loading…"}</p>;
}

const CATCHUP_KEY = "recursify-catchup-started";
function TopBanner() {
  const { model, today } = useApp();
  const router = useRouter();
  const [started, setStarted] = useState<string | null>(null);
  useEffect(() => { try { setStarted(localStorage.getItem(CATCHUP_KEY)); } catch { /* storage blocked */ } }, []);
  // Backlog cleared: forget that catch-up was started so the next break gets the welcome banner again.
  useEffect(() => { if (model && !model.catchUp && started) { try { localStorage.removeItem(CATCHUP_KEY); } catch { /* storage blocked */ } setStarted(null); } }, [model, started]);
  if (!model) return null;
  if (model.catchUp) {
    const left = model.dueAll.length;
    if (started) return (
      <div className="mb-5 flex items-center gap-3.5 rounded-lg bg-primary-tint px-4 py-2.5 text-[13px]">
        <span className="font-semibold text-primary">Catch-up</span>
        <span className="text-foreground-2">{model.queue.length ? `${model.queue.length} in today's batch · ${left} due in total` : `Today's batch done · ${left} left`}</span>
      </div>
    );
    const lastActive = model.tracked.size ? [...model.tracked.values()].map((t) => t.card.lastReview).sort().at(-1)! : today;
    return (
      <div className="mb-5">
        <Banner title={`Welcome back — ${daysBetween(lastActive, today)} days away, ${left} reviews piled up`}
          body={`Catch-up mode shows ${model.queue.length} a day, most-forgotten first, and pauses new problems until you're clear.`}
          action="Start catch-up" onAction={() => { try { localStorage.setItem(CATCHUP_KEY, today); } catch { /* private mode: start for this session only */ } setStarted(today); }} />
      </div>
    );
  }
  if (!model.slipping) return null;
  const s = model.slipping;
  return (
    <div className="mb-5">
      <Banner title={`${s.name} is slipping — ${s.due} problems due`} body="Its oldest problems are fading. Open it in Library and re-solve the due ones first."
        action="Open in Library" onAction={() => router.push(`/library?topic=${encodeURIComponent(s.name)}`)} />
    </div>
  );
}

type Pick = { kind: "problem"; p: Problem } | { kind: "link"; slug: string } | { kind: "new"; title: string };

function TodaySection() {
  const app = useApp();
  const { model, data, today } = app;
  const params = useSearchParams();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const [open, setOpen] = useState(false);
  const [pendingGrade, setPendingGrade] = useState<string[]>([]); // tracked problems logged today, awaiting a grade
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const focus = () => { setOpen(true); requestAnimationFrame(() => inputRef.current?.focus()); };
    window.addEventListener("recursify:log", focus);
    if (params.get("log")) { focus(); router.replace("/today"); }
    return () => window.removeEventListener("recursify:log", focus);
  }, [params, router]);

  const query = q.trim();
  const picks = useMemo<Pick[]>(() => {
    if (!query) return [];
    const slug = slugFromUrl(query);
    if (slug) return [builtinProblem(slug) ? { kind: "problem" as const, p: builtinProblem(slug)! } : { kind: "link" as const, slug }];
    const ql = query.toLowerCase();
    const found = [...ALL, ...(data?.customProblems ?? [])].filter((p) => p.title.toLowerCase().includes(ql)).slice(0, 5).map((p) => ({ kind: "problem" as const, p }));
    return found.some((f) => f.p.title.toLowerCase() === ql) ? found : [...found, { kind: "new" as const, title: query }];
  }, [query, data]);

  if (!model || !data) return null;

  const choose = async (pick: Pick) => {
    setQ(""); setBusy(true);
    try {
      if (pick.kind === "problem") {
        const t = model.tracked.get(pick.p.id);
        if (t && t.card.lastReview !== today) setPendingGrade((s) => [pick.p.id, ...s.filter((x) => x !== pick.p.id)]);
        else if (!t) await app.logSolve(pick.p.id);
      } else if (pick.kind === "link") {
        const meta = await lookupLeetCode(pick.slug);
        const id = await app.addCustom(meta ?? { title: pick.slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), url: `https://leetcode.com/problems/${pick.slug}/` });
        if (id) await app.logSolve(id);
      } else {
        const id = await app.addCustom({ title: pick.title });
        if (id) await app.logSolve(id);
      }
    } catch { /* toast already shown */ } finally { setBusy(false); inputRef.current?.focus(); }
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setSel((s) => Math.min(picks.length - 1, s + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === "Enter" && picks[sel]) { e.preventDefault(); choose(picks[sel]); }
    else if (e.key === "Escape") { setQ(""); inputRef.current?.blur(); }
  };

  const loggedToday = model.todayReviews;
  const items = [...pendingGrade.filter((id) => !loggedToday.some((r) => r.problemId === id)).map((id) => ({ pending: true as const, id })),
    ...loggedToday.map((r) => ({ pending: false as const, id: r.problemId, review: r }))];
  const meta = model.catchUp ? "new problems paused during catch-up" : `${loggedToday.length} logged · ${model.firstSolvesToday} of ${data.settings.newPerDay} new`;

  // Nothing to log, suggest or review: a single "Add new" button; A or a click opens the add box.
  if (!open && !items.length && !model.nextUp.length && !model.queue.length) {
    return (
      <div className="mb-7">
        <div className="mb-3 flex items-baseline gap-3"><h2 className="text-lg font-semibold">Today</h2><span className="font-mono text-xs text-muted-foreground">log anything you solve</span></div>
        <button type="button" onClick={() => { setOpen(true); requestAnimationFrame(() => inputRef.current?.focus()); }}
          className="inline-flex items-center gap-2.5 rounded-lg bg-primary px-4.5 py-3 text-[15px] font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 active:scale-[0.98]">
          <Plus className="size-4" />Add new <Kbd onPrimary>A</Kbd>
        </button>
      </div>
    );
  }

  return (
    <div className="shrink-0">
      <div className="mb-3 flex items-baseline gap-3"><h2 className="text-lg font-semibold">Today</h2><span className="font-mono text-xs text-muted-foreground">{meta}</span></div>
      <div className="relative">
        <label className={cn("flex items-center gap-2.5 rounded-lg border bg-card px-3.5 py-3", q ? "border-2 border-primary" : "border-border")}>
          <Plus className={cn("size-[18px]", q ? "text-primary" : "text-muted-foreground")} />
          <input ref={inputRef} value={q} onChange={(e) => { setQ(e.target.value); setSel(0); }} onKeyDown={onKey} disabled={busy}
            placeholder="Log a solve — search a problem or paste a link" aria-label="Log a solve"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          <Kbd>A</Kbd>
        </label>
        {picks.length ? (
          <div className="mt-1.5 overflow-hidden rounded-lg border border-border bg-card shadow-sm" role="listbox" aria-label="Matches">
            {picks.map((pick, i) => (
              <button key={i} type="button" role="option" aria-selected={sel === i} onMouseEnter={() => setSel(i)} onClick={() => choose(pick)}
                className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left", sel === i && "bg-primary-tint")}>
                {pick.kind === "problem" ? <>
                  <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{pick.p.title}</span><Meta topic={pick.p.topics[0]} difficulty={pick.p.difficulty} /></span>
                  <span className="font-mono text-[11px] font-semibold text-muted-foreground">{model.tracked.has(pick.p.id) ? "TRACKED" : "NEW"}</span>
                </> : pick.kind === "link" ? <span className="flex-1 text-sm font-semibold text-primary">+ Add LeetCode problem “{pick.slug}”</span>
                  : <><span className="flex-1 text-sm font-semibold text-primary">+ Add “{pick.title}” as a new problem</span><span className="text-xs text-muted-foreground">no match</span></>}
                {sel === i ? <Kbd>↵</Kbd> : null}
              </button>
            ))}
          </div>
        ) : null}
      </div>
      {items.length || model.nextUp.length ? (
        <ul className="mt-2 max-h-[172px] overflow-y-auto rounded-lg border border-border bg-card" aria-label="Today's solves">
          {items.map((it) => <TodayRow key={"review" in it ? it.review.id : `p-${it.id}`} id={it.id} pending={it.pending} grade={"review" in it ? it.review.grade : null}
            onGraded={() => setPendingGrade((s) => s.filter((x) => x !== it.id))} />)}
          {model.nextUp.map((n) => (
            <li key={n.problem.id} className="flex items-center gap-3 border-b border-border px-4 py-2.5 last:border-0">
              <span className="size-2 rounded-full border-[1.5px] border-primary" />
              <a href={n.problem.url ?? undefined} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium hover:underline">{n.problem.title}</span>
                <Meta topic={n.section} difficulty={n.problem.difficulty} extra={n.why} />
              </a>
              <span className="font-mono text-xs text-primary">next up</span>
            </li>
          ))}
        </ul>
      ) : null}
      <div className="h-7" />
    </div>
  );
}

function TodayRow({ id, pending, grade, onGraded }: { id: string; pending: boolean; grade: number | null; onGraded: () => void }) {
  const app = useApp();
  const { model, data, today } = app;
  const [editing, setEditing] = useState(false);
  if (!model || !data) return null;
  const p = model.problem(id); if (!p) return null;
  const t = model.tracked.get(id);
  const needsTopics = p.custom && p.topics.length === 0;
  return (
    <li className="grow-in border-b border-border last:border-0">
      <div className={cn("px-4 py-2.5", (pending || needsTopics) && "border-l-[3px] border-primary bg-primary-tint")}>
        <div className="flex items-center gap-3">
          {!pending && grade === null && !needsTopics ? <Check className="size-4 text-recalled" strokeWidth={3} /> : null}
          <span className="min-w-0 flex-1">
            {p.url ? (
              <a href={p.url} target="_blank" rel="noopener noreferrer" className="block truncate text-sm font-medium underline-offset-2 hover:text-primary hover:underline">{p.title}</a>
            ) : <span className="block truncate text-sm font-medium">{p.title}</span>}
            <Meta topic={p.topics[0] ?? (p.custom ? "Custom" : undefined)} difficulty={p.difficulty}
              extra={pending ? "seen before — grade it" : needsTopics ? "add topic and difficulty" : grade ? undefined : "logged"} />
          </span>
          {pending ? <span className="font-mono text-[11px] font-semibold text-muted-foreground">TRACKED</span>
            : grade ? <span className={cn("text-xs font-semibold", GRADES[grade - 1].cls.split(" ").find((c) => c.startsWith("text-")))}>{GRADES[grade - 1].label}{t ? ` · next in ${daysBetween(today, t.due)}d` : ""}</span>
            : <span className="font-mono text-[11px] font-semibold text-primary">NEW · review in {t ? daysBetween(today, t.due) : "—"}d</span>}
          {p.custom ? (
            <button type="button" aria-expanded={editing} aria-label={editing ? "Close topic editor" : "Add topics"} onClick={() => setEditing((v) => !v)}
              className={cn("flex size-7 items-center justify-center rounded-md border border-primary transition-transform", editing ? "rotate-45 bg-primary text-primary-foreground" : "text-primary")}>
              <Plus className="size-4" />
            </button>
          ) : null}
        </div>
        {pending && t ? (
          <div className="mt-2.5"><GradeButtons intervals={gradeIntervals(t, today, data.settings.targetRecall)} onGrade={(g) => { app.grade(id, g); onGraded(); }} /></div>
        ) : null}
        {p.custom ? <div className={cn("grid transition-[grid-template-rows] duration-200", editing ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}><div className="overflow-hidden"><TopicEditor problem={p} onDone={() => setEditing(false)} /></div></div> : null}
      </div>
    </li>
  );
}

function TopicEditor({ problem, onDone }: { problem: Problem; onDone: () => void }) {
  const { updateProblem, data } = useApp();
  const [topics, setTopics] = useState(problem.topics);
  const [draft, setDraft] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>(problem.difficulty);
  const known = useMemo(() => [...new Set((data?.customProblems ?? []).flatMap((p) => p.topics))], [data]);
  const suggestions = draft ? known.filter((k) => k.toLowerCase().includes(draft.toLowerCase()) && !topics.includes(k)).slice(0, 4) : [];
  const add = (t: string) => { if (t && !topics.includes(t)) setTopics([...topics, t]); setDraft(""); };
  const save = () => { updateProblem(problem.id, { topics: draft ? [...topics, draft] : topics, difficulty }); onDone(); };
  return (
    <div className="mt-2.5 space-y-2" onKeyDown={(e) => { if (e.key === "Escape") { e.stopPropagation(); onDone(); } }}>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border-[1.5px] border-primary bg-card px-2 py-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">Topics</span>
        {topics.map((t) => <span key={t} className="flex items-center gap-1 rounded-[6px] bg-primary-tint px-2 py-0.5 text-xs font-medium text-primary">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => setTopics(topics.filter((x) => x !== t))}><X className="size-3" /></button></span>)}
        <input autoFocus value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="Add topic"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); if (draft) add(suggestions[0] ?? draft.trim()); else save(); } }}
          className="min-w-24 flex-1 bg-transparent text-[13px] outline-none" placeholder={topics.length ? "" : "Type a topic"} />
      </div>
      {draft ? (
        <div className="overflow-hidden rounded-md border border-border bg-card">
          {suggestions.map((s) => <button key={s} type="button" onClick={() => add(s)} className="block w-full px-2.5 py-1.5 text-left text-xs font-medium hover:bg-primary-tint">{s}</button>)}
          {!known.includes(draft.trim()) ? <button type="button" onClick={() => add(draft.trim())} className="block w-full px-2.5 py-1.5 text-left text-xs font-semibold text-primary hover:bg-primary-tint">+ Create “{draft.trim()}”</button> : null}
        </div>
      ) : null}
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[11px] text-muted-foreground">Difficulty</span>
        {(["Easy", "Medium", "Hard"] as Difficulty[]).map((d) => (
          <button key={d} type="button" onClick={() => setDifficulty(d)} aria-pressed={difficulty === d}
            className={cn("rounded-[6px] border px-2.5 py-1 text-xs font-medium", difficulty === d ? { Easy: "border-easy text-easy", Medium: "border-medium text-medium", Hard: "border-hard text-hard" }[d] + " border-[1.5px] font-semibold" : "border-border text-muted-foreground")}>{d}</button>
        ))}
        <button type="button" onClick={save} className="ml-auto rounded-md bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground">Save <span className="opacity-70">↵</span></button>
      </div>
    </div>
  );
}

function ReviewQueue() {
  const app = useApp();
  const { model, data, today } = app;
  const [focus, setFocus] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);
  const queue = model?.queue ?? [];
  const f = Math.min(focus, Math.max(0, queue.length - 1));

  useKey((e) => {
    if (isTyping(e) || e.metaKey || e.ctrlKey || e.altKey || !queue.length) return;
    if (e.key === "j") { moved.current = true; setFocus(Math.min(queue.length - 1, f + 1)); }
    else if (e.key === "k") { moved.current = true; setFocus(Math.max(0, f - 1)); }
    else if (["1", "2", "3", "4"].includes(e.key)) app.grade(queue[f].problem.id, Number(e.key) as 1 | 2 | 3 | 4);
    else if (e.key === "Enter" && queue[f].problem.url) window.open(queue[f].problem.url!, "_blank", "noopener");
    else return;
    e.preventDefault();
  });
  useKey((e) => { if (!isTyping(e) && e.key === "z" && !e.metaKey && !e.ctrlKey) app.undo(); });
  const moved = useRef(false); // only follow focus after J/K, not on load (it would scroll the whole mobile page)
  useEffect(() => { if (moved.current) listRef.current?.querySelector<HTMLElement>(`[data-i="${f}"]`)?.scrollIntoView({ block: "nearest" }); }, [f]);
  if (!model || !data) return null;

  const header = model.catchUp ? `${queue.length} in today's batch · most forgotten first` : `${queue.length} due · weakest first · topics mixed`;
  return (
    <div className="flex flex-1 flex-col lg:min-h-0">
      <div className="mb-3 flex items-baseline gap-3"><h2 className="text-lg font-semibold">Review queue</h2><span className="hidden font-mono text-xs text-muted-foreground sm:inline">{header}</span></div>
      {queue.length ? (
        <>
          <div className="flex px-4 pb-1.5 font-mono text-[10px] text-muted-foreground"><span className="flex-1">PROBLEM</span><span>DUE</span></div>
          <ul ref={listRef} className="max-h-full min-h-0 overflow-y-auto rounded-lg border border-border bg-card" aria-label="Review queue">
            {queue.map((t, i) => <QueueRow key={t.problem.id} t={t} i={i} focused={i === f} onFocus={() => setFocus(i)} />)}
          </ul>
        </>
      ) : (
        <div className="rounded-xl border border-border bg-card px-6 py-9 text-center">
          <p className="text-xl font-bold">{model.catchUp ? "Today's batch is done" : "All caught up"}</p>
          <p className="mt-2 text-[13px] text-muted-foreground">{nextReviewLine(model.tracked, today)}</p>
        </div>
      )}
    </div>
  );
}

const nextReviewLine = (tracked: Map<string, Tracked>, today: string) => {
  const upcoming = [...tracked.values()].map((t) => t.due).filter((d) => d > today).sort();
  if (!upcoming.length) return "Nothing scheduled yet. Log a solve to start.";
  const n = upcoming.filter((d) => d === upcoming[0]).length;
  return `Next reviews in ${daysBetween(today, upcoming[0])}d · ${n} due`;
};

function QueueRow({ t, i, focused, onFocus }: { t: Tracked; i: number; focused: boolean; onFocus: () => void }) {
  const app = useApp();
  const { data, today } = app;
  return (
    <li data-i={i} className={cn("border-b border-border transition-colors duration-150 last:border-0", focused && "border-l-[3px] border-l-primary bg-primary-tint")} onMouseEnter={onFocus}>
      <div className="flex items-center gap-4 px-4 py-3">
        <a href={t.problem.url ?? undefined} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium hover:underline">{t.problem.title}</span>
          <Meta topic={t.problem.topics[0]} difficulty={t.problem.difficulty} />
        </a>
        <span className={cn("font-mono text-xs", t.daysLate > 0 ? "text-forgot-text" : "text-medium")}>{describeDue(t.daysLate)}</span>
      </div>
      {focused && data ? <div className="px-4 pb-3.5 animate-in fade-in-0 slide-in-from-top-1 duration-200"><GradeButtons intervals={gradeIntervals(t, today, data.settings.targetRecall)} onGrade={(g) => app.grade(t.problem.id, g)} /></div> : null}
    </li>
  );
}

function ToastBar() {
  const { toast, setToast, undo, model, data } = useApp();
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(null), toast.kind === "error" ? 8000 : 6000); return () => clearTimeout(id); }, [toast, setToast]);
  if (!toast) return null;
  return (
    <div role="status" aria-live="polite" className="fixed bottom-20 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3.5 rounded-xl bg-toast py-3 pr-3 pl-4 text-toast-foreground shadow-2xl animate-in fade-in-0 slide-in-from-bottom-4 duration-300 ease-out md:bottom-16">
      <ToastBody toast={toast} model={model} targetRecall={data?.settings.targetRecall ?? 0.9} />
      {toast.kind === "graded" ? <button type="button" onClick={undo} className="flex items-center gap-1.5 rounded-md bg-white/10 px-2.5 py-1.5 text-[13px] font-semibold">Undo <Kbd onPrimary>Z</Kbd></button> : null}
    </div>
  );
}

function ToastBody({ toast, model, targetRecall }: { toast: Toast; model: ReturnType<typeof useApp>["model"]; targetRecall: number }) {
  if (toast.kind !== "graded") return <p className="text-sm font-medium">{toast.message}</p>;
  const g = GRADES[toast.grade - 1];
  const t = model?.tracked.get(toast.problemId);
  const days = t ? intervalDays(t.card.stability, targetRecall) : null;
  return (
    <>
      <span className={cn("flex size-6.5 items-center justify-center rounded-full font-mono text-[13px] font-semibold text-white", { 1: "bg-forgot", 2: "bg-struggled", 3: "bg-recalled", 4: "bg-instant" }[toast.grade])}>{g.key}</span>
      <span>
        <span className="block text-sm font-semibold">{g.label} — {t?.problem.title}</span>
        {t && days ? <span className="block text-xs text-toast-muted">Next review {new Date(`${t.due}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · in {days} days</span> : null}
      </span>
    </>
  );
}

