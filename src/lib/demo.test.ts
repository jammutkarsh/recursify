import { expect, test } from "bun:test";
import { demoApi } from "./demo";
import { buildModel, type AppData } from "./derive";

const mem = new Map<string, string>();
globalThis.localStorage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) } as Storage;
const get = () => demoApi<AppData>("/api/data");

test("demo store seeds believable history and answers the app's API from localStorage", async () => {
  const data = await get();
  expect(data.reviews.length).toBeGreaterThan(40);
  expect(data.lists.map((l) => l.name)).toEqual(["My list"]);
  const today = new Date().toISOString().slice(0, 10);
  expect(buildModel(data, today).tracked.size).toBe(25);

  const { id } = await demoApi<{ id: number }>("/api/reviews", { method: "POST", json: { problemId: "two-sum", date: today, grade: 3 } });
  expect((await get()).reviews.some((r) => r.id === id)).toBe(true); // persisted
  await demoApi(`/api/reviews?id=${id}`, { method: "DELETE" });
  await expect(demoApi("/api/data", { method: "DELETE" })).rejects.toThrow("Not available in the demo"); // no reset in the demo
});

test("demo lists: create, add, rename, import into one, delete", async () => {
  const { id } = await demoApi<{ id: string }>("/api/lists", { method: "POST", json: { name: "Patterns" } });
  await expect(demoApi("/api/lists", { method: "POST", json: { name: "patterns" } })).rejects.toThrow("already have a list");
  await demoApi("/api/lists/items", { method: "POST", json: { listId: id, problemId: "lru-cache" } });
  await demoApi(`/api/lists?id=${id}`, { method: "PATCH", json: { name: "Grokking" } });
  const out = await demoApi<{ problems: number }>(`/api/import?list=${id}`, { method: "POST", body: "url,topic\nhttps://leetcode.com/problems/two-sum/,Hash Table\nhttps://leetcode.com/problems/lru-cache/,Design\n" });
  expect(out.problems).toBe(1); // lru-cache was already there; its section is updated
  const list = (await get()).lists.find((l) => l.id === id)!;
  expect(list.name).toBe("Grokking");
  expect(list.items).toEqual([{ id: "lru-cache", section: "Design" }, { id: "two-sum", section: "Hash Table" }]);
  await demoApi(`/api/lists?id=${id}`, { method: "DELETE" });
  expect((await get()).lists.map((l) => l.id)).toEqual(["custom"]);
  await expect(demoApi("/api/lists?id=custom", { method: "DELETE" })).rejects.toThrow("can't be deleted");
});
