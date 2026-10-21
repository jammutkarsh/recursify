"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Problem } from "@/lib/catalog";
import { buildModel, type AppData, type Model } from "@/lib/derive";
import type { Grade } from "@/lib/fsrs";
import type { ReviewRow, Settings } from "@/lib/settings";

export const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export type Toast = { kind: "graded"; problemId: string; grade: Grade; reviewId: number } | { kind: "error"; message: string } | { kind: "info"; message: string };

interface Ctx {
  data: AppData | null;
  model: Model | null;
  today: string;
  error: string | null;
  toast: Toast | null;
  setToast: (t: Toast | null) => void;
  logSolve: (problemId: string) => Promise<void>;
  grade: (problemId: string, grade: Grade) => Promise<void>;
  undo: () => Promise<void>;
  addCustom: (p: Partial<Problem> & { title: string }) => Promise<string | null>;
  addToMyList: (problemId: string) => Promise<void>;
  updateProblem: (id: string, patch: Partial<Problem>) => Promise<void>;
  deleteProblem: (id: string) => Promise<void>;
  resetProblem: (id: string) => Promise<void>;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  reload: () => Promise<void>;
}

const AppDataContext = createContext<Ctx | null>(null);

async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: init?.json !== undefined ? { "content-type": "application/json" } : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  if (res.status === 401) { window.location.assign("/login"); throw new Error("Signed out"); }
  const out = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(out.error ?? `Request failed (${res.status})`);
  return out;
}

export function AppDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [today, setToday] = useState(localToday);
  const tempId = useRef(-1);
  const dataRef = useRef<AppData | null>(null);
  useEffect(() => { dataRef.current = data; }, [data]);

  const reload = useCallback(async () => {
    try { setData(await api<AppData>("/api/data")); setError(null); }
    catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  // Roll the date over at midnight without a reload.
  useEffect(() => { const t = setInterval(() => setToday(localToday()), 60_000); return () => clearInterval(t); }, []);

  const model = useMemo(() => (data ? buildModel(data, today) : null), [data, today]);

  /** Apply locally first, then sync; roll back and show an error toast if the server refuses. */
  const optimistic = useCallback(async (apply: (d: AppData) => AppData, sync: () => Promise<void>) => {
    const before = dataRef.current;
    setData((d) => (d ? apply(d) : d));
    try { await sync(); }
    catch (e) { setData(before); setToast({ kind: "error", message: `Couldn't save — ${(e as Error).message}` }); throw e; }
  }, []);

  const addReview = useCallback(async (problemId: string, grade: Grade | null) => {
    const temp = tempId.current--;
    const row: ReviewRow = { id: temp, problemId, date: today, grade };
    let realId = temp;
    await optimistic((d) => ({ ...d, reviews: [...d.reviews, row] }), async () => {
      realId = (await api<{ id: number }>("/api/reviews", { method: "POST", json: { problemId, date: today, grade } })).id;
      setData((d) => d && { ...d, reviews: d.reviews.map((r) => (r.id === temp ? { ...r, id: realId } : r)) });
    });
    return realId;
  }, [optimistic, today]);

  const logSolve = useCallback(async (problemId: string) => {
    if (model?.tracked.has(problemId)) return; // tracked problems are graded instead
    await addReview(problemId, null);
  }, [addReview, model]);

  const grade = useCallback(async (problemId: string, g: Grade) => {
    const reviewId = await addReview(problemId, g);
    setToast({ kind: "graded", problemId, grade: g, reviewId });
  }, [addReview]);

  const undo = useCallback(async () => {
    if (toast?.kind !== "graded") return;
    const { reviewId } = toast;
    setToast(null);
    await optimistic((d) => ({ ...d, reviews: d.reviews.filter((r) => r.id !== reviewId) }), () => api(`/api/reviews?id=${reviewId}`, { method: "DELETE" }).then(() => {}));
  }, [optimistic, toast]);

  const addCustom = useCallback(async (p: Partial<Problem> & { title: string }) => {
    try {
      const { id } = await api<{ id: string }>("/api/problems", { method: "POST", json: p });
      const problem: Problem = { id, title: p.title, url: p.url ?? null, difficulty: p.difficulty ?? "Medium", topics: p.topics ?? [], note: p.note ?? null, custom: true };
      setData((d) => d && { ...d, customProblems: [...d.customProblems, problem], myList: [...d.myList, id] });
      return id;
    } catch (e) { setToast({ kind: "error", message: (e as Error).message }); return null; }
  }, []);

  const addToMyList = useCallback((problemId: string) =>
    optimistic((d) => ({ ...d, myList: d.myList.includes(problemId) ? d.myList : [...d.myList, problemId] }), () => api("/api/problems", { method: "POST", json: { id: problemId } }).then(() => {})), [optimistic]);

  const updateProblem = useCallback((id: string, patch: Partial<Problem>) =>
    optimistic((d) => ({ ...d, customProblems: d.customProblems.map((p) => (p.id === id ? { ...p, ...patch } : p)) }), () => api(`/api/problems?id=${encodeURIComponent(id)}`, { method: "PATCH", json: patch }).then(() => {})), [optimistic]);

  const deleteProblem = useCallback((id: string) =>
    optimistic(
      (d) => ({ ...d, reviews: d.reviews.filter((r) => r.problemId !== id), customProblems: d.customProblems.filter((p) => p.id !== id), myList: d.myList.filter((x) => x !== id) }),
      () => api(`/api/problems?id=${encodeURIComponent(id)}`, { method: "DELETE" }).then(() => {}),
    ), [optimistic]);

  const resetProblem = useCallback(async (id: string) => {
    await optimistic((d) => ({ ...d, reviews: d.reviews.filter((r) => r.problemId !== id) }), () => api(`/api/reviews?problemId=${encodeURIComponent(id)}`, { method: "DELETE" }).then(() => {}));
    await addReview(id, null); // start over as a first solve today
  }, [addReview, optimistic]);

  const saveSettings = useCallback((patch: Partial<Settings>) =>
    optimistic((d) => ({ ...d, settings: { ...d.settings, ...patch } }), () => api("/api/settings", { method: "PUT", json: patch }).then(() => {})), [optimistic]);

  const value = useMemo<Ctx>(() => ({ data, model, today, error, toast, setToast, logSolve, grade, undo, addCustom, addToMyList, updateProblem, deleteProblem, resetProblem, saveSettings, reload }),
    [data, model, today, error, toast, logSolve, grade, undo, addCustom, addToMyList, updateProblem, deleteProblem, resetProblem, saveSettings, reload]);
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export const useApp = () => {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useApp must be used inside AppDataProvider");
  return ctx;
};
