import { expect, test } from "bun:test";
import { demoApi } from "./demo";
import { buildModel, type AppData } from "./derive";

const mem = new Map<string, string>();
globalThis.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) } as Storage;

test("demo store seeds believable history and answers the app's API from localStorage", async () => {
  const data = await demoApi<AppData>("/api/data");
  expect(data.reviews.length).toBeGreaterThan(40);
  const today = new Date().toISOString().slice(0, 10);
  expect(buildModel(data, today).tracked.size).toBe(25);

  const { id } = await demoApi<{ id: number }>("/api/reviews", { method: "POST", json: { problemId: "two-sum", date: today, grade: 3 } });
  expect((await demoApi<AppData>("/api/data")).reviews.some((r) => r.id === id)).toBe(true); // persisted
  await demoApi(`/api/reviews?id=${id}`, { method: "DELETE" });

  const out = await demoApi<{ problems: number; reviews: number }>("/api/import", { method: "POST", body: "title,reviewed_at,grade\nMy Puzzle,2026-01-02,instant\n" });
  expect(out).toMatchObject({ problems: 1, reviews: 1 });
  const byLink = await demoApi<{ problems: number }>("/api/import", { method: "POST", body: "https://leetcode.com/problems/lru-cache/\n" }); // built-in, no title given
  expect(byLink.problems).toBe(1);
  expect((await demoApi<AppData>("/api/data")).myList).toContain("lru-cache");

  await expect(demoApi("/api/data", { method: "DELETE" })).rejects.toThrow("Not available in the demo"); // no reset in the demo
  await expect(demoApi("/api/export")).rejects.toThrow("Not available in the demo");
});
