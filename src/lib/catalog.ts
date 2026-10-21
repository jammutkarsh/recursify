import blind75 from "../data/blind75.json";
import leetcode75 from "../data/leetcode75.json";
import neetcode150 from "../data/neetcode150.json";
import type { Difficulty } from "./fsrs";

export interface Problem {
  id: string; // LeetCode slug, or custom-<uuid>
  title: string;
  url: string | null;
  difficulty: Difficulty;
  topics: string[]; // LeetCode tags or user topics
  custom?: boolean;
  note?: string | null;
}

export interface ListDef {
  id: string;
  name: string;
  custom?: boolean;
  /** problem id → the list's own section, which becomes a polygon wedge */
  sections: { id: string; section: string }[];
}

type Raw = { slug: string; title: string; url: string; difficulty: string; topics?: string[]; listMeta?: { section?: string; module?: string } };

export const CUSTOM_LIST_ID = "custom";

const problems = new Map<string, Problem>();
const toList = (id: string, name: string, raw: Raw[]): ListDef => ({
  id,
  name,
  sections: raw.map((p) => {
    if (!problems.has(p.slug))
      problems.set(p.slug, { id: p.slug, title: p.title, url: p.url, difficulty: p.difficulty as Difficulty, topics: p.topics ?? [] });
    return { id: p.slug, section: p.listMeta?.section ?? p.listMeta?.module ?? p.topics?.[0] ?? "Other" };
  }),
});

export const BUILTIN_LISTS: ListDef[] = [
  toList("neetcode150", "NeetCode 150", neetcode150 as Raw[]),
  toList("blind75", "Blind 75", blind75 as Raw[]),
  toList("leetcode75", "LeetCode 75", leetcode75 as Raw[]),
];

export const builtinProblem = (id: string) => problems.get(id);
export const builtinByTitle = (title: string) => [...problems.values()].find((p) => p.title.toLowerCase() === title.toLowerCase());

/** The user's custom list, shaped like a built-in one. Sections = first topic. */
export const customList = (custom: Problem[]): ListDef => ({
  id: CUSTOM_LIST_ID,
  name: "My list",
  custom: true,
  sections: custom.map((p) => ({ id: p.id, section: p.topics[0] ?? "Uncategorised" })),
});

// Topic names differ per list; map them onto NeetCode's so one polygon can combine lists.
const NEETCODE_ORDER = ["Arrays & Hashing", "Two Pointers", "Sliding Window", "Stack", "Binary Search", "Linked Lists", "Trees", "Tries",
  "Heap/Priority Queue", "Backtracking", "Graphs", "Advanced Graphs", "1-D DP", "2-D DP", "Greedy", "Intervals", "Math & Geometry", "Bit Manipulation"];
const ALIASES: Record<string, string> = {
  "array / string": "Arrays & Hashing", "hash map / set": "Arrays & Hashing", "prefix sum": "Arrays & Hashing", "arrays": "Arrays & Hashing", "array": "Arrays & Hashing", "hashing": "Arrays & Hashing",
  "monotonic stack": "Stack", "queue": "Stack",
  "linked list": "Linked Lists",
  "binary tree - dfs": "Trees", "binary tree - bfs": "Trees", "binary search tree": "Trees", "tree": "Trees",
  "trie": "Tries",
  "heap": "Heap/Priority Queue", "heap / priority queue": "Heap/Priority Queue", "priority queue": "Heap/Priority Queue",
  "graphs - dfs": "Graphs", "graphs - bfs": "Graphs", "graph": "Graphs",
  "1-d dynamic programming": "1-D DP", "dp - 1d": "1-D DP", "dynamic programming": "1-D DP",
  "2-d dynamic programming": "2-D DP", "dp - multidimensional": "2-D DP",
  "math": "Math & Geometry", "geometry": "Math & Geometry", "bit manipulation": "Bit Manipulation",
};
const CANON = new Map(NEETCODE_ORDER.map((n) => [n.toLowerCase(), n]));
export const canonicalTopic = (name: string) => CANON.get(name.toLowerCase()) ?? ALIASES[name.toLowerCase()] ?? name;

export const FOLLOWED_LIST_ID = "followed";

/** One list made of every followed list: each problem once, under its canonical topic (NeetCode's when it's in NeetCode). */
export function combineLists(lists: ListDef[]): ListDef {
  const nc = new Map(BUILTIN_LISTS[0].sections.map((s) => [s.id, s.section]));
  const seen = new Map<string, string>();
  for (const l of lists) for (const s of l.sections) if (!seen.has(s.id)) seen.set(s.id, nc.get(s.id) ?? canonicalTopic(s.section));
  const rank = (t: string) => { const i = NEETCODE_ORDER.indexOf(t); return i < 0 ? NEETCODE_ORDER.length : i; };
  const sections = [...seen].map(([id, section]) => ({ id, section })).sort((a, b) => rank(a.section) - rank(b.section));
  return { id: FOLLOWED_LIST_ID, name: "All followed lists", sections };
}

/** Ordered unique sections of a list = polygon wedges. */
export const sectionsOf = (list: ListDef) => [...new Set(list.sections.map((s) => s.section))];

export const slugFromUrl = (input: string) => input.match(/leetcode\.com\/problems\/([^/?#]+)/)?.[1] ?? null;
