"use client";

import Link from "next/link";
import { useState } from "react";
import { useApp } from "@/context/AppData";
import { progress } from "@/lib/derive";
import { fromDay, toDay } from "@/lib/fsrs";
import { cn } from "@/lib/utils";

const HEAT = ["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"];
const card = "rounded-xl border border-border bg-card px-6 py-5";
const fmt = (d: string, o: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }) => new Date(`${d}T00:00:00`).toLocaleDateString(undefined, o);

export default function ProgressPage() {
  const { model, data, today, error } = useApp();
  if (!model || !data) return <p className="p-8 text-sm text-muted-foreground">{error ? `Couldn't load your data — ${error}` : "Loading…"}</p>;
  const p = progress(model, data, today);
  const target = Math.round(data.settings.targetRecall * 100);
  const recall = p.actualRecall === null ? null : Math.round(p.actualRecall * 100);
  const short = recall !== null && recall < target && p.recallsNeeded > 0;

  const tiles: [string, string, string, string?][] = [
    ["PROBLEMS SOLVED", String(p.solvedUnique), `unique across ${data.settings.followedLists.length} list${data.settings.followedLists.length === 1 ? "" : "s"} · +${p.solvedThisWeek} this week`],
    ["REVIEWS DONE", String(p.reviews12w), "last 12 weeks"],
    ["ACTUAL RECALL", recall === null ? "—" : `${recall}%`, recall === null ? "no reviews in the last 4 weeks" : short ? `recall ${p.recallsNeeded} more to reach ${target}%` : `on target (${target}%)`, short ? "text-forgot-text" : undefined],
    ["ACTIVE DAYS", String(p.activeDays), "of the last 84"],
  ];

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex max-w-[1440px] flex-col gap-5 px-4 py-7 md:px-8">
        <h1 className="text-2xl font-bold">Progress</h1>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {tiles.map(([k, v, sub, cls]) => (
            <div key={k} className="rounded-xl border border-border bg-card px-5 py-4">
              <p className="font-mono text-[11px] text-muted-foreground">{k}</p>
              <p className="text-3xl font-bold">{v}</p>
              <p className={cn("text-[13px] text-muted-foreground", cls)}>{sub}</p>
            </div>
          ))}
        </div>

        <section className={card} aria-label="Lists you follow">
          <div className="mb-3.5 flex flex-wrap items-baseline gap-2"><h2 className="flex-1 font-semibold">Lists you follow</h2><span className="text-xs text-muted-foreground">a problem in several lists counts once in the totals above</span></div>
          <div className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-4">
            {p.perList.map((l) => (
              <div key={l.id}>
                <div className="flex text-sm"><span className="flex-1 font-medium">{l.name}</span><span className="font-mono text-[13px] text-foreground-2">{l.solved} / {l.total}</span></div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-track"><div className="h-full rounded-full bg-heat-3" style={{ width: `${l.total ? Math.max(2, (l.solved / l.total) * 100) : 0}%` }} /></div>
              </div>
            ))}
          </div>
        </section>

        <section className={card} aria-label="Activity">
          <h2 className="font-semibold">Activity</h2>
          <p className="mb-3 text-[13px] text-muted-foreground">Days you solved or reviewed — last 12 months</p>
          <Heatmap activity={p.activity} today={today} />
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className={card} aria-label="Upcoming reviews">
            <h2 className="font-semibold">Upcoming reviews</h2>
            <p className="mb-3 text-[13px] text-muted-foreground">Due per day, next 2 weeks — plan around heavy days</p>
            <Bars upcoming={p.upcoming} />
          </section>
          <section className={card} aria-label="Actual vs target recall">
            <div className="mb-3 flex items-start gap-3">
              <div className="flex-1">
                <h2 className="font-semibold">Actual vs target recall</h2>
                <p className="text-[13px] text-muted-foreground">Share of reviews graded Recalled or Instant, per week{short ? <> · <span className="text-forgot-text">{p.recallsNeeded} short of target</span></> : null}</p>
              </div>
              {short ? <Link href="/today" className="rounded-md bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground">Review now</Link> : null}
            </div>
            <RecallLine weekly={p.weekly} target={data.settings.targetRecall} />
          </section>
        </div>
      </div>
    </div>
  );
}

function Heatmap({ activity, today }: { activity: Map<string, number>; today: string }) {
  const [tip, setTip] = useState<{ x: number; y: number; d: string; n: number } | null>(null);
  const t0 = toDay(today), dow = (new Date(`${today}T00:00:00`).getDay() + 6) % 7; // Monday = 0
  const start = t0 - dow - 52 * 7, cell = 18, gap = 3, left = 34, top = 18, weeks = 53;
  const counts = [...activity.values()], max = Math.max(1, ...counts);
  const lvl = (n: number) => (n === 0 ? 0 : Math.min(4, Math.ceil((n / max) * 4)));
  const W = left + weeks * (cell + gap), H = top + 7 * (cell + gap);
  return (
    <div className="relative overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[720px]" role="img" aria-label="Activity over the last 12 months">
        {Array.from({ length: weeks }, (_, w) => {
          const first = fromDay(start + w * 7);
          return first.slice(8) <= "07" ? <text key={w} x={left + w * (cell + gap)} y={11} className="fill-muted-foreground text-[11px]">{fmt(first, { month: "short" })}</text> : null;
        })}
        {[["Mon", 0], ["Wed", 2], ["Fri", 4]].map(([d, r]) => <text key={d} x={0} y={top + (r as number) * (cell + gap) + 13} className="fill-muted-foreground text-[11px]">{d}</text>)}
        {Array.from({ length: weeks * 7 }, (_, i) => {
          const day = start + i; if (day > t0) return null;
          const d = fromDay(day), n = activity.get(d) ?? 0, x = left + Math.floor(i / 7) * (cell + gap), y = top + (i % 7) * (cell + gap);
          return <rect key={i} x={x} y={y} width={cell} height={cell} rx={4} fill={HEAT[lvl(n)]} onMouseEnter={() => setTip({ x, y, d, n })} onMouseLeave={() => setTip(null)} />;
        })}
      </svg>
      {tip ? <div className="pointer-events-none absolute rounded-md bg-toast px-2.5 py-2 text-xs text-toast-foreground shadow-lg" style={{ left: `${(tip.x / W) * 100}%`, top: `${(tip.y / H) * 100}%`, transform: "translate(-40%, -110%)" }}>
        <b className="block">{fmt(tip.d)}</b><span className="text-toast-muted">{tip.n} {tip.n === 1 ? "solve or review" : "solves and reviews"}</span></div> : null}
      <div className="mt-2 flex items-center gap-1 text-[11px] text-muted-foreground">Less {HEAT.map((c) => <span key={c} className="size-3 rounded-[3px]" style={{ background: c }} />)} More</div>
    </div>
  );
}

function Bars({ upcoming }: { upcoming: ReturnType<typeof progress>["upcoming"] }) {
  const [tip, setTip] = useState<number | null>(null);
  const bars = [{ label: "Late", n: upcoming.late, late: true, day: "" }, ...upcoming.days.map((d, i) => ({ label: i === 0 ? "Today" : fmt(d.day, { weekday: "short" }), n: d.n, late: false, day: d.day }))];
  const max = Math.max(5, ...bars.map((b) => b.n)), W = 620, H = 200, base = 168, bw = (W - 30) / bars.length - 4;
  const heaviest = bars.slice(1).reduce((a, b, i) => (b.n > bars[a + 1].n ? i : a), 0) + 1;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Upcoming reviews; ${upcoming.late} overdue`}>
        {[0, Math.round(max / 2), max].map((g) => { const y = base - (g / max) * 148; return <g key={g}><line x1={24} x2={W} y1={y} y2={y} stroke="var(--chart-grid)" /><text x={0} y={y + 4} className="fill-muted-foreground text-[11px]">{g}</text></g>; })}
        {bars.map((b, i) => {
          const x = 30 + i * (bw + 4), h = (b.n / max) * 148, y = base - h;
          return (
            <g key={i} onMouseEnter={() => setTip(i)} onMouseLeave={() => setTip(null)}>
              <rect x={x} y={0} width={bw} height={base} fill="transparent" />
              {b.n ? <path d={`M${x} ${base} V${y + 4} Q${x} ${y} ${x + 4} ${y} H${x + bw - 4} Q${x + bw} ${y} ${x + bw} ${y + 4} V${base} Z`} fill={b.late ? "var(--grade-forgot)" : "var(--primary)"} fillOpacity={b.late || i === 1 || i === heaviest ? 1 : 0.55} /> : null}
              <text x={x + bw / 2} y={base + 16} textAnchor="middle" className={cn("text-[11px]", i < 2 ? "fill-foreground" : "fill-muted-foreground")}>{b.label}</text>
              {(i < 2 || i === heaviest) && b.n ? <text x={x + bw / 2} y={y - 6} textAnchor="middle" className="fill-foreground text-[12px] font-semibold">{b.n}</text> : null}
            </g>
          );
        })}
      </svg>
      {tip !== null ? <div className="pointer-events-none absolute top-0 rounded-md bg-toast px-2.5 py-2 text-xs text-toast-foreground shadow-lg" style={{ left: `${((30 + tip * (bw + 4)) / W) * 100}%` }}>
        <b>{bars[tip].late ? "Overdue" : fmt(bars[tip].day)}</b> · {bars[tip].n} due</div> : null}
      <div className="mt-2 flex gap-3.5 text-xs text-foreground-2"><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[2px] bg-forgot" />Overdue</span><span className="flex items-center gap-1.5"><span className="size-2.5 rounded-[2px] bg-primary" />Due</span></div>
    </div>
  );
}

function RecallLine({ weekly, target }: { weekly: (number | null)[]; target: number }) {
  const W = 620, H = 200, top = 10, base = 170, lo = 0.5, hi = 1;
  const X = (i: number) => 40 + i * ((W - 60) / 11), Y = (v: number) => base - ((Math.max(lo, v) - lo) / (hi - lo)) * (base - top);
  const pts = weekly.map((v, i) => (v === null ? null : [X(i), Y(v), v] as const)).filter(Boolean) as (readonly [number, number, number])[];
  if (!pts.length) return <p className="py-14 text-center text-[13px] text-muted-foreground">Grade a few reviews to see your recall here.</p>;
  const last = pts.at(-1)!;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Weekly recall; latest ${Math.round(last[2] * 100)}% against a ${Math.round(target * 100)}% target`}>
      {[0.5, 0.75, 1].map((g) => <g key={g}><line x1={34} x2={W} y1={Y(g)} y2={Y(g)} stroke="var(--chart-grid)" /><text x={0} y={Y(g) + 4} className="fill-muted-foreground text-[11px]">{g * 100}%</text></g>)}
      <line x1={34} x2={W} y1={Y(target)} y2={Y(target)} stroke="var(--muted-foreground)" strokeWidth={1.5} strokeDasharray="5 4" />
      <text x={W - 4} y={Y(target) - 6} textAnchor="end" className="fill-foreground-2 text-[11px]">Target {Math.round(target * 100)}%</text>
      <path d={pts.map(([x, y], i) => `${i ? "L" : "M"}${x} ${y}`).join(" ")} fill="none" stroke="var(--primary)" strokeWidth={2} strokeLinejoin="round" />
      {pts.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i === pts.length - 1 ? 5 : 3.5} fill="var(--primary)" stroke="var(--card)" strokeWidth={2} />)}
      <text x={last[0] - 10} y={last[1] > base - 24 ? last[1] - 10 : last[1] + 20} textAnchor="end" className="fill-foreground text-[12px] font-semibold">{Math.round(last[2] * 100)}%</text>
      {["W1", "W4", "W7", "W10", "W12"].map((l) => { const i = Number(l.slice(1)) - 1; return <text key={l} x={X(i)} y={base + 18} textAnchor="middle" className="fill-muted-foreground text-[11px]">{l}</text>; })}
    </svg>
  );
}
