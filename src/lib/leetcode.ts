import type { Difficulty } from "./fsrs";

// Third-party mirror of LeetCode's public problem data (CORS-enabled). Best effort: callers fall back to manual entry.
const API = "https://leetcode-api-pied.vercel.app/problem/";

export async function lookupLeetCode(slug: string): Promise<{ title: string; difficulty: Difficulty; topics: string[]; url: string } | null> {
  try {
    const res = await fetch(API + encodeURIComponent(slug), { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const p = (await res.json()) as { title?: string; difficulty?: string; topicTags?: { name?: string }[] };
    if (!p.title) return null;
    return {
      title: p.title,
      difficulty: (["Easy", "Medium", "Hard"].includes(p.difficulty ?? "") ? p.difficulty : "Medium") as Difficulty,
      topics: (p.topicTags ?? []).map((t) => t.name).filter(Boolean) as string[],
      url: `https://leetcode.com/problems/${slug}/`,
    };
  } catch {
    return null;
  }
}
