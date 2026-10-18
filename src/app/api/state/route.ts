import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { isSignedIn } from "@/lib/auth";

const STATE_KEY = "tracker-state";
const MAX_BYTES = 1024 * 1024;

const unauthorized = () =>
  NextResponse.json({ error: "Unauthorized" }, { status: 401 });

export async function GET() {
  if (!(await isSignedIn())) return unauthorized();
  const state = await env.KV.get(STATE_KEY, "json");
  return NextResponse.json({ state });
}

// ponytail: last write wins across devices; add a version check if two devices edit at once.
export async function PUT(req: Request) {
  if (!(await isSignedIn())) return unauthorized();
  const body = await req.text();
  if (body.length > MAX_BYTES) {
    return NextResponse.json({ error: "State too large" }, { status: 413 });
  }
  try {
    JSON.parse(body);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  await env.KV.put(STATE_KEY, body);
  return NextResponse.json({ ok: true });
}
