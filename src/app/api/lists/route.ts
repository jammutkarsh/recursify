import { authed, body, param } from "@/lib/api";
import { createList, deleteList, renameList } from "@/lib/store";

export const POST = authed(async (req) => ({ id: await createList((await body<{ name?: string }>(req)).name) }));

export const PATCH = authed(async (req) => {
  const id = param(req, "id");
  if (!id) throw new Error("id is required");
  await renameList(id, (await body<{ name?: string }>(req)).name);
});

export const DELETE = authed(async (req) => {
  const id = param(req, "id");
  if (!id) throw new Error("id is required");
  await deleteList(id);
});
