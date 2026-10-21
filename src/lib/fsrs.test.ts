import { expect, test } from "bun:test";
import {
  dueDate,
  firstSolve,
  intervalDays,
  previewIntervals,
  recallsToTarget,
  replay,
  retrievability,
  review,
} from "./fsrs";

test("stability is the 90% recall point", () => {
  expect(retrievability(10, 10)).toBeCloseTo(0.9, 5);
  expect(intervalDays(10, 0.9)).toBe(10);
  expect(intervalDays(10, 0.95)).toBeLessThan(10);
});

test("first solve is seeded by difficulty: Easy ~3d, Medium ~2d, Hard ~1d", () => {
  const due = (d: "Easy" | "Medium" | "Hard") => dueDate(firstSolve("2026-10-01", d), 0.9);
  expect(due("Easy")).toBe("2026-10-04");
  expect(due("Medium")).toBe("2026-10-03");
  expect(due("Hard")).toBe("2026-10-02");
});

test("better grades never give shorter intervals", () => {
  const card = firstSolve("2026-10-01", "Medium");
  const [again, hard, good, easy] = previewIntervals(card, "2026-10-04", 0.9);
  expect(again).toBeLessThanOrEqual(hard);
  expect(hard).toBeLessThanOrEqual(good);
  expect(good).toBeLessThanOrEqual(easy);
});

test("forgetting lowers stability and counts a lapse", () => {
  const card = review(firstSolve("2026-10-01", "Easy"), "2026-10-04", 3);
  const lapsed = review(card, "2026-10-20", 1);
  expect(lapsed.stability).toBeLessThan(card.stability);
  expect(lapsed.lapses).toBe(1);
});

test("hard problems grow slower than easy ones on the same grades", () => {
  const grow = (d: "Easy" | "Hard") =>
    replay([{ date: "2026-10-01", grade: null }, { date: "2026-10-05", grade: 3 }, { date: "2026-10-15", grade: 3 }], d)!.stability;
  expect(grow("Hard")).toBeLessThan(grow("Easy"));
});

test("replay is order-independent and handles same-day reviews", () => {
  const events = [
    { date: "2026-10-05", grade: 3 as const },
    { date: "2026-10-01", grade: null },
    { date: "2026-10-05", grade: 4 as const },
  ];
  const card = replay(events, "Medium")!;
  expect(card.reps).toBe(3);
  expect(card.lastReview).toBe("2026-10-05");
  expect(replay([], "Medium")).toBeNull();
});

test("recalls to target", () => {
  expect(recallsToTarget(46, 40, 0.9)).toBe(14);
  expect(recallsToTarget(10, 10, 0.9)).toBe(0);
});
