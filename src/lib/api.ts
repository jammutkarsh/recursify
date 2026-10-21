import { NextResponse } from "next/server";
import { isSignedIn } from "./auth";
import { DEMO } from "./demo";

/** Wrap a route handler: 401 when signed out, 400 with the message on thrown errors. */
export const authed =
  (fn: (req: Request) => Promise<unknown>) =>
  async (req: Request) => {
    if (DEMO) return NextResponse.json({ error: "Not available in the demo" }, { status: 404 }); // no D1 here; the browser holds the data
    if (!(await isSignedIn())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    try {
      const out = await fn(req);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return NextResponse.json({ error: (e as Error).message }, { status: 400 });
    }
  };

export const body = async <T>(req: Request) => (await req.json().catch(() => ({}))) as T;
export const param = (req: Request, k: string) => new URL(req.url).searchParams.get(k);
