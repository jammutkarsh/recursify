import { authed } from "@/lib/api";
import { loadAll } from "@/lib/store";

export const GET = authed(() => loadAll());
