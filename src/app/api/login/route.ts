import { env } from "cloudflare:workers";
import { NextResponse } from "next/server";
import { TOKEN_COOKIE, isValidToken, tokenProblem } from "@/lib/auth";
import { DEMO } from "@/lib/demo";

export async function POST(req: Request) {
  if (DEMO) return NextResponse.json({ error: "The demo has no sign-in" }, { status: 404 });
  const problem = tokenProblem(env.SITE_TOKEN);
  if (problem) return NextResponse.json({ error: problem }, { status: 500 });

  const { token } = (await req.json().catch(() => ({}))) as { token?: string };
  if (!(await isValidToken(token))) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: TOKEN_COOKIE,
    value: token,
    httpOnly: true,
    secure: new URL(req.url).protocol === "https:",
    sameSite: "lax",
    path: "/",
    maxAge: 365 * 24 * 60 * 60,
  });
  return response;
}
