import { authed, body, param } from "@/lib/api";
import type { Problem } from "@/lib/catalog";
import { deleteProblem, saveProblem } from "@/lib/store";

export const POST = authed(async (req) => ({ id: await saveProblem(await body<Partial<Problem> & { listId?: string }>(req)) }));

export const PATCH = authed(async (req) => {
  const id = param(req, "id");
  if (!id?.startsWith("custom-")) throw new Error("Only custom problems can be edited");
  return { id: await saveProblem(await body<Partial<Problem>>(req), id) };
});

export const DELETE = authed(async (req) => {
  const id = param(req, "id");
  if (!id) throw new Error("id is required");
  await deleteProblem(id);
});
