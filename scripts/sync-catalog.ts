// Rebuild src/data/leetcode.json: every LeetCode problem's id, slug, title, difficulty, paid flag and tags.
// Run: bun scripts/sync-catalog.ts   (a weekly GitHub Action runs it too)
// Source: the third-party mirror in one request; LeetCode's own GraphQL as fallback.
import { writeFileSync } from "node:fs";

type Row = { id: number; slug: string; title: string; difficulty: string; paid: boolean; tags: string[] };

async function fromMirror(): Promise<Row[]> {
  const res = await fetch("https://leetcode-api-pied.vercel.app/problems", { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`mirror ${res.status}`);
  const all = (await res.json()) as { frontend_id: string; title_slug: string; title: string; difficulty: string; paid_only: boolean; topic_tags: string[] }[];
  return all.map((p) => ({ id: +p.frontend_id, slug: p.title_slug, title: p.title, difficulty: p.difficulty, paid: p.paid_only, tags: p.topic_tags ?? [] }));
}

async function fromLeetCode(): Promise<Row[]> {
  const query = `query($skip:Int!,$limit:Int!){questionList(categorySlug:"",limit:$limit,skip:$skip,filters:{}){totalNum data{questionFrontendId titleSlug title difficulty paidOnly:isPaidOnly topicTags{name}}}}`;
  const rows: Row[] = [];
  for (let skip = 0, total = Infinity; skip < total; skip += 500) {
    const res = await fetch("https://leetcode.com/graphql", {
      method: "POST", headers: { "content-type": "application/json", referer: "https://leetcode.com/problemset/" },
      body: JSON.stringify({ query, variables: { skip, limit: 500 } }), signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) throw new Error(`leetcode ${res.status}`);
    const { data } = (await res.json()) as { data: { questionList: { totalNum: number; data: { questionFrontendId: string; titleSlug: string; title: string; difficulty: string; paidOnly: boolean; topicTags: { name: string }[] }[] } } };
    total = data.questionList.totalNum;
    rows.push(...data.questionList.data.map((q) => ({ id: +q.questionFrontendId, slug: q.titleSlug, title: q.title, difficulty: q.difficulty, paid: q.paidOnly, tags: q.topicTags.map((t) => t.name) })));
  }
  return rows;
}

// Most specific first, so a problem's first tag is the one that names its pattern (most problems are also tagged "Array").
const PRIORITY = ["Trie", "Union Find", "Union-Find", "Topological Sort", "Shortest Path", "Minimum Spanning Tree", "Heap (Priority Queue)", "Backtracking", "Sliding Window",
  "Monotonic Stack", "Stack", "Linked List", "Binary Search", "Binary Search Tree", "Binary Tree", "Tree", "Graph Theory", "Graph", "Depth-First Search", "Breadth-First Search",
  "Dynamic Programming", "Greedy", "Bit Manipulation", "Two Pointers", "Geometry", "Math", "Hash Table", "Prefix Sum", "Sorting", "String", "Array"];
const rank = (t: string) => { const i = PRIORITY.indexOf(t); return i < 0 ? PRIORITY.length : i; };

let rows: Row[];
try { rows = await fromMirror(); } catch (e) { console.warn(`mirror failed (${(e as Error).message}), using LeetCode GraphQL`); rows = await fromLeetCode(); }
if (rows.length < 3000) throw new Error(`only ${rows.length} problems, refusing to overwrite the catalog`);

const tags = [...new Set(rows.flatMap((r) => r.tags))].sort();
const tagIndex = new Map(tags.map((t, i) => [t, i]));
const DIFF = ["Easy", "Medium", "Hard"];
const problems = rows.sort((a, b) => a.id - b.id).map((r) => [r.id, r.slug, r.title, Math.max(0, DIFF.indexOf(r.difficulty)), r.paid ? 1 : 0,
  [...r.tags].sort((a, b) => rank(a) - rank(b)).map((t) => tagIndex.get(t)!)]);
writeFileSync(new URL("../src/data/leetcode.json", import.meta.url), JSON.stringify({ tags, problems }));
console.log(`catalog: ${problems.length} problems, ${tags.length} tags`);
