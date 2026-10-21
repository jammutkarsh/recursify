import { env } from "cloudflare:workers";

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
