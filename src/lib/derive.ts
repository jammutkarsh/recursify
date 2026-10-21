// Pure view-model derivation: raw data in, everything the screens show out.
import { BUILTIN_LISTS, builtinProblem, combineLists, customList, FOLLOWED_LIST_ID, sectionsOf, type ListDef, type Problem } from "./catalog";
import { daysBetween, dueDate, firstSolve, fromDay, previewIntervals, recallsToTarget, replay, retrievability, review, toDay, type Card, type Grade } from "./fsrs";
import type { ReviewRow, Settings } from "./settings";

export interface AppData {
  settings: Settings;
  customProblems: Problem[];
  myList: string[];
  reviews: ReviewRow[];
}

export interface Tracked {
  problem: Problem;
  card: Card;
  due: string;
  daysLate: number; // >0 overdue, 0 due today, <0 upcoming
  recall: number; // predicted retrievability today, 0–1
  history: ReviewRow[];
  lastGrade: Grade | null;
  firstSolved: string;
}

export const CATCH_UP_THRESHOLD = 20;
export const CATCH_UP_BATCH = 20;

export function buildModel(data: AppData, today: string) {
  const custom = new Map(data.customProblems.map((p) => [p.id, p]));
  const problem = (id: string): Problem | undefined => custom.get(id) ?? builtinProblem(id);
  const myList = customList(data.myList.map(problem).filter(Boolean) as Problem[]);
  const lists: ListDef[] = myList.sections.length ? [...BUILTIN_LISTS, myList] : BUILTIN_LISTS; // hide My list until it has a problem
  const followed = combineLists(data.settings.followedLists.map((id) => lists.find((l) => l.id === id)).filter(Boolean) as ListDef[]);
  const list = (id: string) => (id === FOLLOWED_LIST_ID ? followed : lists.find((l) => l.id === id) ?? followed);
  const { targetRecall } = data.settings;

  // Cards by replaying each problem's reviews.
  const byProblem = new Map<string, ReviewRow[]>();
  for (const r of data.reviews) (byProblem.get(r.problemId) ?? byProblem.set(r.problemId, []).get(r.problemId)!).push(r);
  const tracked = new Map<string, Tracked>();
  for (const [id, history] of byProblem) {
    const p = problem(id);
    if (!p) continue;
    const card = replay(history.map((h) => ({ date: h.date, grade: h.grade })), p.difficulty);
    if (!card) continue;
    const due = dueDate(card, targetRecall);
    const graded = history.filter((h) => h.grade !== null);
    tracked.set(id, {
      problem: p, card, due,
      daysLate: daysBetween(due, today),
      recall: retrievability(daysBetween(card.lastReview, today), card.stability),
      history,
      lastGrade: graded.length ? graded[graded.length - 1].grade : null,
      firstSolved: history[0].date,
    });
  }

  // Review queue: due today or earlier, most forgotten first. Today's re-reviews drop out (lastReview = today).
  const dueAll = [...tracked.values()].filter((t) => t.daysLate >= 0 && t.card.lastReview !== today).sort((a, b) => a.recall - b.recall);
  const overdue = dueAll.filter((t) => t.daysLate > 0).length;
  const catchUp = overdue > CATCH_UP_THRESHOLD;
  const queue = catchUp ? dueAll.slice(0, CATCH_UP_BATCH) : dueAll;

  // Today's log, newest first.
  const todayReviews = data.reviews.filter((r) => r.date === today).sort((a, b) => b.id - a.id);
  const firstSolvesToday = todayReviews.filter((r) => tracked.get(r.problemId)?.firstSolved === today && r.grade === null).length;

  // Polygon = every followed list combined.
  const polyList = followed;
  const polygon = sectionsOf(polyList).map((name) => {
    const ids = polyList.sections.filter((s) => s.section === name).map((s) => s.id);
    const ts = ids.map((id) => tracked.get(id)).filter(Boolean) as Tracked[];
    const dates = ts.flatMap((t) => t.history.map((h) => h.date)).sort();
    return {
      name, total: ids.length, solved: ts.length, ids,
      lastSolved: ts.map((t) => t.firstSolved).sort().at(-1) ?? null,
      lastReviewed: dates.at(-1) ?? null,
      due: ts.filter((t) => t.daysLate >= 0).length,
    };
  });

  // Next up: unsolved problems from the weakest sections of the polygon list.
  const nextUp = catchUp ? [] : polygon
    .filter((s) => s.solved < s.total)
    .sort((a, b) => a.solved / a.total - b.solved / b.total)
    .flatMap((s) => s.ids.filter((id) => !tracked.has(id)).slice(0, 1).map((id) => ({ problem: problem(id)!, section: s.name, why: s.solved === 0 ? "topic not started" : "weakest topic" })))
    .slice(0, Math.max(0, data.settings.newPerDay - firstSolvesToday));

  // Slipping topic: the polygon section with the most due problems (≥2).
  const slipping = [...polygon].filter((s) => s.due >= 2).sort((a, b) => b.due - a.due)[0] ?? null;

  return { problem, lists, list, tracked, queue, dueAll, overdue, catchUp, todayReviews, nextUp, polygon, polyList, slipping, firstSolvesToday };
}

export type Model = ReturnType<typeof buildModel>;

export const gradeIntervals = (t: Tracked, today: string, targetRecall: number) => previewIntervals(t.card, today, targetRecall);

export function progress(m: Model, data: AppData, today: string) {
  const t0 = toDay(today);
  const followed = new Set(data.settings.followedLists);
  const solvedUnique = m.tracked.size; // every solved problem once, whichever lists it's in
  const since = (days: number) => fromDay(t0 - days);
  const graded = (from: string) => data.reviews.filter((r) => r.grade !== null && r.date >= from && r.date <= today);
  const last12 = graded(since(84));
  const last4 = graded(since(28));
  const successes = last4.filter((r) => (r.grade ?? 0) >= 3).length;
  const activity = new Map<string, number>();
  for (const r of data.reviews) activity.set(r.date, (activity.get(r.date) ?? 0) + 1);
  const activeDays = [...activity.keys()].filter((d) => d >= since(84) && d <= today).length;
  // Bars: overdue, then each of the next 13 days starting today.
  const all = [...m.tracked.values()];
  const upcoming = {
    late: all.filter((t) => t.daysLate > 0).length,
    days: Array.from({ length: 13 }, (_, i) => { const day = fromDay(t0 + i); return { day, n: all.filter((t) => t.due === day && t.card.lastReview !== today).length }; }),
  };
  const weekly = Array.from({ length: 12 }, (_, i) => {
    const from = fromDay(t0 - (12 - i) * 7 + 1), to = fromDay(t0 - (11 - i) * 7);
    const rs = data.reviews.filter((r) => r.grade !== null && r.date >= from && r.date <= to);
    return rs.length ? rs.filter((r) => (r.grade ?? 0) >= 3).length / rs.length : null;
  });
  return {
    solvedUnique,
    solvedThisWeek: data.reviews.filter((r) => r.grade === null && r.date >= since(6)).length,
    reviews12w: last12.length,
    actualRecall: last4.length ? successes / last4.length : null,
    recallsNeeded: recallsToTarget(last4.length, successes, data.settings.targetRecall),
    activeDays,
    perList: m.lists.map((l) => ({ id: l.id, name: l.name, followed: followed.has(l.id), solved: l.sections.filter((s) => m.tracked.has(s.id)).length, total: l.sections.length })),
    activity,
    upcoming,
    weekly,
  };
}

/** Per-review details for the drawer: gap since the previous review and predicted recall at that moment. */
export function historyDetails(t: Tracked) {
  let card = firstSolve(t.history[0].date, t.problem.difficulty, t.history[0].grade);
  return t.history.map((h, i) => {
    if (i === 0) return { ...h, gap: null as number | null, recallThen: null as number | null, stability: card.stability };
    const gap = daysBetween(card.lastReview, h.date);
    const recallThen = retrievability(gap, card.stability);
    card = review(card, h.date, h.grade ?? 3);
    return { ...h, gap, recallThen, stability: card.stability };
  });
}
