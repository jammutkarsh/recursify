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

/** Ordered unique sections of a list = polygon wedges. */
export const sectionsOf = (list: ListDef) => [...new Set(list.sections.map((s) => s.section))];

export const slugFromUrl = (input: string) => input.match(/leetcode\.com\/problems\/([^/?#]+)/)?.[1] ?? null;
