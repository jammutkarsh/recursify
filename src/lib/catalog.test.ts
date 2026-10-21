import { expect, test } from "bun:test";
import raw from "../data/leetcode.json";
import { buildModel } from "./derive";
import { customList, sectionsOf, type Problem } from "./catalog";
import { unpack } from "./leetcode";
import { DEFAULT_SETTINGS } from "./settings";

const custom = (id: string, topics: string[]): Problem => ({ id, title: id, url: null, difficulty: "Medium", topics, custom: true });

test("My list is grouped into the same topics as the built-in lists, in NeetCode's order", () => {
  // A problem logged from just its link: catalog tags come most specific first ("Two Pointers", not "Array").
  const fromLink = unpack(raw as Parameters<typeof unpack>[0]).get("aggregate-two-time-series")!;
  const list = customList([
    custom("custom-a", []),                      // no topic
    custom("custom-b", ["System Design"]),       // the user's own topic
    custom("custom-c", ["Dynamic Programming"]), // LeetCode tag → NeetCode name
    { ...fromLink, id: "custom-d", custom: true },
    custom("two-sum", ["Array", "Hash Table"]),  // in NeetCode 150: its NeetCode section wins
    custom("custom-e", ["hash table"]),
  ]);
  expect(sectionsOf(list)).toEqual(["Arrays & Hashing", "Two Pointers", "1-D DP", "System Design", "Uncategorised"]);
  expect(list.sections.filter((s) => s.section === "Arrays & Hashing").map((s) => s.id)).toEqual(["two-sum", "custom-e"]);
});

test("the model exposes My list with those sections once it has problems", () => {
  const data = { settings: DEFAULT_SETTINGS, reviews: [], myList: ["custom-x", "lru-cache"], customProblems: [custom("custom-x", ["Graph Theory"])] };
  const mine = buildModel(data, "2026-10-21").lists.find((l) => l.id === "custom")!;
  expect(sectionsOf(mine)).toEqual(["Linked Lists", "Graphs"]);
  expect(buildModel({ ...data, myList: [], customProblems: [] }, "2026-10-21").lists.some((l) => l.id === "custom")).toBe(false);
});
