import { expect, test } from "bun:test";
import type { Problem } from "./catalog";
import { exportCsv, planImport, type ImportOp, type TransferState } from "./transfer";

const empty = (): TransferState => ({ customProblems: [], lists: [{ id: "custom", name: "My list", items: [] }], reviews: [] });
let n = 0;
const ids = () => `id${++n}`;
/** Apply a plan's operations to an in-memory state, the way the demo and the server do. */
const apply = (s: TransferState, ops: ImportOp[]) => {
  for (const op of ops) {
    if (op.kind === "list") s.lists.push({ id: op.id, name: op.name, items: [] });
    else if (op.kind === "problem") s.customProblems.push(op.problem);
    else if (op.kind === "item") { const l = s.lists.find((x) => x.id === op.listId)!; const it = l.items.find((x) => x.id === op.problemId); if (it) it.section = op.section ?? it.section; else l.items.push({ id: op.problemId, section: op.section }); }
    else s.reviews.push({ id: s.reviews.length + 1, problemId: op.problemId, date: op.date, grade: op.grade });
  }
  return s;
};

test("rows join the chosen list with their topic as section; a link alone is enough", () => {
  const meta = new Map<string, Omit<Problem, "id"> | null>([["aggregate-two-time-series", { title: "Aggregate Two Time Series", url: "https://leetcode.com/problems/aggregate-two-time-series/", difficulty: "Medium", topics: ["Two Pointers", "Array"] }]]);
  const csv = "title,url,topic\n,https://leetcode.com/problems/two-sum/,Hash Table\n,https://leetcode.com/problems/aggregate-two-time-series/,\nRate limiter,,System Design\n,,Graphs\n";
  const plan = planImport(csv, empty(), "custom", meta, ids);
  expect(plan.result).toEqual({ problems: 3, reviews: 0, skipped: 0, errors: ["Line 5: needs a title or a LeetCode link"] });
  const s = apply(empty(), plan.ops);
  expect(s.lists[0].items.map((it) => [it.id.startsWith("custom-") ? s.customProblems.find((p) => p.id === it.id)!.title : it.id, it.section]))
    .toEqual([["two-sum", "Hash Table"], ["Aggregate Two Time Series", null], ["Rate limiter", "System Design"]]);
  expect(s.customProblems.find((p) => p.title === "Aggregate Two Time Series")!.topics).toEqual(["Two Pointers", "Array"]);
});

test("a list column creates lists by name; re-importing the same file changes nothing", () => {
  const csv = "url,topic,list\nhttps://leetcode.com/problems/two-sum/,Hash Table,Patterns\nhttps://leetcode.com/problems/lru-cache/,Design,patterns\nhttps://leetcode.com/problems/word-break/,,\n";
  const s = apply(empty(), planImport(csv, empty(), "custom", new Map(), ids).ops);
  expect(s.lists.map((l) => [l.name, l.items.map((it) => it.id)])).toEqual([["My list", ["word-break"]], ["Patterns", ["two-sum", "lru-cache"]]]);
  const again = planImport(csv, s, "custom", new Map(), ids);
  expect(again.ops).toEqual([]);
  expect(again.rows.map((r) => r.status)).toEqual(["in list", "in list", "in list"]);
});

test("export then import rebuilds lists, sections and history in a fresh account", () => {
  // A custom problem that lives only in a named list, with history: the case that breaks if export puts reviews first.
  const s = apply(empty(), planImport("title,url,topic,list\n,https://leetcode.com/problems/two-sum/,Hash Table,Patterns\nRate limiter,,System Design,Patterns\nQueue drill,,,\n", empty(), "custom", new Map(), ids).ops);
  apply(s, planImport("title,reviewed_at,grade\nTwo Sum,2026-10-01,\nTwo Sum,2026-10-04,Recalled\nRate limiter,2026-10-02,Instant\n", s, "custom", new Map(), ids).ops);
  const copy = apply(empty(), planImport(exportCsv(s), empty(), "custom", new Map(), ids).ops);
  const shape = (x: TransferState) => ({
    lists: x.lists.map((l) => [l.name, l.items.map((it) => [x.customProblems.find((p) => p.id === it.id)?.title ?? it.id, it.section])]),
    reviews: x.reviews.map((r) => [x.customProblems.find((p) => p.id === r.problemId)?.title ?? r.problemId, r.date, r.grade]),
  });
  expect(shape(copy)).toEqual(shape(s));
});

test("files of bare links number their lines from 1", () => {
  const plan = planImport("https://leetcode.com/problems/two-sum/\nnot a link\n", empty(), "custom", new Map(), ids);
  expect(plan.rows.map((r) => [r.line, r.status])).toEqual([[1, "added"], [2, "error"]]);
  expect(plan.result.errors).toEqual(["Line 2: needs a title or a LeetCode link"]);
});

test("a problem listed under several topics in one file keeps the first; re-importing can still move it", () => {
  const s = apply(empty(), planImport("url,topic\nhttps://leetcode.com/problems/minimum-window-substring/,Sliding Window\nhttps://leetcode.com/problems/minimum-window-substring/,Monotonic Queue\n", empty(), "custom", new Map(), ids).ops);
  expect(s.lists[0].items).toEqual([{ id: "minimum-window-substring", section: "Sliding Window" }]);
  apply(s, planImport("url,topic\nhttps://leetcode.com/problems/minimum-window-substring/,String\n", s, "custom", new Map(), ids).ops);
  expect(s.lists[0].items).toEqual([{ id: "minimum-window-substring", section: "String" }]);
});
