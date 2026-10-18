"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTracker } from "../context/TrackerContext";
import { Flame, Info, Repeat } from "lucide-react";
import BackToTopButton from "../components/BackToTopButton";
import CustomSetManager from "../components/CustomSetManager";
import Filters from "../components/Filters";
import ProblemTable from "../components/ProblemTable";
import ReviewQueue from "../components/ReviewQueue";
import {
  builtinProblemLists,
  CUSTOM_TRACKING_LIST,
  getAllProblems,
  getCurrentStreak,
  getNextReview,
  getProblemProgressKey,
  getProblemProgress,
  getTodayString,
} from "../lib/tracker";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

const difficultyBar = { Easy: "bg-easy", Medium: "bg-medium", Hard: "bg-hard" };

const countSolved = (problems, progress) =>
  problems.filter((problem) => progress[getProblemProgressKey(problem)]?.solved)
    .length;

const LeetCodeTracker = () => {
  const { trackerState, updateTrackerState, mounted } = useTracker();
  const [filterCategory, setFilterCategory] = useState("All");
  const [filterDifficulty, setFilterDifficulty] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [undo, setUndo] = useState(null);
  const [showBackToTop, setShowBackToTop] = useState(false);

  const { progress, customProblems, uiPreferences, activityLog } =
    trackerState || {
      progress: {},
      customProblems: [],
      activityLog: [],
      uiPreferences: {
        pageSize: 20,
        selectedList: "Blind 75",
        showOnlyDueToday: false,
      },
    };

  const problemLists = useMemo(
    () => ({
      ...builtinProblemLists,
      [CUSTOM_TRACKING_LIST]: customProblems,
    }),
    [customProblems],
  );

  const availableLists = Object.keys(problemLists);
  const selectedList = uiPreferences.selectedList || "Blind 75";
  const activeSelectedList = availableLists.includes(selectedList)
    ? selectedList
    : availableLists[0] || "";

  useEffect(() => {
    const onScroll = () => setShowBackToTop(window.scrollY > 400);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!undo) return;
    const timeoutId = window.setTimeout(() => setUndo(null), 6000);
    return () => window.clearTimeout(timeoutId);
  }, [undo]);

  useEffect(() => {
    document
      .querySelector('[role="tab"][aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
    setSearchQuery("");
    setFilterCategory("All");
    setFilterDifficulty("All");
    setFilterStatus("All");
  }, [activeSelectedList]);

  const currentProgress = progress;
  const problems = useMemo(() => {
    const listProblems = problemLists[activeSelectedList] || [];
    if (activeSelectedList !== CUSTOM_TRACKING_LIST) {
      return listProblems;
    }

    return [...listProblems].sort((left, right) => {
      const leftProgress = currentProgress[getProblemProgressKey(left)];
      const rightProgress = currentProgress[getProblemProgressKey(right)];
      const leftSolvedAt = leftProgress?.solvedDate || "";
      const rightSolvedAt = rightProgress?.solvedDate || "";

      if (leftSolvedAt && rightSolvedAt) {
        return rightSolvedAt.localeCompare(leftSolvedAt);
      }

      if (leftSolvedAt) {
        return -1;
      }

      if (rightSolvedAt) {
        return 1;
      }

      return 0;
    });
  }, [activeSelectedList, currentProgress, problemLists]);
  const today = useMemo(() => getTodayString(), []);

  const reviewQueue = useMemo(
    () =>
      getAllProblems(customProblems)
        .map((problem) => ({
          problem,
          next: getNextReview(currentProgress[getProblemProgressKey(problem)], today),
        }))
        .filter(({ next }) => next && next.state !== "upcoming")
        .sort((left, right) => left.next.daysAway - right.next.daysAway),
    [customProblems, currentProgress, today],
  );

  const statusCounts = useMemo(() => {
    const solved = countSolved(problems, currentProgress);
    const due = problems.filter((problem) => {
      const next = getNextReview(
        currentProgress[getProblemProgressKey(problem)],
        today,
      );
      return next && next.state !== "upcoming";
    }).length;
    return { solved, unsolved: problems.length - solved, due };
  }, [problems, currentProgress, today]);

  const difficultyStats = ["Easy", "Medium", "Hard"].map((difficulty) => {
    const ofDifficulty = problems.filter((p) => p.difficulty === difficulty);
    return {
      difficulty,
      total: ofDifficulty.length,
      solved: countSolved(ofDifficulty, currentProgress),
    };
  });
  const completion = problems.length
    ? Math.round((statusCounts.solved / problems.length) * 100)
    : 0;
  const streak = getCurrentStreak(activityLog, today);
  const activeToday = activityLog.some((entry) => entry.date === today);

  const categories = useMemo(
    () => [
      "All",
      ...Array.from(
        new Set(
          problems.flatMap((problem) => {
            const section =
              (problem as any).listMeta?.section ||
              (problem as any).listMeta?.module;
            const topics = problem.topics || [];
            return section && !topics.includes(section)
              ? [section, ...topics]
              : topics;
          }),
        ),
      ),
    ],
    [problems],
  );

  const filteredProblems = useMemo(
    () =>
      problems.filter((problem) => {
        const categoryMatch =
          filterCategory === "All" ||
          (problem.topics || []).includes(filterCategory) ||
          (problem as any).listMeta?.section === filterCategory ||
          (problem as any).listMeta?.module === filterCategory;
        const difficultyMatch =
          filterDifficulty === "All" || problem.difficulty === filterDifficulty;
        const searchMatch =
          !searchQuery.trim() ||
          problem.title.toLowerCase().includes(searchQuery.toLowerCase());

        if (!categoryMatch || !difficultyMatch || !searchMatch) {
          return false;
        }

        if (filterStatus === "All") {
          return true;
        }

        const prob = currentProgress[getProblemProgressKey(problem)];
        const isSolved = prob?.solved || false;

        if (filterStatus === "Solved") {
          return isSolved;
        }

        if (filterStatus === "Unsolved") {
          return !isSolved;
        }

        if (filterStatus === "Due Today") {
          const next = getNextReview(prob, today);
          return Boolean(next) && next.state !== "upcoming";
        }

        return true;
      }),
    [
      currentProgress,
      filterCategory,
      filterDifficulty,
      problems,
      today,
      searchQuery,
      filterStatus,
    ],
  );

  const toggleComplete = useCallback(
    (problem, reviewIndex = null) => {
      const progressKey = getProblemProgressKey(problem);

      updateTrackerState((prev) => {
        const latest = getProblemProgress(prev.progress, progressKey);

        let newProgressEntry;
        if (reviewIndex === null) {
          const newSolved = !latest.solved;
          newProgressEntry = {
            ...latest,
            solved: newSolved,
            solvedDate: newSolved ? today : null,
            reviews: newSolved ? latest.reviews : Array(5).fill(false),
            dates: newSolved ? { ...latest.dates, initial: today } : {},
          };
        } else {
          const newReviews = [...latest.reviews];
          newReviews[reviewIndex] = !newReviews[reviewIndex];
          const newDates = { ...latest.dates };
          if (newReviews[reviewIndex]) {
            newDates[`review${reviewIndex + 1}`] = today;
          } else {
            delete newDates[`review${reviewIndex + 1}`];
          }
          newProgressEntry = {
            ...latest,
            reviews: newReviews,
            dates: newDates,
          };
        }

        let newActivityLog = prev.activityLog;
        if (reviewIndex === null) {
          if (!latest.solved) {
            newActivityLog = [
              ...prev.activityLog,
              {
                id: crypto.randomUUID(),
                type: "solve",
                date: today,
                listName: activeSelectedList,
                problemKey: progressKey,
                reviewIndex: undefined,
              },
            ];
          } else {
            const toRemove = new Set([
              [progressKey, "solve", latest.solvedDate || today, ""].join(":"),
              ...Object.entries(latest.dates || {}).flatMap(([key, date]) => {
                const match = key.match(/^review(\d+)$/);
                if (!match || !date) return [];
                return [
                  [progressKey, "review", date, Number(match[1]) - 1].join(":"),
                ];
              }),
            ]);
            newActivityLog = prev.activityLog.filter(
              (entry) =>
                !toRemove.has(
                  [
                    entry.problemKey,
                    entry.type,
                    entry.date,
                    entry.reviewIndex ?? "",
                  ].join(":"),
                ),
            );
          }
        } else if (!latest.reviews?.[reviewIndex]) {
          newActivityLog = [
            ...prev.activityLog,
            {
              id: crypto.randomUUID(),
              type: "review",
              date: today,
              listName: activeSelectedList,
              problemKey: progressKey,
              reviewIndex,
            },
          ];
        } else {
          newActivityLog = prev.activityLog.filter(
            (entry) =>
              !(
                entry.problemKey === progressKey &&
                entry.type === "review" &&
                entry.reviewIndex === reviewIndex
              ),
          );
        }

        return {
          ...prev,
          progress: { ...prev.progress, [progressKey]: newProgressEntry },
          activityLog: newActivityLog,
        };
      });
    },
    [updateTrackerState, activeSelectedList, today],
  );

  // Every tracking action goes through here so it can be undone from the toast.
  const track = useCallback(
    (problem, reviewIndex = null) => {
      const status = trackerState.progress[getProblemProgressKey(problem)];
      const label =
        reviewIndex === null
          ? status?.solved
            ? "Marked unsolved"
            : "Solved"
          : status?.reviews?.[reviewIndex]
            ? `Review ${reviewIndex + 1} unmarked`
            : `Review ${reviewIndex + 1} done`;
      setUndo({ label, title: problem.title, snapshot: trackerState });
      toggleComplete(problem, reviewIndex);
    },
    [toggleComplete, trackerState],
  );

  const handleAddCustomProblem = useCallback(
    (problem, { markSolved = false } = {}) => {
      const exists = trackerState.customProblems.some(
        (item) =>
          (item.slug && item.slug === problem.slug) || item.url === problem.url,
      );
      const alreadySolved =
        trackerState.progress[getProblemProgressKey(problem)]?.solved;

      setUndo({
        label: exists ? "Already tracked" : "Added",
        title: problem.title,
        snapshot: trackerState,
      });
      updateTrackerState((prev) => ({
        ...prev,
        customProblems: exists
          ? prev.customProblems
          : [...prev.customProblems, problem],
        uiPreferences: {
          ...prev.uiPreferences,
          selectedList: CUSTOM_TRACKING_LIST,
        },
      }));
      if (markSolved && !alreadySolved) {
        toggleComplete(problem);
      }
      return { ok: true };
    },
    [toggleComplete, trackerState, updateTrackerState],
  );

  const selectList = (listName) =>
    updateTrackerState((prev) => ({
      ...prev,
      uiPreferences: { ...prev.uiPreferences, selectedList: listName },
    }));

  if (!mounted || !trackerState)
    return (
      <div className="mx-auto flex w-full max-w-5xl animate-pulse flex-col gap-4 px-4 py-6">
        <div className="h-9 w-2/3 rounded-lg bg-muted" />
        <div className="h-20 rounded-xl bg-muted/60" />
        <div className="h-96 rounded-xl bg-muted/40" />
      </div>
    );

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 px-4 py-6">
      <div className="flex items-center gap-2">
        <div
          role="tablist"
          aria-label="Problem list"
          className="no-scrollbar flex min-w-0 flex-1 gap-1 overflow-x-auto"
        >
          {availableLists.map((listName) => {
            const listProblems = problemLists[listName];
            const selected = listName === activeSelectedList;
            return (
              <button
                key={listName}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => selectList(listName)}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60",
                  selected && "bg-muted text-foreground",
                )}
              >
                {listName === CUSTOM_TRACKING_LIST ? "My problems" : listName}
                <span className="text-xs tabular-nums text-muted-foreground">
                  {countSolved(listProblems, currentProgress)}/
                  {listProblems.length}
                </span>
              </button>
            );
          })}
        </div>
        <CustomSetManager onAddProblem={handleAddCustomProblem} />
      </div>

      <section
        aria-label="Progress"
        className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_auto] sm:items-end"
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold tabular-nums">
              {statusCounts.solved}
            </span>
            <span className="text-sm text-muted-foreground tabular-nums">
              / {problems.length} solved · {completion}%
            </span>
          </div>
          <div
            className="flex h-2 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${completion}% solved`}
          >
            {difficultyStats.map(({ difficulty, solved }) => (
              <div
                key={difficulty}
                className={cn("h-full", difficultyBar[difficulty])}
                style={{
                  width: `${problems.length ? (solved / problems.length) * 100 : 0}%`,
                }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            {difficultyStats.map(({ difficulty, solved, total }) => (
              <span key={difficulty} className="flex items-center gap-1.5">
                <span
                  className={cn("size-2 rounded-full", difficultyBar[difficulty])}
                />
                {difficulty}
                <span className="tabular-nums text-foreground">
                  {solved}/{total}
                </span>
              </span>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <div
            className={cn(
              "flex items-center gap-2 rounded-lg bg-muted px-3 py-2",
              activeToday ? "text-primary" : "text-muted-foreground",
            )}
            title={
              activeToday
                ? "You studied today"
                : "Solve or review one problem to keep your streak"
            }
          >
            <Flame className="size-4" />
            <span className="text-sm font-semibold tabular-nums">{streak}</span>
            <span className="text-xs">day streak</span>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-muted-foreground">
            <Repeat
              className={cn("size-4", reviewQueue.length && "text-warning")}
            />
            <span className="text-sm font-semibold tabular-nums text-foreground">
              {reviewQueue.length}
            </span>
            <span className="text-xs">due</span>
            <Tooltip>
              <TooltipTrigger
                render={
                  <button
                    type="button"
                    aria-label="How reviews work"
                    className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
                  />
                }
              >
                <Info className="size-3.5" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs text-pretty">
                Solve a problem once, then revisit it after 1, 3, 7, 14 and 30
                days. Each dot in a row is one review — click it to toggle.
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </section>

      <ReviewQueue items={reviewQueue} onReview={track} />

      <section
        aria-label="Problems"
        className="overflow-hidden rounded-xl border border-border bg-card"
      >
        <div className="border-b border-border p-3 sm:px-4">
          <Filters
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            categories={categories}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            filterDifficulty={filterDifficulty}
            setFilterDifficulty={setFilterDifficulty}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            statusCounts={statusCounts}
          />
        </div>
        <ProblemTable
          problems={filteredProblems}
          progress={currentProgress}
          today={today}
          toggleComplete={track}
          onCategoryClick={setFilterCategory}
          emptyMessage={
            problems.length
              ? "No problems match these filters."
              : "No problems yet. Use “Add problem” and paste a LeetCode link."
          }
        />
      </section>

      {undo ? (
        <div
          role="status"
          className="fixed bottom-6 left-1/2 z-30 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-border bg-popover py-1.5 pr-1.5 pl-4 text-sm text-popover-foreground shadow-lg"
        >
          <span className="truncate">
            <span className="font-medium">{undo.label}</span>
            <span className="text-muted-foreground"> · {undo.title}</span>
          </span>
          <Button
            size="sm"
            variant="ghost"
            className="rounded-full"
            onClick={() => {
              updateTrackerState(undo.snapshot);
              setUndo(null);
            }}
          >
            Undo
          </Button>
        </div>
      ) : null}
      <BackToTopButton visible={showBackToTop} />
    </div>
  );
};

export default LeetCodeTracker;
