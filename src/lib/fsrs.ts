// FSRS (Free Spaced Repetition Scheduler) — pure functions, no I/O.
// Formulas follow FSRS-5 with its published default weights.

export type Grade = 1 | 2 | 3 | 4; // Forgot, Struggled, Recalled, Instant
export type Difficulty = "Easy" | "Medium" | "Hard";

export interface Card {
  stability: number; // days until recall drops to 90%
  difficulty: number; // 1 (easy) … 10 (hard)
  lastReview: string; // YYYY-MM-DD
  reps: number;
  lapses: number;
}

export interface ReviewEvent {
  date: string; // YYYY-MM-DD
  grade: Grade | null; // null = first solve
}

const W = [
  0.40255, 1.18385, 3.173, 15.69105, 7.1949, 0.5345, 1.4604, 0.0046, 1.54575,
  0.1192, 1.01925, 1.9395, 0.11, 0.29605, 2.2698, 0.2315, 2.9898, 0.51655,
  0.6621,
];
const F = 19 / 81;
const C = -0.5;
const DAY = 24 * 60 * 60 * 1000;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const toDay = (iso: string) => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / DAY);
export const fromDay = (day: number) => new Date(day * DAY).toISOString().slice(0, 10);
export const daysBetween = (a: string, b: string) => toDay(b) - toDay(a);

export const retrievability = (elapsedDays: number, stability: number) =>
  Math.pow(1 + (F * Math.max(0, elapsedDays)) / stability, C);

export const intervalDays = (stability: number, targetRecall: number) =>
  Math.max(1, Math.round((stability / F) * (Math.pow(targetRecall, 1 / C) - 1)));

const initDifficulty = (g: Grade) => clamp(W[4] - Math.exp(W[5] * (g - 1)) + 1, 1, 10);

const nextDifficulty = (d: number, g: Grade) => {
  const dPrime = d + (-W[6] * (g - 3) * (10 - d)) / 9;
  return clamp(W[7] * initDifficulty(4) + (1 - W[7]) * dPrime, 1, 10);
};

const successStability = (d: number, s: number, r: number, g: Grade) =>
  s *
  (1 +
    Math.exp(W[8]) *
      (11 - d) *
      Math.pow(s, -W[9]) *
      (Math.exp(W[10] * (1 - r)) - 1) *
      (g === 2 ? W[15] : 1) *
      (g === 4 ? W[16] : 1));

const failStability = (d: number, s: number, r: number) =>
  Math.min(s, W[11] * Math.pow(d, -W[12]) * (Math.pow(s + 1, W[13]) - 1) * Math.exp(W[14] * (1 - r)));

// Same-day re-review (FSRS-5 short-term term).
const sameDayStability = (s: number, g: Grade) => s * Math.exp(W[17] * (g - 3 + W[18]));

/** State after the first solve. No grade is asked; LeetCode difficulty seeds it. */
export function firstSolve(date: string, difficulty: Difficulty = "Medium", grade: Grade | null = null): Card {
  const g: Grade = grade ?? (difficulty === "Hard" ? 2 : 3);
  let s = W[g - 1];
  let d = initDifficulty(g);
  if (grade === null && difficulty === "Medium") {
    s *= 0.65;
    d = clamp(d + 1, 1, 10);
  }
  return { stability: s, difficulty: d, lastReview: date, reps: 1, lapses: g === 1 ? 1 : 0 };
}

export function review(card: Card, date: string, grade: Grade): Card {
  const elapsed = daysBetween(card.lastReview, date);
  const r = retrievability(elapsed, card.stability);
  const stability =
    elapsed <= 0
      ? sameDayStability(card.stability, grade)
      : grade === 1
        ? failStability(card.difficulty, card.stability, r)
        : successStability(card.difficulty, card.stability, r, grade);
  return {
    stability: Math.max(0.1, stability),
    difficulty: nextDifficulty(card.difficulty, grade),
    lastReview: date,
    reps: card.reps + 1,
    lapses: card.lapses + (grade === 1 ? 1 : 0),
  };
}

/** Rebuild a card from its review log (first event = first solve). */
export function replay(events: ReviewEvent[], difficulty: Difficulty = "Medium"): Card | null {
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  if (!sorted.length) return null;
  let card = firstSolve(sorted[0].date, difficulty, sorted[0].grade);
  for (const e of sorted.slice(1)) card = review(card, e.date, e.grade ?? 3);
  return card;
}

export const dueDate = (card: Card, targetRecall: number) =>
  fromDay(toDay(card.lastReview) + intervalDays(card.stability, targetRecall));

/** Interval each grade would give if the card were reviewed on `date` (for button labels). */
export const previewIntervals = (card: Card, date: string, targetRecall: number) =>
  ([1, 2, 3, 4] as Grade[]).map((g) => intervalDays(review(card, date, g).stability, targetRecall));

/** "Recall the next X reviews" to reach target: X = ⌈(T·n − s) / (1 − T)⌉, never negative. */
export const recallsToTarget = (reviews: number, successes: number, target: number) =>
  Math.max(0, Math.ceil((target * reviews - successes) / (1 - target)));
