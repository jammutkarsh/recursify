import { env } from "cloudflare:workers";
import { RENAMED_IDS } from "./catalog";

// Ordered, append-only. Never edit or drop an applied step; add a new one.
const MIGRATIONS = [
  `CREATE TABLE IF NOT EXISTS custom_problems (
     id TEXT PRIMARY KEY,
     title TEXT NOT NULL,
     url TEXT,
     difficulty TEXT NOT NULL DEFAULT 'Medium',
     topics TEXT NOT NULL DEFAULT '[]',
     note TEXT,
     created_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS reviews (
     id INTEGER PRIMARY KEY AUTOINCREMENT,
     problem_id TEXT NOT NULL,
     reviewed_at TEXT NOT NULL,
     grade INTEGER CHECK (grade IS NULL OR grade BETWEEN 1 AND 4)
   )`,
  `CREATE INDEX IF NOT EXISTS reviews_problem ON reviews (problem_id, reviewed_at)`,
  `CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  // My list = custom problems plus any built-in problems the user adds or imports.
  `CREATE TABLE IF NOT EXISTS my_list (problem_id TEXT PRIMARY KEY, added_at TEXT NOT NULL)`,
  `INSERT OR IGNORE INTO my_list (problem_id, added_at) SELECT id, created_at FROM custom_problems`,
  // Named lists. Each item carries its own section (the list's topic for that problem), like the built-in lists.
  // My list becomes the default list "custom"; the old my_list table is no longer read.
  `CREATE TABLE IF NOT EXISTS lists (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS list_items (
     list_id TEXT NOT NULL,
     problem_id TEXT NOT NULL,
     section TEXT,
     added_at TEXT NOT NULL,
     PRIMARY KEY (list_id, problem_id)
   )`,
  `INSERT OR IGNORE INTO lists (id, name, created_at) VALUES ('custom', 'My list', strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`,
  `INSERT OR IGNORE INTO list_items (list_id, problem_id, section, added_at) SELECT 'custom', problem_id, NULL, added_at FROM my_list ORDER BY added_at`,
  // Five NeetCode problems had made-up ids; move their history and list entries to LeetCode's real slugs.
  // One statement per step (a step is a single prepared statement). Order is fixed by RENAMED_IDS, which only ever grows.
  ...Object.entries(RENAMED_IDS).flatMap(([from, to]) => [
    `UPDATE reviews SET problem_id = '${to}' WHERE problem_id = '${from}'`,
    `UPDATE OR IGNORE list_items SET problem_id = '${to}' WHERE problem_id = '${from}'`,
    `DELETE FROM list_items WHERE problem_id = '${from}'`, // left over only if the list already had the correct id
  ]),
];

let ready: Promise<D1Database> | null = null;

/** The D1 database with the schema applied. Runs migrations once per isolate. */
export function db(): Promise<D1Database> {
  ready ??= (async () => {
    const d = env.DB;
    await d.exec(`CREATE TABLE IF NOT EXISTS _migrations (step INTEGER PRIMARY KEY)`);
    const done = await d.prepare(`SELECT COALESCE(MAX(step), -1) AS last FROM _migrations`).first<{ last: number }>();
    for (let step = (done?.last ?? -1) + 1; step < MIGRATIONS.length; step++) {
      await d.batch([d.prepare(MIGRATIONS[step]), d.prepare(`INSERT INTO _migrations (step) VALUES (?)`).bind(step)]);
    }
    return d;
  })().catch((e) => {
    ready = null; // retry on next request instead of caching the failure
    throw e;
  });
  return ready;
}
