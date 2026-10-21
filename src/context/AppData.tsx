"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { builtinProblem, slugFromUrl, titleFromSlug, type Problem } from "@/lib/catalog";
import { buildModel, type AppData, type Model } from "@/lib/derive";
import type { Grade } from "@/lib/fsrs";
import { DEMO, demoApi } from "@/lib/demo";
import { loadCatalog } from "@/lib/leetcode";
import { DEFAULT_LIST_ID, type ReviewRow, type Settings } from "@/lib/settings";

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
  addCustom: (p: Partial<Problem> & { title: string }, listId?: string) => Promise<string | null>;
  addLeetCode: (slug: string) => Promise<string | null>;
  addToList: (listId: string, problemId: string) => Promise<void>;
  removeFromList: (listId: string, problemId: string) => Promise<void>;
  createList: (name: string) => Promise<string | null>;
  renameList: (id: string, name: string) => Promise<void>;
  deleteList: (id: string) => Promise<void>;
  updateProblem: (id: string, patch: Partial<Problem>) => Promise<void>;
  deleteProblem: (id: string) => Promise<void>;
  resetProblem: (id: string) => Promise<void>;
  saveSettings: (patch: Partial<Settings>) => Promise<void>;
  reload: () => Promise<void>;
}

const AppDataContext = createContext<Ctx | null>(null);

/** Data with `problemId` added to list `listId` (a no-op if it's already there). */
const withItem = (d: AppData, listId: string, problemId: string): AppData => ({
  ...d,
  lists: d.lists.some((l) => l.id === listId)
    ? d.lists.map((l) => (l.id === listId && !l.items.some((it) => it.id === problemId) ? { ...l, items: [...l.items, { id: problemId, section: null }] } : l))
    : [...d.lists, { id: listId, name: "My list", items: [{ id: problemId, section: null }] }],
});

async function api<T = unknown>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  if (DEMO) return demoApi<T>(path, init);
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

  const addCustom = useCallback(async (p: Partial<Problem> & { title: string }, listId = DEFAULT_LIST_ID) => {
    try {
      const { id } = await api<{ id: string }>("/api/problems", { method: "POST", json: { ...p, listId } });
      const problem: Problem = { id, title: p.title, url: p.url ?? null, difficulty: p.difficulty ?? "Medium", topics: p.topics ?? [], note: p.note ?? null, custom: true };
      setData((d) => d && withItem({ ...d, customProblems: [...d.customProblems, problem] }, listId, id));
      return id;
    } catch (e) { setToast({ kind: "error", message: (e as Error).message }); return null; }
  }, []);

  /** The id to log for a LeetCode slug: built-in, an existing custom copy, or a new custom problem filled from the catalog / lookup. */
  const addLeetCode = useCallback(async (slug: string) => {
    if (builtinProblem(slug)) return slug;
    const existing = dataRef.current?.customProblems.find((p) => p.url && slugFromUrl(p.url) === slug);
    if (existing) return existing.id;
    const hit = (await loadCatalog().catch(() => null))?.get(slug);
    const meta = hit ? { title: hit.title, url: hit.url, difficulty: hit.difficulty, topics: hit.topics }
      : (await api<{ problem: Omit<Problem, "id"> | null }>(`/api/lookup?slug=${encodeURIComponent(slug)}`).catch(() => ({ problem: null }))).problem;
    return addCustom(meta ?? { title: titleFromSlug(slug), url: `https://leetcode.com/problems/${slug}/` });
  }, [addCustom]);

  const addToList = useCallback((listId: string, problemId: string) =>
    optimistic((d) => withItem(d, listId, problemId), () => api("/api/lists/items", { method: "POST", json: { listId, problemId } }).then(() => {})), [optimistic]);

  const removeFromList = useCallback((listId: string, problemId: string) =>
    optimistic((d) => ({ ...d, lists: d.lists.map((l) => (l.id === listId ? { ...l, items: l.items.filter((it) => it.id !== problemId) } : l)) }),
      () => api(`/api/lists/items?listId=${encodeURIComponent(listId)}&problemId=${encodeURIComponent(problemId)}`, { method: "DELETE" }).then(() => {})), [optimistic]);

  const createList = useCallback(async (name: string) => {
    try {
      const { id } = await api<{ id: string }>("/api/lists", { method: "POST", json: { name } });
      setData((d) => d && { ...d, lists: [...d.lists, { id, name: name.trim(), items: [] }] });
      return id;
    } catch (e) { setToast({ kind: "error", message: (e as Error).message }); return null; }
  }, []);

  const renameList = useCallback((id: string, name: string) =>
    optimistic((d) => ({ ...d, lists: d.lists.map((l) => (l.id === id ? { ...l, name: name.trim() } : l)) }), () => api(`/api/lists?id=${encodeURIComponent(id)}`, { method: "PATCH", json: { name } }).then(() => {})), [optimistic]);

  /** Deletes the list (its problems and their history stay) and stops following it. */
  const deleteList = useCallback(async (id: string) => {
    const followed = dataRef.current?.settings.followedLists ?? [];
    await optimistic((d) => ({ ...d, lists: d.lists.filter((l) => l.id !== id) }), () => api(`/api/lists?id=${encodeURIComponent(id)}`, { method: "DELETE" }).then(() => {}));
    if (followed.includes(id)) {
      const next = followed.filter((x) => x !== id);
      const followedLists = next.length ? next : ["neetcode150"];
      setData((d) => d && { ...d, settings: { ...d.settings, followedLists } });
      await api("/api/settings", { method: "PUT", json: { followedLists } }).catch(() => {});
    }
  }, [optimistic]);

  const updateProblem = useCallback((id: string, patch: Partial<Problem>) =>
    optimistic((d) => ({ ...d, customProblems: d.customProblems.map((p) => (p.id === id ? { ...p, ...patch } : p)) }), () => api(`/api/problems?id=${encodeURIComponent(id)}`, { method: "PATCH", json: patch }).then(() => {})), [optimistic]);

  const deleteProblem = useCallback((id: string) =>
    optimistic(
      (d) => ({ ...d, reviews: d.reviews.filter((r) => r.problemId !== id), customProblems: d.customProblems.filter((p) => p.id !== id), lists: d.lists.map((l) => ({ ...l, items: l.items.filter((it) => it.id !== id) })) }),
      () => api(`/api/problems?id=${encodeURIComponent(id)}`, { method: "DELETE" }).then(() => {}),
    ), [optimistic]);

  const resetProblem = useCallback(async (id: string) => {
    await optimistic((d) => ({ ...d, reviews: d.reviews.filter((r) => r.problemId !== id) }), () => api(`/api/reviews?problemId=${encodeURIComponent(id)}`, { method: "DELETE" }).then(() => {}));
    await addReview(id, null); // start over as a first solve today
  }, [addReview, optimistic]);

  const saveSettings = useCallback((patch: Partial<Settings>) =>
    optimistic((d) => ({ ...d, settings: { ...d.settings, ...patch } }), () => api("/api/settings", { method: "PUT", json: patch }).then(() => {})), [optimistic]);

  const value = useMemo<Ctx>(() => ({ data, model, today, error, toast, setToast, logSolve, grade, undo, addCustom, addLeetCode, addToList, removeFromList, createList, renameList, deleteList, updateProblem, deleteProblem, resetProblem, saveSettings, reload }),
    [data, model, today, error, toast, logSolve, grade, undo, addCustom, addLeetCode, addToList, removeFromList, createList, renameList, deleteList, updateProblem, deleteProblem, resetProblem, saveSettings, reload]);
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
}

export const useApp = () => {
  const ctx = useContext(AppDataContext);
  if (!ctx) throw new Error("useApp must be used inside AppDataProvider");
  return ctx;
};
