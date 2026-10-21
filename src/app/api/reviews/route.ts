import { authed, body, param } from "@/lib/api";
import { addReview, deleteReviews } from "@/lib/store";

export const POST = authed(async (req) => {
  const { problemId, date, grade } = await body<{ problemId: string; date: string; grade: unknown }>(req);
  return { id: await addReview(problemId, date, grade) };
});

// ?id=<review id> undoes one review; ?problemId=<id> clears a problem's history.
export const DELETE = authed(async (req) => {
  const id = Number(param(req, "id")) || undefined;
  const problemId = param(req, "problemId") ?? undefined;
  if (!id && !problemId) throw new Error("id or problemId is required");
  await deleteReviews({ id, problemId });
});
