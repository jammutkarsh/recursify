import { authed, body } from "@/lib/api";
import { loadAll, resetAll } from "@/lib/store";

export const GET = authed(() => loadAll());

// Reset: body must be { confirm: "delete all my data" }.
export const DELETE = authed(async (req) => resetAll((await body<{ confirm?: string }>(req)).confirm));
