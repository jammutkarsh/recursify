import { isPublicSite } from "@/lib/auth";

// Only the official deployment is indexable; forks and the demo stay out of search results.
export function GET() {
  const body = isPublicSite()
    ? "User-agent: *\nAllow: /$\nDisallow: /\nSitemap: https://recursify.utkarshchourasia.in/sitemap.xml\n"
    : "User-agent: *\nDisallow: /\n";
  return new Response(body, { headers: { "content-type": "text/plain" } });
}
