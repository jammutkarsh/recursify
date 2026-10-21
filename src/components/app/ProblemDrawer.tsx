"use client";

import { ExternalLink, X } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/context/AppData";
import { historyDetails } from "@/lib/derive";
import { daysBetween, fromDay, retrievability, toDay, type Difficulty } from "@/lib/fsrs";
import { cn } from "@/lib/utils";
import { useKey } from "./overlays";
import { describeDue, diffText, GRADES, Kbd, Picker } from "./ui";

const fmt = (d: string) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export function ProblemDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const app = useApp();
  const { model, data, today } = app;
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<null | "reset" | "delete">(null);
  useKey((e) => { if (e.key === "Escape") onClose(); });
  if (!model || !data) return null;
  const p = model.problem(id);
  if (!p) return null;
  const t = model.tracked.get(id);
  const details = t ? historyDetails(t) : [];
  const inLists = model.listsOf(id);
  const addable = data.lists.filter((l) => !inLists.includes(l));
  const section = model.polyList.sections.find((s) => s.id === id)?.section ?? p.topics[0];

  return (
    <div className="fixed inset-0 z-40" role="dialog" aria-modal="true" aria-label={p.title}>
      <div className="absolute inset-0 bg-[var(--scrim)] animate-in fade-in-0 duration-200" onClick={onClose} />
      <aside className="absolute top-0 right-0 flex h-full w-full max-w-[520px] flex-col gap-5 overflow-y-auto bg-card px-7 py-6 shadow-2xl animate-in slide-in-from-right duration-300 ease-out">
        <div className="flex items-center gap-2">
          <span className={cn("rounded-[6px] bg-muted px-2 py-0.5 text-xs font-semibold", diffText[p.difficulty])}>{p.difficulty}</span>
          {section ? <span className="rounded-[6px] bg-muted px-2 py-0.5 text-xs font-semibold text-foreground-2">{section}</span> : null}
          {p.custom ? <span className="rounded-[6px] bg-primary-tint px-2 py-0.5 text-xs font-semibold text-primary">Custom</span> : null}
          <button type="button" onClick={onClose} className="ml-auto" aria-label="Close"><Kbd>Esc</Kbd></button>
        </div>
        {editing && p.custom ? <EditForm id={id} onDone={() => setEditing(false)} /> : (
          <div>
            <h2 className="text-2xl font-bold">{p.title}</h2>
            {p.url ? <a href={p.url} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">Open on LeetCode <ExternalLink className="size-3.5" /></a> : null}
            {p.note ? <p className="mt-2 text-sm text-foreground-2">{p.note}</p> : null}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-[13px] font-medium">Lists</span>
          {inLists.map((l) => (
            <span key={l.id} className="flex items-center gap-1 rounded-[6px] bg-primary-tint py-0.5 pr-1 pl-2 text-xs font-semibold text-primary">
              {l.name}<button type="button" aria-label={`Remove from ${l.name}`} onClick={() => app.removeFromList(l.id, id)} className="rounded px-1 hover:bg-primary/15"><X className="size-3" /></button>
            </span>
          ))}
          {addable.length ? <Picker label="Add to list" value="" onChange={(v) => v && app.addToList(v, id)} className="h-7 text-xs"
            options={[{ value: "", label: "+ Add to list" }, ...addable.map((l) => ({ value: l.id, label: l.name }))]} /> : null}
          {!inLists.length && !addable.length ? <span className="text-xs text-muted-foreground">—</span> : null}
        </div>

        {t ? (
          <>
            <div className="grid grid-cols-4 rounded-lg border border-border">
              {[
                ["RECALL", `${Math.round(t.recall * 100)}%`, t.recall < 0.5 ? "text-forgot-text" : ""],
                ["NEXT", describeDue(t.daysLate), t.daysLate > 0 ? "text-forgot-text" : ""],
                ["STABILITY", `${Math.round(t.card.stability)} days`, ""],
                ["REVIEWS", `${t.card.reps - 1} · ${t.card.lapses} lapse${t.card.lapses === 1 ? "" : "s"}`, ""],
              ].map(([k, v, c]) => (
                <div key={k} className="px-3.5 py-3"><p className="font-mono text-[10px] text-muted-foreground">{k}</p><p className={cn("text-[15px] font-semibold", c)}>{v}</p></div>
              ))}
            </div>
            <RecallCurve details={details} today={today} targetRecall={data.settings.targetRecall} />
            <div>
              <div className="flex items-baseline"><h3 className="flex-1 text-sm font-semibold">History</h3><span className="w-16 text-right font-mono text-[11px] text-muted-foreground">GAP</span><span className="w-16 text-right font-mono text-[11px] text-muted-foreground">RECALL</span></div>
              <ul>
                {[...details].reverse().map((h) => (
                  <li key={h.id} className="flex items-center gap-3 border-b border-border py-2">
                    <span className="w-16 font-mono text-xs text-muted-foreground">{fmt(h.date)}</span>
                    {h.grade ? <span className={cn("rounded-[6px] px-2 py-0.5 text-xs font-semibold", GRADES[h.grade - 1].cls.replace(/border-\S+/, ""))}>{GRADES[h.grade - 1].label}</span>
                      : <span className="rounded-[6px] bg-primary-tint px-2 py-0.5 text-xs font-semibold text-primary">First solve</span>}
                    <span className="flex-1" />
                    <span className="w-16 text-right font-mono text-xs text-muted-foreground">{h.gap === null ? "—" : `after ${h.gap}d`}</span>
                    <span className="w-16 text-right font-mono text-xs font-medium text-foreground-2">{h.recallThen === null ? "—" : `${Math.round(h.recallThen * 100)}%`}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        ) : (
          <p className="rounded-lg border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">Not solved yet. Log it from Today when you do.</p>
        )}

        <div className="mt-auto flex flex-wrap items-center gap-2">
          {p.custom && !editing ? <button type="button" onClick={() => setEditing(true)} className="rounded-md border border-border px-3.5 py-2 text-[13px] font-semibold">Edit</button> : null}
          {t ? (confirm === "reset"
            ? <button type="button" onClick={() => { app.resetProblem(id); setConfirm(null); }} className="rounded-md bg-struggled px-3.5 py-2 text-[13px] font-semibold text-white">Confirm reset</button>
            : <button type="button" onClick={() => setConfirm("reset")} className="rounded-md border border-border px-3.5 py-2 text-[13px] font-semibold">Reset</button>) : null}
          <span className="flex-1" />
          {(t || p.custom || inLists.length) ? (confirm === "delete"
            ? <button type="button" onClick={() => { app.deleteProblem(id); onClose(); }} className="rounded-md bg-forgot px-3.5 py-2 text-[13px] font-semibold text-white">Delete for good</button>
            : <button type="button" onClick={() => setConfirm("delete")} className="rounded-md border border-forgot px-3.5 py-2 text-[13px] font-semibold text-forgot-text">Delete</button>) : null}
        </div>
        {confirm ? <p className="-mt-3 text-xs text-muted-foreground">{confirm === "reset" ? "Clears its history and starts over as a first solve today." : p.custom ? "Removes the problem and its history." : "Removes its history and takes it off all your lists."}</p> : null}
      </aside>
    </div>
  );
}

function EditForm({ id, onDone }: { id: string; onDone: () => void }) {
  const { model, updateProblem } = useApp();
  const p = model!.problem(id)!;
  const [title, setTitle] = useState(p.title);
  const [url, setUrl] = useState(p.url ?? "");
  const [topics, setTopics] = useState(p.topics.join(", "));
  const [difficulty, setDifficulty] = useState<Difficulty>(p.difficulty);
  const save = () => { updateProblem(id, { title, url: url || null, topics: topics.split(",").map((s) => s.trim()).filter(Boolean), difficulty }); onDone(); };
  const field = "w-full rounded-md border border-border bg-card px-3 py-2 text-sm";
  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); save(); }}>
      <label className="block text-[13px] font-medium">Title<input className={field} value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus /></label>
      <label className="block text-[13px] font-medium">Link<input className={field} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="optional" /></label>
      <label className="block text-[13px] font-medium">Topics<input className={field} value={topics} onChange={(e) => setTopics(e.target.value)} placeholder="comma separated" /></label>
      <div className="flex gap-1.5">{(["Easy", "Medium", "Hard"] as Difficulty[]).map((d) => (
        <button key={d} type="button" onClick={() => setDifficulty(d)} aria-pressed={difficulty === d} className={cn("rounded-md border px-3 py-1 text-xs font-medium", difficulty === d ? `border-current font-semibold ${diffText[d]}` : "border-border text-muted-foreground")}>{d}</button>
      ))}</div>
      <div className="flex gap-2"><button type="submit" className="rounded-md bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground">Save</button><button type="button" onClick={onDone} className="rounded-md border border-border px-3.5 py-2 text-[13px] font-semibold">Cancel</button></div>
    </form>
  );
}

/** Predicted recall over time: decays after each review, jumps back to 100% at the next one. */
function RecallCurve({ details, today, targetRecall }: { details: ReturnType<typeof historyDetails>; today: string; targetRecall: number }) {
  const W = 464, H = 110, start = toDay(details[0].date), end = Math.max(toDay(today) + 7, start + 14);
  const X = (d: number) => ((d - start) / (end - start)) * W, Y = (r: number) => H - 6 - r * (H - 12);
  let path = "";
  details.forEach((h, i) => {
    const from = toDay(h.date), to = i + 1 < details.length ? toDay(details[i + 1].date) : end;
    for (let d = from; d <= to; d += Math.max(0.5, (to - from) / 40)) path += `${path ? "L" : "M"}${X(d).toFixed(1)} ${Y(retrievability(d - from, h.stability)).toFixed(1)} `;
  });
  const dot = (g: number | null) => (g ? ["var(--grade-forgot)", "var(--grade-struggled)", "var(--grade-recalled)", "var(--grade-instant)"][g - 1] : "var(--primary)");
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">Predicted recall</h3>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full rounded-lg bg-background" role="img" aria-label={`Predicted recall since ${fromDay(start)}`}>
        <line x1={0} x2={W} y1={Y(targetRecall)} y2={Y(targetRecall)} stroke="var(--primary)" strokeDasharray="4 4" />
        <line x1={X(toDay(today))} x2={X(toDay(today))} y1={0} y2={H} stroke="var(--icon-inactive)" />
        <path d={path} fill="none" stroke="var(--foreground)" strokeWidth={2} />
        {details.map((h) => <circle key={h.id} cx={X(toDay(h.date))} cy={Y(1)} r={5} fill={dot(h.grade)} stroke="var(--card)" strokeWidth={2} />)}
      </svg>
      <p className="mt-1.5 font-mono text-[11px] text-muted-foreground"><span className="text-primary">- - {Math.round(targetRecall * 100)}% target</span> · │ today ({daysBetween(details[0].date, today)}d since first solve) · ● review</p>
    </div>
  );
}
