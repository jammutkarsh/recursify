import { isPublicSite } from "@/lib/auth";

export function GET() {
  if (!isPublicSite()) return new Response("Not found", { status: 404 });
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>https://recursify.utkarshchourasia.in/</loc><changefreq>weekly</changefreq></url></urlset>`;
  return new Response(xml, { headers: { "content-type": "application/xml" } });
}
