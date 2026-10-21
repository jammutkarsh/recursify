"use client";

import { sectionsOf, BUILTIN_LISTS } from "@/lib/catalog";
import { TopicPolygon } from "./TopicPolygon";

// Sample progress for the marketing page (no user data). Solved share per NeetCode section.
const SOLVED = [9, 4, 5, 5, 4, 6, 12, 1, 3, 2, 5, 0, 6, 0, 3, 4, 0, 2];
const nc = BUILTIN_LISTS[0];
const SAMPLE = sectionsOf(nc).map((name, i) => {
  const total = nc.sections.filter((s) => s.section === name).length;
  return { name, total, solved: Math.min(total, SOLVED[i] ?? 0), lastSolved: "2026-09-25", lastReviewed: "2026-10-13", due: name === "Binary Search" ? 2 : 0 };
});

export function HomePolygon() {
  return (
    <div className="w-full max-w-[660px]" aria-label="Topic polygon showing LeetCode progress across 18 NeetCode 150 topics">
      <TopicPolygon sections={SAMPLE} today="2026-10-19" linkToLibrary={false} />
    </div>
  );
}
