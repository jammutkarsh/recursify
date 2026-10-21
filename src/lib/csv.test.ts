import { expect, test } from "bun:test";
import { csvRecords, parseCsv, toCsv, importRecords } from "./csv";

test("round-trips quotes, commas and newlines", () => {
  const rows = [["title", "note"], ['Say "hi", then', "line1\nline2"]];
  expect(parseCsv(toCsv(rows))).toEqual(rows);
});

test("records use lower-cased headers, skip blank lines, strip BOM", () => {
  const recs = csvRecords("﻿Title,URL\r\nTwo Sum,https://leetcode.com/problems/two-sum/\r\n\r\n");
  expect(recs).toEqual([{ title: "Two Sum", url: "https://leetcode.com/problems/two-sum/" }]);
});

test("import accepts a url column alone, or bare LeetCode links with no header", () => {
  expect(importRecords("url\nhttps://leetcode.com/problems/two-sum/\n")).toEqual({ header: true, rows: [{ url: "https://leetcode.com/problems/two-sum/" }] });
  expect(importRecords("https://leetcode.com/problems/two-sum/\nhttps://leetcode.com/problems/lru-cache/description/\n").rows.map((r) => r.url))
    .toEqual(["https://leetcode.com/problems/two-sum/", "https://leetcode.com/problems/lru-cache/description/"]);
  expect(() => importRecords("name,level\nfoo,1\n")).toThrow('No "title" or "url" column found.');
});
