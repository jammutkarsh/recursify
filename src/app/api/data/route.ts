import { authed, body } from "@/lib/api";
import { loadAll, reset } from "@/lib/store";

export const GET = authed(() => loadAll());

// Reset: body { scope: "progress" | "all", confirm: the matching phrase from RESET_PHRASES }.
export const DELETE = authed(async (req) => { const b = await body<{ scope?: string; confirm?: string }>(req); await reset(b.scope, b.confirm); });
