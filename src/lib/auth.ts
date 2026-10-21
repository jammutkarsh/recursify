import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

export const TOKEN_COOKIE = "site_token";

// A token anyone could guess (the example value, or too short) is treated as unset.
const PLACEHOLDER = /change-me|generate-me|example|password/i;
export const tokenProblem = (t: string | undefined) =>
  !t ? "SITE_TOKEN is not set on this deployment." :
  PLACEHOLDER.test(t) || t.length < 24 ? "SITE_TOKEN is a placeholder or shorter than 24 characters. Set a long random value in your Worker settings." :
  null;

const sha256 = async (value: string) =>
  new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );

// Compare fixed-length hashes without early exit so timing leaks nothing.
export async function isValidToken(token: string | undefined) {
  if (tokenProblem(env.SITE_TOKEN) || !token) return false;
  const [a, b] = await Promise.all([sha256(token), sha256(env.SITE_TOKEN)]);
  return a.reduce((diff, byte, i) => diff | (byte ^ b[i]), 0) === 0;
}

export async function isSignedIn() {
  const store = await cookies();
  return isValidToken(store.get(TOKEN_COOKIE)?.value);
}

export const isPublicSite = () => env.PUBLIC_SITE === "true";
