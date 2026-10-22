// The public demo (built with NEXT_PUBLIC_DEMO=true): no sign-in, no D1. The app's /api calls are answered
// here from localStorage instead, so each visitor gets a private sandbox that lives only in their browser.
// Import and export follow the same rules as the server (src/lib/transfer.ts).
import { BUILTIN_LISTS, builtinProblem, RENAMED_IDS, type Problem } from "./catalog";
import type { AppData } from "./derive";
import { fromDay, toDay, type Grade } from "./fsrs";
import { loadCatalog } from "./leetcode";
import { DEFAULT_LIST_ID, DEFAULT_SETTINGS, type UserList } from "./settings";
import { asDifficulty, exportCsv as toExportCsv, planImport, slugsToResolve, type Meta } from "./transfer";

export const DEMO = process.env.NEXT_PUBLIC_DEMO === "true";

const KEY = "recursify-demo-v2";
type Store = AppData & { nextId: number };

const empty = (): Store => ({ settings: { ...DEFAULT_SETTINGS }, customProblems: [], lists: [{ id: DEFAULT_LIST_ID, name: "My list", items: [] }], reviews: [], nextId: 1 });

/** Six weeks of believable history: 25 NeetCode problems across topics, some now due for review. */
function seed(today: string): Store {
  const s = empty();
  const t = toDay(today);
  BUILTIN_LISTS[0].sections.filter((_, i) => i % 6 === 0).forEach(({ id }, i) => {
    let day = t - 44 + i * 2 - (i % 3);
    s.reviews.push({ id: s.nextId++, problemId: id, date: fromDay(day), grade: null });
    for (const [k, gap] of [3, 8, 18].entries()) {
      day += gap;
      if (day >= t) break;
      s.reviews.push({ id: s.nextId++, problemId: id, date: fromDay(day), grade: ([3, 4, 2, 3, 1, 3, 4] as Grade[])[(i + k * 3) % 7] });
    }
  });
  s.reviews.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  return s;
}

const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
const read = (): Store => {
  try { const raw = localStorage.getItem(KEY); if (raw) return renameIds(JSON.parse(raw) as Store); } catch { /* blocked storage: start fresh */ }
  const s = seed(today()); write(s); return s;
};
/** Same fix as the D1 migration: corrected built-in ids (RENAMED_IDS). */
const renameIds = (s: Store): Store => {
  const to = (id: string) => RENAMED_IDS[id] ?? id;
  return { ...s, reviews: s.reviews.map((r) => ({ ...r, problemId: to(r.problemId) })),
    lists: s.lists.map((l) => ({ ...l, items: l.items.filter((it, i, all) => all.findIndex((x) => to(x.id) === to(it.id)) === i).map((it) => ({ ...it, id: to(it.id) })) })) };
};
function write(s: Store) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: changes last until reload */ } }

const list = (s: Store, id: unknown): UserList => {
  const l = s.lists.find((x) => x.id === (id || DEFAULT_LIST_ID));
  if (!l) throw new Error("No such list");
  return l;
};
const addItem = (l: UserList, problemId: string, section: string | null) => {
  const it = l.items.find((x) => x.id === problemId);
  if (it) it.section = section ?? it.section; else l.items.push({ id: problemId, section });
};
const assertName = (s: Store, name: unknown, except = "") => {
  const n = String(name ?? "").trim();
  if (!n || n.length > 60) throw new Error("List name must be 1–60 characters");
  if (s.lists.some((l) => l.id !== except && l.name.toLowerCase() === n.toLowerCase())) throw new Error(`You already have a list called "${n}"`);
  return n;
};

export const exportCsv = () => toExportCsv(read());

/** Answers the app's /api requests from localStorage. */
export async function demoApi<T>(path: string, init?: { method?: string; json?: unknown; body?: unknown }): Promise<T> {
  const url = new URL(path, "http://demo");
  const q = (k: string) => url.searchParams.get(k);
  const b = (init?.json ?? {}) as Record<string, unknown> & Partial<Problem>;
  const s = read();
  let out: unknown = { ok: true };
  switch (`${init?.method ?? "GET"} ${url.pathname}`) {
    case "GET /api/data": return { settings: s.settings, customProblems: s.customProblems, lists: s.lists, reviews: s.reviews } as T;
    case "GET /api/lookup": return { problem: null } as T;
    case "POST /api/reviews": s.reviews.push({ id: s.nextId, problemId: String(b.problemId), date: String(b.date), grade: (b.grade as Grade) ?? null }); out = { id: s.nextId++ }; break;
    case "DELETE /api/reviews": s.reviews = s.reviews.filter((r) => (q("id") ? r.id !== Number(q("id")) : r.problemId !== q("problemId"))); break;
    case "POST /api/problems": {
      const l = list(s, b.listId);
      if (b.id && builtinProblem(b.id)) { addItem(l, b.id, null); out = { id: b.id }; break; }
      const p: Problem = { id: `custom-${crypto.randomUUID()}`, title: String(b.title ?? "").trim(), url: b.url ?? null, difficulty: asDifficulty(b.difficulty), topics: b.topics ?? [], note: b.note ?? null, custom: true };
      if (!p.title) throw new Error("title is required");
      s.customProblems.push(p); addItem(l, p.id, null); out = { id: p.id };
      break;
    }
    case "PATCH /api/problems": s.customProblems = s.customProblems.map((p) => (p.id === q("id") ? { ...p, ...b, id: p.id, custom: true } : p)); break;
    case "DELETE /api/problems": {
      const id = q("id");
      s.reviews = s.reviews.filter((r) => r.problemId !== id); s.customProblems = s.customProblems.filter((p) => p.id !== id);
      for (const l of s.lists) l.items = l.items.filter((it) => it.id !== id);
      break;
    }
    case "POST /api/lists": { const id = `list-${crypto.randomUUID()}`; s.lists.push({ id, name: assertName(s, b.name), items: [] }); out = { id }; break; }
    case "PATCH /api/lists": list(s, q("id")).name = assertName(s, b.name, q("id") ?? ""); break;
    case "DELETE /api/lists":
      if (q("id") === DEFAULT_LIST_ID) throw new Error("The default list can't be deleted; rename it instead");
      s.lists = s.lists.filter((l) => l.id !== q("id")); break;
    case "POST /api/lists/items": addItem(list(s, b.listId), String(b.problemId), (b.section as string) ?? null); break;
    case "DELETE /api/lists/items": { const l = list(s, q("listId")); l.items = l.items.filter((it) => it.id !== q("problemId")); break; }
    case "PUT /api/settings": s.settings = { ...s.settings, ...(b as object) }; break;
    case "POST /api/import": {
      const text = String(init?.body ?? "");
      const slugs = slugsToResolve(text, s);
      const catalog = slugs.length ? await loadCatalog().catch(() => null) : null; // no live lookups in the demo
      const meta = new Map<string, Meta | null>(slugs.map((slug) => [slug, catalog?.get(slug) ?? null]));
      const plan = planImport(text, s, q("list") ?? DEFAULT_LIST_ID, meta);
      for (const op of plan.ops) {
        if (op.kind === "list") s.lists.push({ id: op.id, name: op.name, items: [] });
        else if (op.kind === "problem") s.customProblems.push(op.problem);
        else if (op.kind === "item") addItem(list(s, op.listId), op.problemId, op.section);
        else s.reviews.push({ id: s.nextId++, problemId: op.problemId, date: op.date, grade: op.grade });
      }
      s.reviews.sort((x, y) => x.date.localeCompare(y.date) || x.id - y.id);
      out = plan.result;
      break;
    }
    default: throw new Error("Not available in the demo");
  }
  write(s);
  return out as T;
}
