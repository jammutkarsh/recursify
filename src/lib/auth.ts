import { env } from "cloudflare:workers";
import { cookies } from "next/headers";

export const TOKEN_COOKIE = "site_token";

const sha256 = async (value: string) =>
  new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
  );

// Compare fixed-length hashes without early exit so timing leaks nothing.
export async function isValidToken(token: string | undefined) {
  if (!env.SITE_TOKEN || !token) return false;
  const [a, b] = await Promise.all([sha256(token), sha256(env.SITE_TOKEN)]);
  return a.reduce((diff, byte, i) => diff | (byte ^ b[i]), 0) === 0;
}

export async function isSignedIn() {
  const store = await cookies();
  return isValidToken(store.get(TOKEN_COOKIE)?.value);
}
