import "../index.css";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import { THEME_INIT } from "@/lib/theme";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });

export const viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
    { media: "(prefers-color-scheme: light)", color: "#f7f8fa" },
  ],
};

export const metadata = {
  title: { default: "Recursify", template: "%s · Recursify" },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }, { url: "/icon.png", type: "image/png", sizes: "512x512" }],
    apple: "/apple-touch-icon.png",
  },
};

// Cloudflare's AI Labyrinth (zone bot protection) injects a hidden <a href="/cdn-cgi/content?…"> as <body>'s first child.
// Crawlers still get it in the raw HTML; removing it from the live DOM before React hydrates avoids a hydration mismatch.
const STRIP_INJECTED = `(() => { const o = new MutationObserver((ms) => { for (const m of ms) for (const n of m.addedNodes) if (n.nodeName === "A" && (n.getAttribute("href") || "").includes("/cdn-cgi/content")) n.remove(); }); o.observe(document.documentElement, { childList: true, subtree: true }); document.addEventListener("DOMContentLoaded", () => o.disconnect()); })();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable, geistMono.variable)}>
      <head>
        {/* Light by default; Settings switches to dark or system. Tokens swap under .dark (design/tokens.css). */}
        <Script id="theme-init" strategy="beforeInteractive">{THEME_INIT}</Script>
        <Script id="strip-injected" strategy="beforeInteractive">{STRIP_INJECTED}</Script>
      </head>
      <body className="bg-background text-foreground antialiased">
        <a href="#main-content" className="sr-only focus-visible:not-sr-only focus-visible:fixed focus-visible:top-4 focus-visible:left-4 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-card focus-visible:px-4 focus-visible:py-2 focus-visible:ring-2 focus-visible:ring-ring">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
