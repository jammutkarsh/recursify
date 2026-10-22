import { expect, test } from "bun:test";
import raw from "../data/leetcode.json";
import { buildModel } from "./derive";
import { BUILTIN_LISTS, builtinProblem, combineLists, RENAMED_IDS, sectionsOf, userList, type Problem } from "./catalog";
import { unpack } from "./leetcode";
import { DEFAULT_SETTINGS, type UserList } from "./settings";

const custom = (id: string, topics: string[]): Problem => ({ id, title: id, url: null, difficulty: "Medium", topics, custom: true });
const catalog = unpack(raw as Parameters<typeof unpack>[0]);

test("a user list is grouped into NeetCode's topics, so following it keeps the polygon small", () => {
  const fromLink = catalog.get("aggregate-two-time-series")!; // logged from just its link: catalog tags, most specific first
  const lru = catalog.get("lru-cache")!;
  const problems = new Map<string, Problem>([
    ["custom-a", custom("custom-a", [])],                                    // no topic
    ["custom-b", custom("custom-b", ["System Design"])],                     // the user's own topic, nothing maps it
    ["custom-c", custom("custom-c", ["Dynamic Programming"])],               // LeetCode tag → NeetCode name
    ["custom-d", { ...fromLink, id: "custom-d", custom: true }],
    ["custom-e", custom("custom-e", ["hash table"])],
    ["custom-f", { ...lru, id: "custom-f", topics: ["Design", ...lru.topics], custom: true }], // pattern with no alias: falls back to its tags
    ["custom-g", custom("custom-g", ["Two Heaps"])],                          // common pattern name
  ]);
  const list: UserList = { id: "list-1", name: "Patterns", items: [
    ...["custom-a", "custom-b", "custom-c", "custom-d"].map((id) => ({ id, section: null })),
    { id: "two-sum", section: "Hash Table" },  // in NeetCode 150: its NeetCode section wins
    { id: "custom-e", section: null }, { id: "custom-f", section: "Design" }, { id: "custom-g", section: null },
  ] };
  const def = userList(list, (id) => problems.get(id) ?? (id === "two-sum" ? { id, title: "Two Sum", url: null, difficulty: "Easy", topics: ["Arrays & Hashing"] } : undefined));
  expect(sectionsOf(def)).toEqual(["Arrays & Hashing", "Two Pointers", "Linked Lists", "Heap/Priority Queue", "1-D DP", "System Design", "Uncategorised"]);
  expect(def.sections.filter((s) => s.section === "Arrays & Hashing").map((s) => s.id)).toEqual(["two-sum", "custom-e"]);
  // Followed together with NeetCode 150, only the user's own unmapped topic adds a wedge.
  const both = combineLists([{ id: "neetcode150", name: "", sections: [] }, def], (id) => problems.get(id));
  expect(sectionsOf(both).filter((s) => !["Arrays & Hashing", "Two Pointers", "Linked Lists", "Heap/Priority Queue", "1-D DP", "Uncategorised"].includes(s))).toEqual(["System Design"]);
});

test("the model shows lists the user made, even empty ones, but hides the default list until it has a problem", () => {
  const lists: UserList[] = [{ id: "custom", name: "My list", items: [] }, { id: "list-1", name: "Graphs drill", items: [] }];
  const data = { settings: DEFAULT_SETTINGS, reviews: [], customProblems: [custom("custom-x", ["Graph Theory"])], lists };
  const ids = (d: typeof data) => buildModel(d, "2026-10-21").lists.filter((l) => l.custom).map((l) => l.id);
  expect(ids(data)).toEqual(["list-1"]);
  const filled = { ...data, lists: [{ ...lists[0], items: [{ id: "custom-x", section: null }, { id: "lru-cache", section: null }] }, lists[1]] };
  expect(ids(filled)).toEqual(["custom", "list-1"]);
  expect(sectionsOf(buildModel(filled, "2026-10-21").list("custom"))).toEqual(["Linked Lists", "Graphs"]);
  expect(buildModel(filled, "2026-10-21").listsOf("lru-cache").map((l) => l.name)).toEqual(["My list"]);
});

test("every built-in problem uses LeetCode's real slug, so its link and catalog lookups work", () => {
  const wrong = BUILTIN_LISTS.flatMap((l) => l.sections.map((s) => s.id)).filter((id) => !catalog.has(id));
  expect(wrong).toEqual([]);
  for (const [from, to] of Object.entries(RENAMED_IDS)) { expect(builtinProblem(from)).toBeUndefined(); expect(builtinProblem(to)?.url).toContain(to); }
});
