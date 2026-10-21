import { authed } from "@/lib/api";
import { importCsv } from "@/lib/store";

const MAX_BYTES = 2 * 1024 * 1024;

export const POST = authed(async (req) => {
  const text = await req.text();
  if (text.length > MAX_BYTES) throw new Error("CSV is larger than 2 MB");
  return importCsv(text);
});
