import { expect, test } from "bun:test";
import { buildModel, historyDetails, progress, type AppData } from "./derive";
import { DEFAULT_SETTINGS } from "./settings";

const data = (reviews: AppData["reviews"], extra: Partial<AppData> = {}): AppData => ({
  settings: DEFAULT_SETTINGS, customProblems: [], lists: [], reviews, ...extra,
});

test("queue holds due problems, most forgotten first, and drops ones reviewed today", () => {
  const m = buildModel(data([
    { id: 1, problemId: "two-sum", date: "2026-09-01", grade: null }, // long overdue
    { id: 2, problemId: "valid-anagram", date: "2026-10-17", grade: null }, // Easy: due 10-20
    { id: 3, problemId: "contains-duplicate", date: "2026-10-19", grade: null }, // not due yet
  ]), "2026-10-20");
  expect(m.queue.map((t) => t.problem.id)).toEqual(["two-sum", "valid-anagram"]);
  const after = buildModel(data([...m.queue[0].history, { id: 9, problemId: "two-sum", date: "2026-10-20", grade: 3 }]), "2026-10-20");
  expect(after.queue.map((t) => t.problem.id)).not.toContain("two-sum");
});

test("polygon counts solved per NeetCode section and next-up starts weakest topics", () => {
  const m = buildModel(data([{ id: 1, problemId: "two-sum", date: "2026-10-01", grade: null }]), "2026-10-20");
  const arrays = m.polygon.find((s) => s.name === "Arrays & Hashing")!;
  expect(arrays.solved).toBe(1);
  expect(m.polygon.length).toBe(18);
  expect(m.nextUp.length).toBe(3);
  expect(m.nextUp[0].why).toBe("topic not started");
});

test("catch-up kicks in past the overdue threshold and pauses new problems", () => {
  const nc = buildModel(data([]), "2026-10-20").polyList.sections.slice(0, 25);
  const m = buildModel(data(nc.map((s, i) => ({ id: i + 1, problemId: s.id, date: "2026-08-01", grade: null }))), "2026-10-20");
  expect(m.catchUp).toBe(true);
  expect(m.queue.length).toBe(20);
  expect(m.nextUp.length).toBe(0);
});

test("custom problems live in My list; progress counts unique solves in followed lists", () => {
  const d = data(
    [{ id: 1, problemId: "two-sum", date: "2026-10-01", grade: null }, { id: 2, problemId: "custom-x", date: "2026-10-02", grade: null }],
    { customProblems: [{ id: "custom-x", title: "Rate limiter", url: null, difficulty: "Hard", topics: ["System Design"], custom: true }], lists: [{ id: "custom", name: "My list", items: [{ id: "custom-x", section: null }] }], settings: { ...DEFAULT_SETTINGS, followedLists: ["neetcode150", "blind75", "custom"] } },
  );
  const m = buildModel(d, "2026-10-20");
  expect(m.list("custom").sections).toEqual([{ id: "custom-x", section: "System Design" }]);
  const p = progress(m, d, "2026-10-20");
  expect(p.solvedUnique).toBe(2); // two-sum is in NeetCode and Blind 75 but counts once
  expect(p.perList.map((l) => [l.id, l.solved, l.followed])).toEqual([["neetcode150", 1, true], ["blind75", 1, true], ["leetcode75", 0, false], ["custom", 1, true]]);
});

test("history details report the gap and predicted recall at each review", () => {
  const m = buildModel(data([
    { id: 1, problemId: "two-sum", date: "2026-10-01", grade: null },
    { id: 2, problemId: "two-sum", date: "2026-10-04", grade: 3 },
  ]), "2026-10-20");
  const [first, second] = historyDetails(m.tracked.get("two-sum")!);
  expect(first.gap).toBeNull();
  expect(second.gap).toBe(3);
  expect(second.recallThen!).toBeGreaterThan(0.85); // Easy: reviewed right at its 3-day mark
});

test("polygon combines followed lists under shared topic names", () => {
  const base = { ...DEFAULT_SETTINGS, followedLists: ["neetcode150", "blind75", "leetcode75"] };
  const m = buildModel(data([], { settings: base }), "2026-10-20");
  expect(m.polygon.length).toBe(18); // Blind 75 and LeetCode 75 topics fold into NeetCode's 18
  const total = m.polygon.reduce((n, s) => n + s.total, 0);
  const unique = new Set(m.polyList.sections.map((s) => s.id)).size;
  expect(total).toBe(unique); // each problem counted once
  expect(m.polygon.find((s) => s.name === "1-D DP")!.total).toBeGreaterThan(12); // NeetCode's 12 plus extras from LeetCode 75
});
