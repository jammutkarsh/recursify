// The public demo (built with NEXT_PUBLIC_DEMO=true): no sign-in, no D1. The app's /api calls are answered
// here from localStorage instead, so each visitor gets a private sandbox that lives only in their browser.
import { BUILTIN_LISTS, builtinByTitle, builtinProblem, slugFromUrl, type Problem } from "./catalog";
import { csvRecords, toCsv } from "./csv";
import type { AppData } from "./derive";
import { fromDay, toDay, type Difficulty, type Grade } from "./fsrs";
import { DEFAULT_SETTINGS } from "./settings";

export const DEMO = process.env.NEXT_PUBLIC_DEMO === "true";

const KEY = "recursify-demo-v1";
type Store = AppData & { nextId: number };

const empty = (): Store => ({ settings: { ...DEFAULT_SETTINGS }, customProblems: [], myList: [], reviews: [], nextId: 1 });

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
  try { const raw = localStorage.getItem(KEY); if (raw) return JSON.parse(raw) as Store; } catch { /* blocked storage: start fresh */ }
  const s = seed(today()); write(s); return s;
};
function write(s: Store) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode: changes last until reload */ } }

const GRADES: Record<string, Grade> = { forgot: 1, struggled: 2, recalled: 3, instant: 4, 1: 1, 2: 2, 3: 3, 4: 4 };
const GRADE_NAMES = ["", "Forgot", "Struggled", "Recalled", "Instant"];

function addProblem(s: Store, p: Partial<Problem> & { title: string }) {
  const id = `custom-${crypto.randomUUID()}`;
  s.customProblems.push({ id, title: p.title, url: p.url ?? null, difficulty: (["Easy", "Medium", "Hard"].includes(p.difficulty ?? "") ? p.difficulty : "Medium") as Difficulty, topics: p.topics ?? [], note: p.note ?? null, custom: true });
  s.myList.push(id);
  return id;
}

/** Same rules as the server's importCsv, against the local store. */
function importCsv(s: Store, text: string) {
  const out = { problems: 0, reviews: 0, skipped: 0, errors: [] as string[] };
  const records = csvRecords(text);
  if (records.length && !("title" in records[0])) throw new Error('No "title" column found.');
  for (const [i, r] of records.entries()) {
    if (!r.title) { out.errors.push(`Row ${i + 2}: title missing`); continue; }
    const slug = r.url ? slugFromUrl(r.url) : null;
    let id = (slug && builtinProblem(slug) ? slug : builtinByTitle(r.title)?.id) ?? s.customProblems.find((p) => p.title.toLowerCase() === r.title.toLowerCase())?.id;
    if (!id) { id = addProblem(s, { title: r.title, url: r.url || null, difficulty: r.difficulty as Difficulty, topics: r.topic ? r.topic.split(";").map((x) => x.trim()).filter(Boolean) : [], note: r.note || null }); out.problems++; }
    else if (!r.reviewed_at && !s.myList.includes(id)) { s.myList.push(id); out.problems++; }
    if (!r.reviewed_at) continue;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.reviewed_at)) { out.errors.push(`Row ${i + 2}: reviewed_at must be YYYY-MM-DD`); continue; }
    const grade = r.grade ? GRADES[r.grade.trim().toLowerCase()] ?? null : null;
    if (s.reviews.some((x) => x.problemId === id && x.date === r.reviewed_at && x.grade === grade)) { out.skipped++; continue; }
    s.reviews.push({ id: s.nextId++, problemId: id, date: r.reviewed_at, grade }); out.reviews++;
  }
  s.reviews.sort((a, b) => a.date.localeCompare(b.date) || a.id - b.id);
  return out;
}

export function exportCsv() {
  const s = read();
  const meta = (id: string) => s.customProblems.find((p) => p.id === id) ?? builtinProblem(id);
  const row = (p: Problem, date = "", grade: Grade | null = null) => [p.title, p.url ?? "", p.difficulty, p.topics.join("; "), p.note ?? "", date, grade ? GRADE_NAMES[grade] : ""];
  const seen = new Set<string>();
  const rows: unknown[][] = [["title", "url", "difficulty", "topic", "note", "reviewed_at", "grade"]];
  for (const r of s.reviews) { const p = meta(r.problemId); if (p) { seen.add(p.id); rows.push(row(p, r.date, r.grade)); } }
  for (const id of s.myList) { const p = meta(id); if (p && !seen.has(id)) rows.push(row(p)); }
  return toCsv(rows);
}

/** Answers the app's /api requests from localStorage. */
export async function demoApi<T>(path: string, init?: { method?: string; json?: unknown; body?: unknown }): Promise<T> {
  const url = new URL(path, "http://demo");
  const q = (k: string) => url.searchParams.get(k);
  const b = (init?.json ?? {}) as Record<string, unknown> & Partial<Problem>;
  const s = read();
  let out: unknown = { ok: true };
  switch (`${init?.method ?? "GET"} ${url.pathname}`) {
    case "GET /api/data": return { settings: s.settings, customProblems: s.customProblems, myList: s.myList, reviews: s.reviews } as T;
    case "GET /api/lookup": return { problem: null } as T;
    case "POST /api/reviews": s.reviews.push({ id: s.nextId, problemId: String(b.problemId), date: String(b.date), grade: (b.grade as Grade) ?? null }); out = { id: s.nextId++ }; break;
    case "DELETE /api/reviews": s.reviews = s.reviews.filter((r) => (q("id") ? r.id !== Number(q("id")) : r.problemId !== q("problemId"))); break;
    case "POST /api/problems":
      if (b.id && builtinProblem(b.id)) { if (!s.myList.includes(b.id)) s.myList.push(b.id); out = { id: b.id }; }
      else out = { id: addProblem(s, b as Problem) };
      break;
    case "PATCH /api/problems": s.customProblems = s.customProblems.map((p) => (p.id === q("id") ? { ...p, ...b, id: p.id, custom: true } : p)); break;
    case "DELETE /api/problems": { const id = q("id"); s.reviews = s.reviews.filter((r) => r.problemId !== id); s.customProblems = s.customProblems.filter((p) => p.id !== id); s.myList = s.myList.filter((x) => x !== id); break; }
    case "PUT /api/settings": s.settings = { ...s.settings, ...(b as object) }; break;
    case "POST /api/import": out = importCsv(s, String(init?.body ?? "")); break;
    case "DELETE /api/data": write(empty()); return out as T;
    default: throw new Error("Not available in the demo");
  }
  write(s);
  return out as T;
}
