"use client";

import { Info } from "lucide-react";
import type { ReactNode } from "react";
import type { Grade } from "@/lib/fsrs";
import { cn } from "@/lib/utils";

export function Kbd({ children, onPrimary, className }: { children: ReactNode; onPrimary?: boolean; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-b-2 px-1.5 font-mono text-[11px] font-medium leading-none",
        onPrimary ? "border-white/20 bg-white/15 text-white" : "border-border bg-muted text-foreground-2",
        className,
      )}
    >
      {children}
    </kbd>
  );
}

export function KeyHints({ items }: { items: [string[], string][] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      {items.map(([keys, label]) => (
        <span key={label} className="flex items-center gap-1 text-xs text-muted-foreground">
          {keys.map((k) => <Kbd key={k}>{k}</Kbd>)}
          <span className="ml-0.5">{label}</span>
        </span>
      ))}
    </div>
  );
}

export function InfoTip({ text, label = "More info" }: { text: string; label?: string }) {
  return (
    <span className="group relative inline-flex">
      <button type="button" aria-label={label} className="text-muted-foreground outline-none hover:text-primary focus-visible:text-primary">
        <Info className="size-4" />
      </button>
      <span role="tooltip" className="pointer-events-none absolute top-6 left-0 z-50 w-72 rounded-md bg-toast px-3 py-2.5 text-xs leading-relaxed text-toast-foreground opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

export function Banner({ title, body, action, onAction }: { title: string; body: string; action?: string; onAction?: () => void }) {
  return (
    <section className="rounded-xl border border-primary bg-primary-tint px-5 py-4">
      <h2 className="text-base font-bold">{title}</h2>
      <p className="mt-1.5 text-[13px] text-foreground-2">{body}</p>
      {action ? (
        <button type="button" onClick={onAction} className="mt-2.5 inline-flex items-center gap-2 rounded-md bg-primary px-3.5 py-2 text-[13px] font-semibold text-primary-foreground hover:opacity-90">
          {action}
        </button>
      ) : null}
    </section>
  );
}

export const GRADES: { g: Grade; key: string; label: string; cls: string }[] = [
  { g: 1, key: "1", label: "Forgot", cls: "border-forgot bg-forgot-tint text-forgot-text" },
  { g: 2, key: "2", label: "Struggled", cls: "border-struggled bg-struggled-tint text-struggled-text" },
  { g: 3, key: "3", label: "Recalled", cls: "border-recalled bg-recalled-tint text-recalled-text" },
  { g: 4, key: "4", label: "Instant", cls: "border-instant bg-instant-tint text-instant-text" },
];

export const gradeText: Record<Grade, string> = { 1: "text-forgot-text", 2: "text-struggled-text", 3: "text-recalled-text", 4: "text-instant-text" };
export const diffText = { Easy: "text-easy", Medium: "text-medium", Hard: "text-hard" } as const;

export function GradeButtons({ intervals, onGrade }: { intervals: number[]; onGrade: (g: Grade) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {GRADES.map(({ g, key, label, cls }, i) => (
        <button key={g} type="button" onClick={() => onGrade(g)} className={cn("flex items-center justify-center gap-1.5 rounded-md border-2 py-2 text-[13px] hover:brightness-95", cls)}>
          <span className="font-mono font-semibold">{key}</span>
          <span className="font-bold">{label}</span>
          <span className="font-mono text-[11px] text-muted-foreground">{intervals[i]}d</span>
        </button>
      ))}
    </div>
  );
}

export function Meta({ topic, difficulty, extra }: { topic?: string; difficulty: keyof typeof diffText; extra?: string }) {
  return (
    <p className="truncate text-xs text-muted-foreground">
      {topic ? `${topic} · ` : ""}<span className={diffText[difficulty]}>{difficulty}</span>{extra ? ` · ${extra}` : ""}
    </p>
  );
}

export const describeDue = (daysLate: number) => (daysLate > 0 ? `${daysLate}d late` : daysLate === 0 ? "today" : `in ${-daysLate}d`);
