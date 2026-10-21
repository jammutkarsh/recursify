import Link from "next/link";
import { redirect } from "next/navigation";
import { LogoMark } from "@/components/app/AppShell";
import { HomePolygon } from "@/components/app/HomePolygon";
import { isPublicSite, isSignedIn } from "@/lib/auth";
import { DEMO as IS_DEMO } from "@/lib/demo";
import { DEMO_URL, DEPLOY_GUIDE, REPO } from "@/lib/links";

// Copy is verbatim from the design spec; keep it in sync there.
const ORIGIN = "https://recursify.utkarshchourasia.in";
const TITLE = "Recursify: LeetCode Tracker with Spaced Repetition";
const DESCRIPTION = "Free, self-hosted LeetCode tracker that brings problems back right before you forget them. FSRS spaced repetition for NeetCode 150, Blind 75 and your own lists.";

export const metadata = {
  title: { absolute: TITLE },
  description: DESCRIPTION,
  alternates: { canonical: `${ORIGIN}/` },
  openGraph: {
    type: "website", url: `${ORIGIN}/`, title: TITLE,
    description: "Spaced repetition for LeetCode. Solve it, let it fade, recur. Self-hosted on Cloudflare.",
    images: [{ url: `${ORIGIN}/og.png`, width: 1200, height: 630, alt: "Recursify — LeetCode tracker with spaced repetition" }],
  },
  twitter: { card: "summary_large_image", creator: "@jammutkarsh" },
};

const JSON_LD = {
  "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Recursify", description: DESCRIPTION, url: `${ORIGIN}/`,
  applicationCategory: "EducationalApplication", operatingSystem: "Web", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  author: { "@type": "Person", name: "Utkarsh Chourasia", sameAs: ["https://x.com/jammutkarsh", "https://github.com/jammutkarsh"] },
};

const FEATURES = [
  { title: "Topic progress at a glance", body: "One wedge per topic in your list. Greener as you solve more; hover to see what's due and what's slipping.", visual: "heat" },
  { title: "FSRS spaced repetition", body: "The same memory model Anki uses. Four honest grades, no checkbox dots. Intervals adapt to you, not a fixed calendar.", visual: "grades" },
  { title: "Keyboard-first LeetCode practice", body: "J / K to move, 1–4 to grade, A to log, / to search. You never need the mouse.", visual: "keys" },
  { title: "Self-hosted on Cloudflare", body: "Fork it, import it into Cloudflare, set one secret. Data lives in your own D1; updates are one “Sync fork” click.", visual: "lists" },
] as const;

export default async function Home() {
  if (IS_DEMO || (await isSignedIn())) redirect("/today");
  // Forks and the demo open straight to sign-in; only the official site shows the marketing page.
  if (!isPublicSite()) redirect("/login");

  return (
    <div className="bg-card">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }} />
      <header className="flex items-center gap-8 border-b border-border px-5 py-5 md:px-[120px]">
        <Link href="/" className="flex items-center gap-2.5 text-lg font-bold"><LogoMark size={26} />Recursify</Link>
        <nav className="ml-auto flex items-center gap-6 text-sm font-medium text-foreground-2">
          <a href="#features" className="hidden sm:inline">Features</a>
          <a href={DEPLOY_GUIDE} className="hidden sm:inline">Docs</a>
          <a href={REPO} className="hidden sm:inline">GitHub</a>
          <Link href="/login" className="rounded-md bg-primary px-3.5 py-2 font-semibold text-primary-foreground">Sign in</Link>
        </nav>
      </header>

      <main id="main-content">
        <section className="flex flex-col items-center gap-10 bg-gradient-to-b from-card to-primary-tint px-5 pt-16 pb-20 lg:flex-row lg:pr-20 lg:pl-[120px]">
          <div className="max-w-[600px] space-y-6">
            <h1 className="text-[42px] leading-[1.08] font-bold tracking-tight md:text-[56px]">Stop re-learning LeetCode problems you already solved.</h1>
            <p className="max-w-[560px] text-lg leading-relaxed text-foreground-2 md:text-[19px]">
              Recursify is a free LeetCode tracker with spaced repetition. It brings each problem back right before you&rsquo;d forget it, and shows which topics are slipping.
            </p>
            <div className="flex flex-wrap gap-3">
              <a href={DEPLOY_GUIDE} className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-[15px] font-semibold text-primary-foreground">Deploy your own</a>
              <a href={DEMO_URL} className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-5 py-3 text-[15px] font-semibold">▷ Try the demo</a>
            </div>
          </div>
          <HomePolygon />
        </section>

        <section id="features" className="space-y-10 px-5 py-24 md:px-[120px]">
          <h2 className="text-[40px] font-bold">Features</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {FEATURES.map((f) => (
              <div key={f.title} className="space-y-3 rounded-2xl border border-border bg-card p-7">
                <FeatureVisual kind={f.visual} />
                <h3 className="text-xl font-bold">{f.title}</h3>
                <p className="text-[15px] leading-relaxed text-foreground-2">{f.body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-center gap-5 bg-primary-tint px-5 py-[88px] text-center">
          <LogoMark size={48} />
          <h2 className="text-[40px] font-bold">Your next review is waiting.</h2>
          <p className="text-[17px] text-foreground-2">Fork it and deploy in about five minutes, or try the demo first.</p>
          <div className="flex flex-wrap justify-center gap-3">
            <a href={DEPLOY_GUIDE} className="rounded-lg bg-primary px-5 py-3 text-[15px] font-semibold text-primary-foreground">Deploy your own</a>
            <a href={DEMO_URL} className="rounded-lg border border-border bg-card px-5 py-3 text-[15px] font-semibold">▷ Try the demo</a>
          </div>
        </section>
      </main>

      <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 px-5 py-7 text-[13px] text-muted-foreground md:px-[120px]">
        <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><LogoMark size={18} />Recursify</span>
        <span>by <a href="https://x.com/jammutkarsh" className="hover:text-foreground">@jammutkarsh</a></span>
        <span>Not affiliated with LeetCode.</span>
        <span className="flex-1" />
        <a href={REPO} className="hover:text-foreground">GitHub</a>
        <a href={DEPLOY_GUIDE} className="hover:text-foreground">Docs</a>
      </footer>
    </div>
  );
}

function FeatureVisual({ kind }: { kind: (typeof FEATURES)[number]["visual"] }) {
  if (kind === "heat") return <div className="flex gap-1.5">{[0, 1, 2, 3, 4].map((i) => <span key={i} className="size-[18px] rounded-[4px]" style={{ background: `var(--heat-${i})` }} />)}</div>;
  if (kind === "grades") return <div className="flex gap-1.5">{["bg-forgot", "bg-struggled", "bg-recalled", "bg-instant"].map((c) => <span key={c} className={`size-3.5 rounded-full ${c}`} />)}</div>;
  if (kind === "keys") return <div className="flex gap-1.5">{["J", "K", "1", "4", "A", "/"].map((k) => <kbd key={k} className="inline-flex h-5 min-w-5 items-center justify-center rounded-[4px] border border-b-2 border-border bg-muted px-1.5 font-mono text-[11px] text-foreground-2">{k}</kbd>)}</div>;
  return <div className="flex flex-wrap gap-1.5">{["Blind 75", "LeetCode 75", "NeetCode 150", "+ custom"].map((l) => <span key={l} className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground-2">{l}</span>)}</div>;
}
