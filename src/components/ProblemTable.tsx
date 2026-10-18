import { memo } from "react";
import { Check, CheckCheck, ExternalLink, NotebookPen } from "lucide-react";
import {
  calculateNextReviews,
  getNextReview,
  getProblemIdentifier,
  getProblemProgressKey,
} from "../lib/tracker";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export const difficultyText = {
  Easy: "text-easy",
  Medium: "text-medium",
  Hard: "text-hard",
};

export const formatDate = (dateString: string) =>
  new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

export const describeNextReview = (next) => {
  if (next.state === "today") return "due today";
  if (next.state === "overdue") return `${-next.daysAway}d late`;
  return `in ${next.daysAway}d`;
};

const ReviewCell = ({ problem, status, today, toggleComplete }) => {
  if (!status.solved) {
    return <span className="hidden text-xs text-muted-foreground sm:block">—</span>;
  }

  const dates = calculateNextReviews(status.solvedDate);
  const next = getNextReview(status, today);

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center" role="group" aria-label="Reviews">
        {dates.map((date, idx) => {
          const done = Boolean(status.reviews?.[idx]);
          const tone = done
            ? "bg-success"
            : date < today
              ? "bg-hard"
              : date === today
                ? "bg-warning"
                : "border border-muted-foreground/40";
          const label = `Review ${idx + 1} · ${formatDate(date)}${done ? " · done" : ""}`;
          return (
            <button
              key={idx}
              type="button"
              aria-pressed={done}
              aria-label={label}
              title={label}
              onClick={() => toggleComplete(problem, idx)}
              className="group/dot flex size-5 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <span
                className={cn(
                  "size-2 rounded-full transition-transform group-hover/dot:scale-150",
                  tone,
                )}
              />
            </button>
          );
        })}
      </div>

      {!next ? (
        <span className="flex items-center gap-1 text-xs font-medium text-success">
          <CheckCheck className="size-3.5" />
          All reviewed
        </span>
      ) : next.state === "upcoming" ? (
        <span
          className="text-xs text-muted-foreground tabular-nums"
          title={formatDate(next.date)}
        >
          R{next.index + 1} {describeNextReview(next)}
        </span>
      ) : (
        <Button
          size="xs"
          variant="outline"
          onClick={() => toggleComplete(problem, next.index)}
          className={cn(
            "tabular-nums",
            next.state === "overdue"
              ? "border-hard/40 text-hard hover:text-hard"
              : "border-warning/50 text-warning hover:text-warning",
          )}
          title={`Mark review ${next.index + 1} done`}
        >
          <Check />R{next.index + 1} {describeNextReview(next)}
        </Button>
      )}
    </div>
  );
};

interface ProblemTableProps {
  problems: any[];
  progress: Record<string, any>;
  today: string;
  toggleComplete: (problem: any, reviewIndex?: number | null) => void;
  onCategoryClick?: (category: string) => void;
  emptyMessage: string;
}

const ProblemTable = memo(function ProblemTable({
  problems,
  progress,
  today,
  toggleComplete,
  onCategoryClick,
  emptyMessage,
}: ProblemTableProps) {
  if (!problems.length) {
    return (
      <p className="px-4 py-16 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border">
      {problems.map((problem) => {
        const status = progress[getProblemProgressKey(problem)] || {};
        const section = problem.listMeta?.section || problem.listMeta?.module;
        const tags = [...new Set<string>([section, ...(problem.topics || [])])]
          .filter(Boolean)
          .map(String);

        return (
          <li
            key={getProblemIdentifier(problem)}
            className="group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 px-3 py-2.5 transition-colors hover:bg-muted/40 sm:grid-cols-[auto_minmax(0,1fr)_4.5rem_15rem] sm:px-4"
          >
            <button
              type="button"
              onClick={() => toggleComplete(problem)}
              aria-pressed={Boolean(status.solved)}
              aria-label={
                status.solved
                  ? `Mark ${problem.title} unsolved`
                  : `Mark ${problem.title} solved`
              }
              className={cn(
                "flex size-5 items-center justify-center rounded-full border-2 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
                status.solved
                  ? "border-success bg-success text-background"
                  : "border-muted-foreground/40 text-transparent hover:border-success hover:text-success",
              )}
            >
              <Check className="size-3" strokeWidth={3.5} />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <a
                  href={problem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-sm font-medium text-foreground underline-offset-4 hover:underline"
                >
                  {problem.title}
                </a>
                <ExternalLink className="size-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                {problem.notes ? (
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <span className="cursor-default text-muted-foreground" />
                      }
                    >
                      <NotebookPen className="size-3.5" />
                    </TooltipTrigger>
                    <TooltipContent>{problem.notes}</TooltipContent>
                  </Tooltip>
                ) : null}
              </div>
              {tags.length ? (
                <div className="mt-0.5 flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                  {tags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onCategoryClick?.(tag)}
                      className="rounded-sm outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="col-start-2 flex items-center gap-4 sm:contents">
              <span
                className={cn(
                  "text-xs font-medium",
                  difficultyText[problem.difficulty],
                )}
              >
                {problem.difficulty}
              </span>
              <ReviewCell
                problem={problem}
                status={status}
                today={today}
                toggleComplete={toggleComplete}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
});

export default ProblemTable;
