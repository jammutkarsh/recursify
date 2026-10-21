import { expect, test } from "bun:test";
import { csvRecords, parseCsv, toCsv } from "./csv";

test("round-trips quotes, commas and newlines", () => {
  const rows = [["title", "note"], ['Say "hi", then', "line1\nline2"]];
  expect(parseCsv(toCsv(rows))).toEqual(rows);
});

test("records use lower-cased headers, skip blank lines, strip BOM", () => {
  const recs = csvRecords("﻿Title,URL\r\nTwo Sum,https://leetcode.com/problems/two-sum/\r\n\r\n");
  expect(recs).toEqual([{ title: "Two Sum", url: "https://leetcode.com/problems/two-sum/" }]);
});
