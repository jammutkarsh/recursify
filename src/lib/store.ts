// Server-side data access. Every function assumes the caller already checked auth.
import { builtinByTitle, builtinProblem, slugFromUrl, titleFromSlug, type Problem } from "./catalog";
import { lookupLeetCode, serverCatalogLookup } from "./leetcode";
import { importRecords, toCsv } from "./csv";
import { db } from "./db";
import type { Difficulty, Grade } from "./fsrs";
import { DEFAULT_SETTINGS, type ReviewRow, type Settings } from "./settings";

export { DEFAULT_SETTINGS, type ReviewRow, type Settings };

const DIFFS = ["Easy", "Medium", "Hard"];
const asDifficulty = (v: unknown): Difficulty => (DIFFS.includes(String(v)) ? (v as Difficulty) : "Medium");
const asGrade = (v: unknown): Grade | null => {
  const s = String(v ?? "").trim().toLowerCase();
  if (!s) return null;
  const n = ({ forgot: 1, struggled: 2, recalled: 3, instant: 4 } as Record<string, number>)[s] ?? Number(s);
  if (![1, 2, 3, 4].includes(n)) throw new Error(`Invalid grade "${v}"`);
  return n as Grade;
};
const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

const rowToProblem = (r: Record<string, unknown>): Problem => ({
  id: r.id as string, title: r.title as string, url: (r.url as string) ?? null,
  difficulty: asDifficulty(r.difficulty), topics: JSON.parse((r.topics as string) || "[]"), note: (r.note as string) ?? null, custom: true,
});

export async function loadAll() {
  const d = await db();
  const [s, c, r, m] = await d.batch([
    d.prepare("SELECT key, value FROM settings"),
    d.prepare("SELECT * FROM custom_problems ORDER BY created_at"),
    d.prepare("SELECT id, problem_id, reviewed_at, grade FROM reviews ORDER BY reviewed_at, id"),
    d.prepare("SELECT problem_id FROM my_list ORDER BY added_at"),
  ]);
  const settings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of s.results as { key: string; value: string }[]) if (key in settings) (settings as Record<string, unknown>)[key] = JSON.parse(value);
  return {
    settings,
    customProblems: (c.results as Record<string, unknown>[]).map(rowToProblem),
    myList: (m.results as { problem_id: string }[]).map((x) => x.problem_id),
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

export async function addToMyList(problemId: string) {
  const d = await db();
  await d.prepare("INSERT OR IGNORE INTO my_list (problem_id, added_at) VALUES (?, ?)").bind(problemId, new Date().toISOString()).run();
}

/** Statements that create a custom problem and put it on My list. */
const insertCustom = (d: D1Database, id: string, input: Partial<Problem> & { title: string }, now: string) => [
  d.prepare("INSERT INTO custom_problems (id, title, url, difficulty, topics, note, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(id, input.title, input.url ?? null, asDifficulty(input.difficulty), JSON.stringify(input.topics ?? []), input.note ?? null, now),
  d.prepare("INSERT OR IGNORE INTO my_list (problem_id, added_at) VALUES (?, ?)").bind(id, now),
];

/** Create (no id) or update a custom problem. `{ id: <builtin slug> }` alone adds a built-in problem to My list. */
export async function saveProblem(input: Partial<Problem> & { title?: string }, id?: string) {
  const title = input.title?.trim();
  if (!id && input.id && builtinProblem(input.id)) { await addToMyList(input.id); return input.id; }
  if (!id && !title) throw new Error("title is required");
  const d = await db();
  if (!id) {
    const newId = `custom-${crypto.randomUUID()}`;
    await d.batch(insertCustom(d, newId, { ...input, title }, new Date().toISOString()));
    return newId;
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

export async function deleteProblem(id: string) {
  const d = await db();
  await d.batch([
    d.prepare("DELETE FROM reviews WHERE problem_id = ?").bind(id),
    d.prepare("DELETE FROM custom_problems WHERE id = ?").bind(id),
    d.prepare("DELETE FROM my_list WHERE problem_id = ?").bind(id),
  ]);
}

export async function saveSettings(patch: Partial<Settings>) {
  const d = await db();
  const known = Object.entries(patch).filter(([k]) => k in DEFAULT_SETTINGS);
  if (known.some(([k, v]) => k === "targetRecall" && (typeof v !== "number" || v < 0.7 || v > 0.97))) throw new Error("targetRecall must be between 0.70 and 0.97");
  if (known.length) await d.batch(known.map(([k, v]) => d.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value").bind(k, JSON.stringify(v))));
}

const GRADE_NAMES = ["", "Forgot", "Struggled", "Recalled", "Instant"];

export async function exportCsv() {
  const { customProblems, reviews, myList } = await loadAll();
  const custom = new Map(customProblems.map((p) => [p.id, p]));
  const meta = (id: string) => custom.get(id) ?? builtinProblem(id);
  const rows: unknown[][] = [["title", "url", "difficulty", "topic", "note", "reviewed_at", "grade"]];
  const seen = new Set<string>();
  for (const r of reviews) {
    const p = meta(r.problemId); if (!p) continue;
    seen.add(p.id);
    rows.push([p.title, p.url ?? "", p.difficulty, p.topics.join("; "), p.note ?? "", r.date, r.grade ? GRADE_NAMES[r.grade] : ""]);
  }
  for (const id of myList) { const p = meta(id); if (p && !seen.has(id)) rows.push([p.title, p.url ?? "", p.difficulty, p.topics.join("; "), p.note ?? "", "", ""]); }
  return toCsv(rows);
}

// Links the catalog doesn't know get a live lookup, capped so one import stays inside the Worker's subrequest limit
// (50 per request on the free plan, D1 calls included). Any beyond the cap are titled from their slug.
const LIVE_LOOKUPS = 10;
// Writes go in batches (one D1 round trip and one transaction each), not one query per row.
const BATCH = 200;

/** Import rows (title or LeetCode url, difficulty, topic, note, reviewed_at, grade). Reviews are just appended; FSRS replays on read. */
export async function importCsv(text: string) {
  const records = importRecords(text);
  const { customProblems, reviews, myList } = await loadAll();
  const myListSet = new Set(myList);
  const byTitle = new Map(customProblems.map((p) => [p.title.toLowerCase(), p.id]));
  const bySlug = new Map(customProblems.flatMap((p) => { const s = p.url && slugFromUrl(p.url); return s ? [[s, p.id] as const] : []; }));
  const existing = new Set(reviews.map((r) => `${r.problemId}|${r.date}|${r.grade ?? ""}`));
  const result = { problems: 0, reviews: 0, skipped: 0, errors: [] as string[] };

  // Metadata for new links: the bundled catalog first, then a few live lookups in parallel.
  const meta = new Map<string, Omit<Problem, "id"> | null>();
  for (const r of records) {
    const slug = r.url ? slugFromUrl(r.url) : null;
    if (slug && !builtinProblem(slug) && !bySlug.has(slug) && !meta.has(slug)) meta.set(slug, (await serverCatalogLookup(slug)) ?? null);
  }
  const live = [...meta].filter(([, m]) => !m).slice(0, LIVE_LOOKUPS).map(([slug]) => slug);
  await Promise.all(live.map(async (slug) => meta.set(slug, await lookupLeetCode(slug))));

  const d = await db();
  const now = new Date().toISOString();
  const writes: D1PreparedStatement[] = [];
  for (const [i, rec] of records.entries()) {
    try {
      const slug = rec.url ? slugFromUrl(rec.url) : null;
      if (!rec.title && !slug) throw new Error("needs a title or a LeetCode link");
      if (rec.reviewed_at && !isDate(rec.reviewed_at)) throw new Error("reviewed_at must be YYYY-MM-DD");
      const grade = rec.reviewed_at ? asGrade(rec.grade) : null;
      let id = slug && builtinProblem(slug) ? slug : (slug && bySlug.get(slug)) || (rec.title ? builtinByTitle(rec.title)?.id ?? byTitle.get(rec.title.toLowerCase()) : undefined);
      if (!id) {
        const known = slug ? meta.get(slug) : null;
        const title = rec.title || known?.title || titleFromSlug(slug!);
        id = `custom-${crypto.randomUUID()}`;
        writes.push(...insertCustom(d, id, { title, url: rec.url || null, difficulty: (rec.difficulty || known?.difficulty) as Difficulty,
          topics: rec.topic ? rec.topic.split(";").map((t) => t.trim()).filter(Boolean) : (known?.topics ?? []), note: rec.note || null }, now));
        byTitle.set(title.toLowerCase(), id); if (slug) bySlug.set(slug, id); result.problems++;
      } else if (!rec.reviewed_at && !myListSet.has(id)) { // bare rows = list membership; review rows are history only
        writes.push(d.prepare("INSERT OR IGNORE INTO my_list (problem_id, added_at) VALUES (?, ?)").bind(id, now)); result.problems++;
      }
      myListSet.add(id);
      if (rec.reviewed_at) {
        const key = `${id}|${rec.reviewed_at}|${grade ?? ""}`;
        if (existing.has(key)) { result.skipped++; continue; }
        writes.push(d.prepare("INSERT INTO reviews (problem_id, reviewed_at, grade) VALUES (?, ?, ?)").bind(id, rec.reviewed_at, grade));
        existing.add(key); result.reviews++;
      }
    } catch (e) {
      result.errors.push(`Row ${i + 2}: ${(e as Error).message}`);
    }
  }
  for (let i = 0; i < writes.length; i += BATCH) await d.batch(writes.slice(i, i + BATCH));
  return result;
}

export const RESET_PHRASE = "delete all my data";

/** Wipe everything the user created: reviews, custom problems, My list and settings. */
export async function resetAll(confirm: unknown) {
  if (String(confirm ?? "").trim().toLowerCase() !== RESET_PHRASE) throw new Error(`Type "${RESET_PHRASE}" to confirm`);
  const d = await db();
  await d.batch(["reviews", "custom_problems", "my_list", "settings"].map((t) => d.prepare(`DELETE FROM ${t}`)));
}
