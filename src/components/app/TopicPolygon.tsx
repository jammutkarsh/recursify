"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Model } from "@/lib/derive";
import { daysBetween } from "@/lib/fsrs";

const HEAT = ["var(--heat-0)", "var(--heat-1)", "var(--heat-2)", "var(--heat-3)", "var(--heat-4)"];
const level = (solved: number, total: number) => (solved === 0 ? 0 : Math.min(4, Math.ceil((solved / total) * 4)));
const fmt = (d: string | null, today: string) =>
  d ? `${new Date(`${d}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · ${daysBetween(d, today)}d ago` : "—";

/** N-gon, one wedge per section of the selected list. Colour = share solved. Hover = stats, click = Library filtered. */
export function TopicPolygon({ sections, today, linkToLibrary = true, compact = false }: { sections: Pick<Model["polygon"][number], "name" | "solved" | "total" | "lastSolved" | "lastReviewed" | "due">[]; today: string; linkToLibrary?: boolean; compact?: boolean }) {
  const router = useRouter();
  const [hover, setHover] = useState<number | null>(null);
  const W = 650, H = 470, CX = W / 2, CY = H / 2, R = 172, n = Math.max(sections.length, 3);
  const step = 360 / n, rad = (d: number) => (d * Math.PI) / 180;
  const v = (k: number) => [CX + R * Math.cos(rad(-90 - step / 2 + step * k)), CY + R * Math.sin(rad(-90 - step / 2 + step * k))];
  const h = hover !== null ? sections[hover] : null;

  return (
    <div className="relative w-full max-w-[650px]">
      <svg viewBox={compact ? `${CX - R - 6} ${CY - R - 6} ${2 * R + 12} ${2 * R + 12}` : `0 0 ${W} ${H}`} className={compact ? "mx-auto w-full max-w-[260px]" : "w-full"} role="img" aria-label={`Topic polygon showing progress across ${sections.length} topics`}>
        {sections.map((s, k) => {
          const [x1, y1] = v(k), [x2, y2] = v(k + 1);
          const a = rad(-90 + step * k), cos = Math.cos(a), sin = Math.sin(a);
          const lx = CX + (R + 12) * cos, ly = CY + (R + 12) * sin;
          const anchor = cos > 0.15 ? "start" : cos < -0.15 ? "end" : "middle";
          return (
            <g key={s.name} className={linkToLibrary ? "cursor-pointer" : undefined} onMouseEnter={() => setHover(k)} onMouseLeave={() => setHover(null)}
              onClick={linkToLibrary ? () => router.push(`/library?topic=${encodeURIComponent(s.name)}`) : undefined}>
              <path d={`M${CX} ${CY} L${x1} ${y1} L${x2} ${y2} Z`} fill={HEAT[level(s.solved, s.total)]} stroke="var(--background)" strokeWidth={2}
                className="transition-opacity hover:opacity-85" />
              {compact ? null : <text x={lx} y={ly + (Math.abs(cos) <= 0.15 ? (sin < 0 ? -6 : 14) : 4)} textAnchor={anchor} className="fill-foreground text-[12px] font-medium">
                {anchor === "end" ? <><tspan className="fill-muted-foreground font-mono text-[11px]">{s.solved}/{s.total}</tspan> {s.name}</> : <>{s.name} <tspan className="fill-muted-foreground font-mono text-[11px]">{s.solved}/{s.total}</tspan></>}
              </text>}
            </g>
          );
        })}
        {hover !== null ? (() => { const [x1, y1] = v(hover), [x2, y2] = v(hover + 1); return <path d={`M${CX} ${CY} L${x1} ${y1} L${x2} ${y2} Z`} fill="none" stroke="var(--primary)" strokeWidth={3} strokeLinejoin="round" pointerEvents="none" />; })() : null}
      </svg>
      {h ? (
        <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 ml-6 w-60 max-sm:left-auto max-sm:right-0 max-sm:ml-0 rounded-lg border border-border bg-card px-3.5 py-3 shadow-lg">
          <div className="mb-1.5 flex items-center gap-2">
            <span className="size-3 rounded-[3px]" style={{ background: HEAT[level(h.solved, h.total)] }} />
            <span className="text-sm font-semibold">{h.name}</span>
          </div>
          {[["SOLVED", `${h.solved} of ${h.total}`], ["LAST SOLVED", fmt(h.lastSolved, today)], ["LAST REVIEWED", fmt(h.lastReviewed, today)], ["DUE NOW", `${h.due} due`]].map(([k, val]) => (
            <div key={k} className="flex gap-3 py-0.5 text-[13px]">
              <span className="w-24 font-mono text-[11px] leading-5 text-muted-foreground">{k}</span>
              <span className={k === "SOLVED" ? "font-semibold" : ""}>{val}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function HeatLegend() {
  return (
    <div className="flex items-center gap-1 font-mono text-[11px] text-muted-foreground">
      none solved
      {HEAT.map((c) => <span key={c} className="size-3 rounded-[2px]" style={{ background: c }} />)}
      all solved
    </div>
  );
}
