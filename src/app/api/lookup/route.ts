import { authed, param } from "@/lib/api";
import { lookupLeetCode } from "@/lib/leetcode";

/** Metadata for a LeetCode slug the bundled catalog doesn't know yet. */
export const GET = authed(async (req) => {
  const slug = param(req, "slug");
  if (!slug || !/^[a-z0-9-]+$/.test(slug)) throw new Error("slug is required");
  return { problem: await lookupLeetCode(slug) };
});
