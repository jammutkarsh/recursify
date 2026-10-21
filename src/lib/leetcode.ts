/// <reference types="vite/client" />
import catalogUrl from "../data/leetcode.json?url";
import type { Problem } from "./catalog";
import type { Difficulty } from "./fsrs";

/** A LeetCode problem from the bundled catalog. Not stored anywhere until the user logs or adds it (then it becomes a custom problem). */
export type CatalogProblem = Problem & { number: number; paid: boolean; lower: string };
type Packed = { tags: string[]; problems: [number, string, string, number, number, number[]][] };

const DIFF: Difficulty[] = ["Easy", "Medium", "Hard"];
const url = (slug: string) => `https://leetcode.com/problems/${slug}/`;

/** src/data/leetcode.json (written by scripts/sync-catalog.ts) → problems by slug. Tags are most specific first. */
export function unpack({ tags, problems }: Packed): Map<string, CatalogProblem> {
  return new Map(problems.map(([number, slug, title, d, paid, t]) => [slug, {
    id: slug, number, title, lower: title.toLowerCase(), url: url(slug), difficulty: DIFF[d] ?? "Medium", topics: t.map((i) => tags[i]), paid: paid === 1, note: null,
  }]));
}

// Refreshed weekly by .github/workflows/sync-catalog.yml on the data-only `catalog` branch, so every deployment
// (forks too) sees new problems without a release. Bump v1 if the packed format ever changes.
const LIVE_CATALOG = "https://cdn.jsdelivr.net/gh/jammutkarsh/recursify@catalog/v1/leetcode.json";

const fetchPacked = async (src: string, ms: number) => {
  const p = (await (await fetch(src, { signal: AbortSignal.timeout(ms) })).json()) as Packed;
  if (!Array.isArray(p?.tags) || !Array.isArray(p?.problems) || p.problems.length < 3000) throw new Error("bad catalog");
  return p;
};

let loading: Promise<Map<string, CatalogProblem>> | null = null;
/** Browser: fetch the catalog once (~110 KB gzipped), only when search needs it. Live copy first, the release's bundled copy if that fails. */
export const loadCatalog = () =>
  (loading ??= fetchPacked(LIVE_CATALOG, 5000).catch(() => fetchPacked(catalogUrl, 15000)).then(unpack).catch((e) => { loading = null; throw e; }));

/** Worker: the catalog, imported on first use so other routes don't parse it. */
let serverCatalog: Promise<Map<string, CatalogProblem>> | null = null;
export const serverCatalogLookup = async (slug: string) =>
  (await (serverCatalog ??= import("../data/leetcode.json").then((m) => unpack(m.default as Packed)))).get(slug);

/** Catalog matches for a search box: by number ("1", "#1") or title substring, skipping ids already shown. */
export function searchCatalog(catalog: Map<string, CatalogProblem> | null, query: string, skip: Set<string>, limit: number): CatalogProblem[] {
  if (!catalog || limit <= 0) return [];
  const q = query.trim().toLowerCase().replace(/^#/, "");
  const out: CatalogProblem[] = [];
  if (/^\d+$/.test(q)) { for (const p of catalog.values()) if (String(p.number) === q && !skip.has(p.id)) return [p]; return []; }
  for (const p of catalog.values()) { if (p.lower.includes(q) && !skip.has(p.id)) { out.push(p); if (out.length >= limit) break; } }
  return out;
}

const fromMirror = async (slug: string) => {
  const res = await fetch(`https://leetcode-api-pied.vercel.app/problem/${encodeURIComponent(slug)}`, { signal: AbortSignal.timeout(6000) });
  if (!res.ok) return null;
  const p = (await res.json()) as { title?: string; difficulty?: string; topicTags?: { name?: string }[] };
  return p.title ? { title: p.title, difficulty: p.difficulty, topics: (p.topicTags ?? []).map((t) => t.name ?? "") } : null;
};

const fromLeetCode = async (slug: string) => {
  const res = await fetch("https://leetcode.com/graphql", {
    method: "POST", headers: { "content-type": "application/json", referer: url(slug) }, signal: AbortSignal.timeout(6000),
    body: JSON.stringify({ query: "query($s:String!){question(titleSlug:$s){title difficulty topicTags{name}}}", variables: { s: slug } }),
  });
  if (!res.ok) return null;
  const q = ((await res.json()) as { data?: { question?: { title: string; difficulty: string; topicTags: { name: string }[] } | null } }).data?.question;
  return q ? { title: q.title, difficulty: q.difficulty, topics: q.topicTags.map((t) => t.name) } : null;
};

/** Worker: metadata for a problem newer than the catalog. Mirror first, LeetCode's GraphQL second; null = enter it by hand. */
export async function lookupLeetCode(slug: string): Promise<Omit<Problem, "id"> | null> {
  const hit = await serverCatalogLookup(slug);
  if (hit) return { title: hit.title, url: hit.url, difficulty: hit.difficulty, topics: hit.topics };
  for (const source of [fromMirror, fromLeetCode]) {
    const p = await source(slug).catch(() => null);
    if (p) return { title: p.title, url: url(slug), difficulty: (DIFF as string[]).includes(p.difficulty ?? "") ? (p.difficulty as Difficulty) : "Medium", topics: p.topics.filter(Boolean) };
  }
  return null;
}
