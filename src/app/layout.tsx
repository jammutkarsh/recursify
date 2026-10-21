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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={cn("font-sans", geist.variable, geistMono.variable)}>
      <head>
        {/* Light by default; Settings switches to dark or system. Tokens swap under .dark (design/tokens.css). */}
        <Script id="theme-init" strategy="beforeInteractive">{THEME_INIT}</Script>
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
