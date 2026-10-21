// CSV import and export rules, shared by the server (D1), the demo (localStorage) and the import preview.
// Pure: data in, operations out. Callers resolve LeetCode metadata first and apply the operations themselves.
import { builtinByTitle, builtinProblem, slugFromUrl, titleFromSlug, type Problem } from "./catalog";
import { importRecords, toCsv } from "./csv";
import type { Difficulty, Grade } from "./fsrs";
import { DEFAULT_LIST_ID, type ReviewRow, type UserList } from "./settings";

export const CSV_COLUMNS = ["title", "url", "difficulty", "topic", "note", "reviewed_at", "grade", "list"];
const GRADE_NAMES = ["", "Forgot", "Struggled", "Recalled", "Instant"];
const DIFFS = ["Easy", "Medium", "Hard"];

export const asDifficulty = (v: unknown): Difficulty => (DIFFS.includes(String(v)) ? (v as Difficulty) : "Medium");
export const asGrade = (v: unknown): Grade | null => {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  const n = ({ forgot: 1, struggled: 2, recalled: 3, instant: 4 } as Record<string, number>)[s] ?? Number(s);
  if (![1, 2, 3, 4].includes(n)) throw new Error(`Invalid grade "${v}"`);
  return n as Grade;
};
export const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

export interface TransferState { customProblems: Problem[]; lists: UserList[]; reviews: ReviewRow[] }
export type Meta = Omit<Problem, "id">;
export type ImportOp =
  | { kind: "list"; id: string; name: string }
  | { kind: "problem"; problem: Problem }
  | { kind: "item"; listId: string; problemId: string; section: string | null }
  | { kind: "review"; problemId: string; date: string; grade: Grade | null };
export type RowStatus = "new" | "added" | "in list" | "review" | "duplicate" | "error";
export interface PlannedRow { line: number; status: RowStatus; title: string; difficulty: string; topic: string; list: string; error?: string }
export interface ImportPlan {
  ops: ImportOp[];
  rows: PlannedRow[];
  result: { problems: number; reviews: number; skipped: number; errors: string[] };
}

/** LeetCode slugs in the file that aren't built in or already copied: the ones that need metadata. */
export function slugsToResolve(text: string, state: TransferState) {
  const known = new Set(state.customProblems.map((p) => p.url && slugFromUrl(p.url)));
  const out = new Set<string>();
  for (const r of importRecords(text).rows) { const s = r.url ? slugFromUrl(r.url) : null; if (s && !builtinProblem(s) && !known.has(s)) out.add(s); }
  return [...out];
}

/**
 * Plan an import. Each row needs a title or a LeetCode link; blanks come from `meta` (slug → catalog or lookup data).
 * Rows without reviewed_at join a list (the `list` column by name, created if new, else `targetListId`);
 * rows with reviewed_at add history, and join a list only if they name one. `topic` sets the problem's section in that list.
 */
export function planImport(text: string, state: TransferState, targetListId: string, meta: Map<string, Meta | null>, newId = () => crypto.randomUUID()): ImportPlan {
  const { rows: records, header } = importRecords(text);
  const lists = new Map(state.lists.map((l) => [l.id, { name: l.name, items: new Map(l.items.map((it) => [it.id, it.section])) }]));
  const byName = new Map(state.lists.map((l) => [l.name.toLowerCase(), l.id]));
  const target = lists.has(targetListId) ? targetListId : DEFAULT_LIST_ID;
  const byTitle = new Map(state.customProblems.map((p) => [p.title.toLowerCase(), p.id]));
  const bySlug = new Map(state.customProblems.flatMap((p) => { const s = p.url && slugFromUrl(p.url); return s ? [[s, p.id] as const] : []; }));
  const metaOf = new Map<string, { title: string; difficulty: string; topic: string }>();
  for (const p of state.customProblems) metaOf.set(p.id, { title: p.title, difficulty: p.difficulty, topic: p.topics[0] ?? "" });
  const reviews = new Set(state.reviews.map((r) => `${r.problemId}|${r.date}|${r.grade ?? ""}`));
  const plan: ImportPlan = { ops: [], rows: [], result: { problems: 0, reviews: 0, skipped: 0, errors: [] } };
  const placed = new Set<string>(); // listId|problemId placed by this file

  for (const [i, rec] of records.entries()) {
    const line = i + (header ? 2 : 1);
    const row: PlannedRow = { line, status: "new", title: rec.title ?? "", difficulty: rec.difficulty ?? "", topic: rec.topic ?? "", list: "" };
    try {
      const slug = rec.url ? slugFromUrl(rec.url) : null;
      if (!rec.title && !slug) throw new Error("needs a title or a LeetCode link");
      if (rec.reviewed_at && !isDate(rec.reviewed_at)) throw new Error("reviewed_at must be YYYY-MM-DD");
      const grade = rec.reviewed_at ? asGrade(rec.grade) : null;
      const topics = rec.topic ? rec.topic.split(";").map((t) => t.trim()).filter(Boolean) : [];

      let listId = target;
      if (rec.list) {
        listId = byName.get(rec.list.toLowerCase()) ?? "";
        if (!listId) {
          listId = `list-${newId()}`;
          plan.ops.push({ kind: "list", id: listId, name: rec.list });
          lists.set(listId, { name: rec.list, items: new Map() }); byName.set(rec.list.toLowerCase(), listId);
        }
      }
      const list = lists.get(listId)!;
      row.list = list.name;

      let id = slug && builtinProblem(slug) ? slug : (slug && bySlug.get(slug)) || (rec.title ? builtinByTitle(rec.title)?.id ?? byTitle.get(rec.title.toLowerCase()) : undefined);
      const joins = !rec.reviewed_at || !!rec.list || !id; // a brand-new problem always joins a list, or nothing would show it
      if (!id) {
        const known = slug ? meta.get(slug) : null;
        const problem: Problem = {
          id: `custom-${newId()}`, title: rec.title || known?.title || titleFromSlug(slug!), url: rec.url || known?.url || null,
          difficulty: asDifficulty(rec.difficulty || known?.difficulty), topics: [...new Set([...topics, ...(known?.topics ?? [])])], note: rec.note || null, custom: true,
        };
        id = problem.id;
        plan.ops.push({ kind: "problem", problem });
        byTitle.set(problem.title.toLowerCase(), id); if (slug) bySlug.set(slug, id);
        metaOf.set(id, { title: problem.title, difficulty: problem.difficulty, topic: problem.topics[0] ?? "" });
      }
      const m = metaOf.get(id) ?? (() => { const b = builtinProblem(id); return { title: b?.title ?? id, difficulty: b?.difficulty ?? "", topic: b?.topics[0] ?? "" }; })();
      row.title = m.title; row.difficulty = rec.difficulty || m.difficulty; row.topic = topics[0] ?? m.topic;

      row.status = "review";
      if (joins) {
        const had = list.items.has(id);
        // A problem repeated later in the same file keeps its first section; re-importing a file can still change it.
        const again = placed.has(`${listId}|${id}`);
        placed.add(`${listId}|${id}`);
        if (!had || (!again && topics[0] && list.items.get(id) !== topics[0])) plan.ops.push({ kind: "item", listId, problemId: id, section: topics[0] ?? null });
        if (!had) { plan.result.problems++; row.status = "added"; } else row.status = "in list";
        if (!again) list.items.set(id, topics[0] ?? list.items.get(id) ?? null);
      }
      if (rec.reviewed_at) {
        const key = `${id}|${rec.reviewed_at}|${grade ?? ""}`;
        if (reviews.has(key)) { plan.result.skipped++; if (!joins) row.status = "duplicate"; }
        else { plan.ops.push({ kind: "review", problemId: id, date: rec.reviewed_at, grade }); reviews.add(key); plan.result.reviews++; row.status = "review"; }
      }
    } catch (e) {
      row.status = "error"; row.error = (e as Error).message;
      plan.result.errors.push(`Line ${line}: ${row.error}`);
    }
    plan.rows.push(row);
  }
  return plan;
}

/** Everything as CSV: one row per list membership (with its list and section), then one per review. Re-importing it rebuilds the lists. */
export function exportCsv(state: TransferState) {
  const custom = new Map(state.customProblems.map((p) => [p.id, p]));
  const meta = (id: string) => custom.get(id) ?? builtinProblem(id);
  const rows: unknown[][] = [CSV_COLUMNS];
  for (const l of state.lists) for (const it of l.items) {
    const p = meta(it.id);
    if (p) rows.push([p.title, p.url ?? "", p.difficulty, it.section ?? p.topics.join("; "), p.note ?? "", "", "", l.name]);
  }
  for (const r of state.reviews) {
    const p = meta(r.problemId);
    if (p) rows.push([p.title, p.url ?? "", p.difficulty, p.topics.join("; "), p.note ?? "", r.date, r.grade ? GRADE_NAMES[r.grade] : "", ""]);
  }
  return toCsv(rows);
}
