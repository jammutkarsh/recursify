import { useState } from "react";
import { Check, Repeat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { describeNextReview, difficultyText } from "./ProblemTable";

const COLLAPSED_COUNT = 5;

const ReviewQueue = ({ items, onReview }) => {
  const [expanded, setExpanded] = useState(false);

  if (!items.length) {
    return null;
  }

  const visible = expanded ? items : items.slice(0, COLLAPSED_COUNT);

  return (
    <section
      aria-labelledby="review-queue-title"
      className="rounded-xl border border-warning/30 bg-warning/5"
    >
      <div className="flex items-center gap-2 px-4 pt-3 pb-1">
        <Repeat className="size-4 text-warning" />
        <h2 id="review-queue-title" className="text-sm font-semibold">
          Review today
        </h2>
        <span className="rounded-full bg-warning/15 px-2 text-xs font-medium tabular-nums text-warning">
          {items.length}
        </span>
      </div>
      <ul className="px-2 pb-2">
        {visible.map(({ problem, next }) => (
          <li
            key={problem.slug || problem.url}
            className="flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-warning/5"
          >
            <span
              className={cn(
                "w-14 shrink-0 text-xs font-medium",
                difficultyText[problem.difficulty],
              )}
            >
              {problem.difficulty}
            </span>
            <a
              href={problem.url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate text-sm underline-offset-4 hover:underline"
            >
              {problem.title}
            </a>
            <span
              className={cn(
                "hidden shrink-0 text-xs tabular-nums sm:block",
                next.state === "overdue" ? "text-hard" : "text-muted-foreground",
              )}
            >
              R{next.index + 1} · {describeNextReview(next)}
            </span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => onReview(problem, next.index)}
            >
              <Check />
              Reviewed
            </Button>
          </li>
        ))}
      </ul>
      {items.length > COLLAPSED_COUNT ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="w-full border-t border-warning/20 py-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {expanded ? "Show less" : `Show all ${items.length}`}
        </button>
      ) : null}
    </section>
  );
};

export default ReviewQueue;
