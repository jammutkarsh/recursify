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

/** The user's custom list, shaped like a built-in one: grouped into the same topics as the built-in lists. */
export const customList = (custom: Problem[]): ListDef => ({
  id: CUSTOM_LIST_ID,
  name: "My list",
  custom: true,
  sections: inTopicOrder(custom.map((p) => ({ id: p.id, section: topicOf(p.id, p.topics[0] ?? UNCATEGORISED) }))),
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
  // LeetCode tag names (catalog problems' first tag)
  "hash table": "Arrays & Hashing", "string": "Arrays & Hashing", "sorting": "Arrays & Hashing", "binary tree": "Trees",
  "heap (priority queue)": "Heap/Priority Queue", "graph theory": "Graphs", "depth-first search": "Graphs", "breadth-first search": "Graphs",
  "union find": "Graphs", "union-find": "Graphs", "topological sort": "Advanced Graphs", "shortest path": "Advanced Graphs", "minimum spanning tree": "Advanced Graphs",
};
const CANON = new Map(NEETCODE_ORDER.map((n) => [n.toLowerCase(), n]));
export const canonicalTopic = (name: string) => CANON.get(name.toLowerCase()) ?? ALIASES[name.toLowerCase()] ?? name;

export const FOLLOWED_LIST_ID = "followed";
const UNCATEGORISED = "Uncategorised";

/** A problem's canonical topic: NeetCode's section when it's in NeetCode 150, else its own topic mapped onto NeetCode's names. */
const NEETCODE_SECTION = new Map(BUILTIN_LISTS[0].sections.map((s) => [s.id, s.section]));
const topicOf = (id: string, section: string) => NEETCODE_SECTION.get(id) ?? canonicalTopic(section);
/** NeetCode's topic order; other topics after it, alphabetically, and Uncategorised last. Stable within a topic. */
const inTopicOrder = (sections: ListDef["sections"]) => {
  const rank = (t: string) => { const i = NEETCODE_ORDER.indexOf(t); return i >= 0 ? i : t === UNCATEGORISED ? Infinity : NEETCODE_ORDER.length; };
  return [...sections].sort((a, b) => rank(a.section) - rank(b.section) || (rank(a.section) === NEETCODE_ORDER.length ? a.section.localeCompare(b.section) : 0));
};

/** One list made of every followed list: each problem once, under its canonical topic. */
export function combineLists(lists: ListDef[]): ListDef {
  const seen = new Map<string, string>();
  for (const l of lists) for (const s of l.sections) if (!seen.has(s.id)) seen.set(s.id, topicOf(s.id, s.section));
  return { id: FOLLOWED_LIST_ID, name: "All followed lists", sections: inTopicOrder([...seen].map(([id, section]) => ({ id, section }))) };
}

/** Ordered unique sections of a list = polygon wedges. */
export const sectionsOf = (list: ListDef) => [...new Set(list.sections.map((s) => s.section))];

export const slugFromUrl = (input: string) => input.match(/leetcode\.com\/problems\/([^/?#]+)/)?.[1] ?? null;
/** Last-resort title for a LeetCode slug nobody could look up: "two-sum" → "Two Sum". */
export const titleFromSlug = (slug: string) => slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
