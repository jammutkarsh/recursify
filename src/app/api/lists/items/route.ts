import { authed, body, param } from "@/lib/api";
import { addToList, removeFromList } from "@/lib/store";

export const POST = authed(async (req) => {
  const { listId, problemId, section } = await body<{ listId?: string; problemId?: string; section?: string | null }>(req);
  if (!listId || !problemId) throw new Error("listId and problemId are required");
  await addToList(listId, problemId, section ?? null);
});

export const DELETE = authed(async (req) => {
  const listId = param(req, "listId"), problemId = param(req, "problemId");
  if (!listId || !problemId) throw new Error("listId and problemId are required");
  await removeFromList(listId, problemId);
});
