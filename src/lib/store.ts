// Server-side data access. Every function assumes the caller already checked auth.
import { builtinProblem, type Problem } from "./catalog";
import { db } from "./db";
import type { Grade } from "./fsrs";
import { lookupLeetCode, serverCatalogLookup } from "./leetcode";
import { DEFAULT_LIST_ID, DEFAULT_SETTINGS, RESET_PHRASES, type ReviewRow, type Settings, type UserList } from "./settings";
import { asDifficulty, asGrade, exportCsv as toExportCsv, isDate, planImport, slugsToResolve, type ImportOp, type Meta, type TransferState } from "./transfer";

export { DEFAULT_SETTINGS, type ReviewRow, type Settings };

const rowToProblem = (r: Record<string, unknown>): Problem => ({
  id: r.id as string, title: r.title as string, url: (r.url as string) ?? null,
  difficulty: asDifficulty(r.difficulty), topics: JSON.parse((r.topics as string) || "[]"), note: (r.note as string) ?? null, custom: true,
});

export async function loadAll() {
  const d = await db();
  const [s, c, r, l, i] = await d.batch([
    d.prepare("SELECT key, value FROM settings"),
    d.prepare("SELECT * FROM custom_problems ORDER BY created_at"),
    d.prepare("SELECT id, problem_id, reviewed_at, grade FROM reviews ORDER BY reviewed_at, id"),
    d.prepare("SELECT id, name FROM lists ORDER BY created_at, rowid"),
    d.prepare("SELECT list_id, problem_id, section FROM list_items ORDER BY rowid"),
  ]);
  const settings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of s.results as { key: string; value: string }[]) if (key in settings) (settings as Record<string, unknown>)[key] = JSON.parse(value);
  const lists: UserList[] = (l.results as { id: string; name: string }[]).map(({ id, name }) => ({ id, name, items: [] }));
  if (!lists.some((x) => x.id === DEFAULT_LIST_ID)) lists.unshift({ id: DEFAULT_LIST_ID, name: "My list", items: [] });
  const byId = new Map(lists.map((x) => [x.id, x]));
  for (const it of i.results as { list_id: string; problem_id: string; section: string | null }[]) byId.get(it.list_id)?.items.push({ id: it.problem_id, section: it.section });
  return {
    settings,
    customProblems: (c.results as Record<string, unknown>[]).map(rowToProblem),
    lists,
    reviews: (r.results as Record<string, unknown>[]).map((x) => ({ id: x.id as number, problemId: x.problem_id as string, date: x.reviewed_at as string, grade: (x.grade as Grade) ?? null })),
  };
}

export async function addReview(problemId: string, date: string, grade: unknown) {
  if (!problemId || !isDate(date)) throw new Error("problemId and date (YYYY-MM-DD) are required");
  const d = await db();
  const res = await d.prepare("INSERT INTO reviews (problem_id, reviewed_at, grade) VALUES (?, ?, ?) RETURNING id").bind(problemId, date, asGrade(grade)).first<{ id: number }>();
  return res!.id;
}

export async function deleteReviews({ id, problemId }: { id?: number; problemId?: string }) {
  const d = await db();
  if (id) await d.prepare("DELETE FROM reviews WHERE id = ?").bind(id).run();
  else if (problemId) await d.prepare("DELETE FROM reviews WHERE problem_id = ?").bind(problemId).run();
}

// ——— Lists ———

const listName = (name: unknown) => {
  const n = String(name ?? "").trim();
  if (!n || n.length > 60) throw new Error("List name must be 1–60 characters");
  return n;
};
async function assertNewName(d: D1Database, name: string, except = "") {
  const clash = await d.prepare("SELECT id FROM lists WHERE lower(name) = lower(?) AND id != ?").bind(name, except).first();
  if (clash) throw new Error(`You already have a list called "${name}"`);
}

export async function createList(name: unknown) {
  const d = await db();
  const n = listName(name);
  await assertNewName(d, n);
  const id = `list-${crypto.randomUUID()}`;
  await d.prepare("INSERT INTO lists (id, name, created_at) VALUES (?, ?, ?)").bind(id, n, new Date().toISOString()).run();
  return id;
}

export async function renameList(id: string, name: unknown) {
  const d = await db();
  const n = listName(name);
  await assertNewName(d, n, id);
  await d.prepare("INSERT INTO lists (id, name, created_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name").bind(id, n, new Date().toISOString()).run();
}

/** Deletes the list and its memberships; the problems (and their history) stay. The default list can't be deleted. */
export async function deleteList(id: string) {
  if (id === DEFAULT_LIST_ID) throw new Error("The default list can't be deleted; rename it instead");
  const d = await db();
  await d.batch([d.prepare("DELETE FROM list_items WHERE list_id = ?").bind(id), d.prepare("DELETE FROM lists WHERE id = ?").bind(id)]);
}

const itemStatement = (d: D1Database, listId: string, problemId: string, section: string | null, now: string) =>
  d.prepare("INSERT INTO list_items (list_id, problem_id, section, added_at) VALUES (?, ?, ?, ?) ON CONFLICT(list_id, problem_id) DO UPDATE SET section = COALESCE(excluded.section, list_items.section)")
    .bind(listId, problemId, section, now);

async function assertList(d: D1Database, listId: string) {
  if (listId !== DEFAULT_LIST_ID && !(await d.prepare("SELECT 1 FROM lists WHERE id = ?").bind(listId).first())) throw new Error("No such list");
}

export async function addToList(listId: string, problemId: string, section: string | null = null) {
  const d = await db();
  await assertList(d, listId);
  await d.batch([...ensureDefaultList(d, listId), itemStatement(d, listId, problemId, section, new Date().toISOString())]);
}

export async function removeFromList(listId: string, problemId: string) {
  const d = await db();
  await d.prepare("DELETE FROM list_items WHERE list_id = ? AND problem_id = ?").bind(listId, problemId).run();
}

/** The default list's row may be missing after a full reset; recreate it before adding to it. */
const ensureDefaultList = (d: D1Database, listId: string) =>
  listId === DEFAULT_LIST_ID ? [d.prepare("INSERT OR IGNORE INTO lists (id, name, created_at) VALUES (?, 'My list', ?)").bind(DEFAULT_LIST_ID, new Date().toISOString())] : [];

// ——— Problems ———

const insertCustom = (d: D1Database, p: Problem, now: string) =>
  d.prepare("INSERT INTO custom_problems (id, title, url, difficulty, topics, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(p.id, p.title, p.url ?? null, asDifficulty(p.difficulty), JSON.stringify(p.topics ?? []), p.note ?? null, now);

/**
 * Create (no id) or update a custom problem. New problems join `listId` (default list if omitted).
 * `{ id: <builtin slug> }` alone adds that built-in problem to the list.
 */
export async function saveProblem(input: Partial<Problem> & { title?: string; listId?: string }, id?: string) {
  const title = input.title?.trim();
  const listId = input.listId || DEFAULT_LIST_ID;
  if (!id && input.id && builtinProblem(input.id)) { await addToList(listId, input.id); return input.id; }
  if (!id && !title) throw new Error("title is required");
  const d = await db();
  if (!id) {
    await assertList(d, listId);
    const now = new Date().toISOString();
    const p: Problem = { id: `custom-${crypto.randomUUID()}`, title: title!, url: input.url ?? null, difficulty: asDifficulty(input.difficulty), topics: input.topics ?? [], note: input.note ?? null, custom: true };
    await d.batch([...ensureDefaultList(d, listId), insertCustom(d, p, now), itemStatement(d, listId, p.id, null, now)]);
    return p.id;
  }
  const sets: string[] = [], vals: unknown[] = [];
  if (title) { sets.push("title = ?"); vals.push(title); }
  if (input.url !== undefined) { sets.push("url = ?"); vals.push(input.url); }
  if (input.difficulty) { sets.push("difficulty = ?"); vals.push(asDifficulty(input.difficulty)); }
  if (input.topics) { sets.push("topics = ?"); vals.push(JSON.stringify(input.topics)); }
  if (input.note !== undefined) { sets.push("note = ?"); vals.push(input.note); }
  if (sets.length) await d.prepare(`UPDATE custom_problems SET ${sets.join(", ")} WHERE id = ?`).bind(...vals, id).run();
  return id;
}

/** Removes a problem's history and every list membership (and the problem itself if it's custom). */
export async function deleteProblem(id: string) {
  const d = await db();
  await d.batch([
    d.prepare("DELETE FROM reviews WHERE problem_id = ?").bind(id),
    d.prepare("DELETE FROM custom_problems WHERE id = ?").bind(id),
    d.prepare("DELETE FROM list_items WHERE problem_id = ?").bind(id),
  ]);
}

export async function saveSettings(patch: Partial<Settings>) {
  const d = await db();
  const known = Object.entries(patch).filter(([k]) => k in DEFAULT_SETTINGS);
  if (known.some(([k, v]) => k === "targetRecall" && (typeof v !== "number" || v < 0.7 || v > 0.97))) throw new Error("targetRecall must be between 0.70 and 0.97");
  if (known.length) await d.batch(known.map(([k, v]) => d.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(k, JSON.stringify(v))));
}

// ——— CSV ———

export async function exportCsv() {
  return toExportCsv(await loadAll());
}

// Links the catalog doesn't know get a live lookup, capped so one import stays inside the Worker's subrequest limit
// (50 per request on the free plan, D1 calls included). Any beyond the cap are titled from their slug.
const LIVE_LOOKUPS = 10;
// Writes go in batches (one D1 round trip and one transaction each), not one query per row.
const BATCH = 200;

/** Resolve LeetCode metadata for new links: the bundled catalog, then a few live lookups in parallel. */
export async function resolveMeta(text: string, state: TransferState) {
  const meta = new Map<string, Meta | null>();
  for (const slug of slugsToResolve(text, state)) meta.set(slug, (await serverCatalogLookup(slug)) ?? null);
  const live = [...meta].filter(([, m]) => !m).slice(0, LIVE_LOOKUPS).map(([slug]) => slug);
  await Promise.all(live.map(async (slug) => meta.set(slug, await lookupLeetCode(slug))));
  return meta;
}

/** Import CSV rows into `listId` (rows can name their own list). Reviews are just appended; FSRS replays on read. */
export async function importCsv(text: string, listId: string = DEFAULT_LIST_ID) {
  const state = await loadAll();
  const plan = planImport(text, state, listId, await resolveMeta(text, state));
  const d = await db();
  const now = new Date().toISOString();
  const statement = (op: ImportOp) =>
    op.kind === "list" ? d.prepare("INSERT INTO lists (id, name, created_at) VALUES (?, ?, ?)").bind(op.id, op.name, now)
    : op.kind === "problem" ? insertCustom(d, op.problem, now)
    : op.kind === "item" ? itemStatement(d, op.listId, op.problemId, op.section, now)
    : d.prepare("INSERT INTO reviews (problem_id, reviewed_at, grade) VALUES (?, ?, ?)").bind(op.problemId, op.date, op.grade);
  const writes = [...ensureDefaultList(d, DEFAULT_LIST_ID), ...plan.ops.map(statement)];
  for (let i = 0; i < writes.length; i += BATCH) await d.batch(writes.slice(i, i + BATCH));
  return plan.result;
}

// ——— Reset ———

/** "progress": delete every solve and review, keep lists, problems and settings. "all": delete everything. */
export async function reset(scope: unknown, confirm: unknown) {
  const s = scope === "progress" ? "progress" : "all";
  if (String(confirm ?? "").trim().toLowerCase() !== RESET_PHRASES[s]) throw new Error(`Type "${RESET_PHRASES[s]}" to confirm`);
  const d = await db();
  const tables = s === "progress" ? ["reviews"] : ["reviews", "custom_problems", "my_list", "list_items", "lists", "settings"];
  await d.batch([...tables.map((t) => d.prepare(`DELETE FROM ${t}`)), ...(s === "all" ? ensureDefaultList(d, DEFAULT_LIST_ID) : [])]);
}
