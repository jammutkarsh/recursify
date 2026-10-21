import { authed, body } from "@/lib/api";
import { saveSettings, type Settings } from "@/lib/store";

export const PUT = authed(async (req) => saveSettings(await body<Partial<Settings>>(req)));
