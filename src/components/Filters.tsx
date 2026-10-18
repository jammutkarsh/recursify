import { useEffect, useRef } from "react";
import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const difficultyDot = {
  Easy: "bg-easy",
  Medium: "bg-medium",
  Hard: "bg-hard",
};

const Segmented = ({ label, options, value, onChange }) => (
  <div
    role="radiogroup"
    aria-label={label}
    className="flex shrink-0 items-center rounded-lg bg-muted p-0.5"
  >
    {options.map((option) => (
      <button
        key={option.value}
        type="button"
        role="radio"
        aria-checked={value === option.value}
        onClick={() => onChange(option.value)}
        className={cn(
          "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/60",
          value === option.value &&
            "bg-background text-foreground shadow-sm dark:bg-secondary",
        )}
      >
        {option.dot ? (
          <span className={cn("size-1.5 rounded-full", option.dot)} />
        ) : null}
        {option.label}
        {option.count != null ? (
          <span className="tabular-nums text-muted-foreground">
            {option.count}
          </span>
        ) : null}
      </button>
    ))}
  </div>
);

const Filters = ({
  searchQuery,
  setSearchQuery,
  categories,
  filterCategory,
  setFilterCategory,
  filterDifficulty,
  setFilterDifficulty,
  filterStatus,
  setFilterStatus,
  statusCounts,
}) => {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.key !== "/" ||
        target.isContentEditable ||
        ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)
      ) {
        return;
      }
      event.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const isFiltered =
    searchQuery ||
    filterCategory !== "All" ||
    filterDifficulty !== "All" ||
    filterStatus !== "All";

  return (
    <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
      <div className="relative min-w-0 flex-1">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={searchRef}
          placeholder="Search problems"
          aria-label="Search problems"
          className="h-8 pr-8 pl-8"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setSearchQuery("");
              e.currentTarget.blur();
            }
          }}
        />
        <kbd className="pointer-events-none absolute top-1/2 right-2 hidden -translate-y-1/2 rounded border border-border px-1.5 font-sans text-[10px] text-muted-foreground sm:block">
          /
        </kbd>
      </div>

      <div className="no-scrollbar -mx-4 flex items-center gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0">
        <Segmented
          label="Status"
          value={filterStatus}
          onChange={setFilterStatus}
          options={[
            { value: "All", label: "All" },
            { value: "Unsolved", label: "To do", count: statusCounts.unsolved },
            { value: "Solved", label: "Solved", count: statusCounts.solved },
            { value: "Due Today", label: "Due", count: statusCounts.due },
          ]}
        />
        <Segmented
          label="Difficulty"
          value={filterDifficulty}
          onChange={setFilterDifficulty}
          options={["All", "Easy", "Medium", "Hard"].map((difficulty) => ({
            value: difficulty,
            label: difficulty === "All" ? "Any" : difficulty,
            dot: difficultyDot[difficulty],
          }))}
        />
        <Select value={filterCategory} onValueChange={setFilterCategory}>
          <SelectTrigger
            aria-label="Topic"
            className="h-8 w-40 shrink-0 border-transparent bg-muted"
          >
            <SelectValue>
              {(value: string) => (value === "All" ? "All topics" : value)}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat === "All" ? "All topics" : cat}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        {isFiltered ? (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 text-muted-foreground"
            onClick={() => {
              setSearchQuery("");
              setFilterCategory("All");
              setFilterDifficulty("All");
              setFilterStatus("All");
            }}
          >
            <X />
            Clear
          </Button>
        ) : null}
      </div>
    </div>
  );
};

export default Filters;
