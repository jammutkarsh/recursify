"use client";

import { useEffect } from "react";
import { useApp, type Toast } from "@/context/AppData";
import { intervalDays } from "@/lib/fsrs";
import { cn } from "@/lib/utils";
import { GRADES, Kbd } from "./ui";

export function ToastBar() {
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

