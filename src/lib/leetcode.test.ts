import { expect, test } from "bun:test";
import raw from "../data/leetcode.json";
import { searchCatalog, unpack } from "./leetcode";

test("catalog unpacks every problem and searches by number or title", () => {
  const catalog = unpack(raw as Parameters<typeof unpack>[0]);
  expect(catalog.size).toBeGreaterThan(3000);
  const twoSum = catalog.get("two-sum")!;
  expect(twoSum).toMatchObject({ number: 1, title: "Two Sum", difficulty: "Easy", url: "https://leetcode.com/problems/two-sum/" });
  expect(twoSum.topics[0]).toBe("Hash Table"); // most specific tag first, not "Array"
  expect(searchCatalog(catalog, "#1", new Set(), 5).map((p) => p.id)).toEqual(["two-sum"]);
  expect(searchCatalog(catalog, "two sum", new Set(["two-sum"]), 3).every((p) => p.id !== "two-sum" && p.lower.includes("two sum"))).toBe(true);
});
