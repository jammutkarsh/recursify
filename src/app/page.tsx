import Link from "next/link";
import { redirect } from "next/navigation";
import { Flame, Repeat, ListChecks, Cloud } from "lucide-react";
import { isSignedIn } from "@/lib/auth";

const REPO_URL = "https://github.com/jammutkarsh/leetcode-tracker";

const features = [
  {
    icon: ListChecks,
    title: "Curated lists",
    body: "Blind 75, LeetCode 75 and NeetCode 150 built in, plus your own custom sets.",
  },
  {
    icon: Repeat,
    title: "Spaced repetition",
    body: "Solved problems come back for review at 1, 3, 7, 14 and 30 days.",
  },
  {
    icon: Flame,
    title: "Streaks & reminders",
    body: "Keep a daily streak going with optional browser reminders.",
  },
  {
    icon: Cloud,
    title: "Your own instance",
    body: "Fork it, deploy it to Cloudflare's free tier, and keep your data in your own account.",
  },
];

export default async function Home() {
  if (await isSignedIn()) redirect("/tracker");

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center gap-12 px-4 py-16"
    >
      <section className="space-y-5">
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          <Flame className="size-5" />
        </span>
        <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
          A personal LeetCode tracker you host yourself.
        </h1>
        <p className="max-w-xl text-lg text-muted-foreground">
          Track what you solved, review it before you forget it, and keep your
          streak alive. One token, one Cloudflare account, no sign-ups.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href={REPO_URL}
            className="inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Fork on GitHub
          </a>
          <Link
            href="/login"
            className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm font-medium text-foreground hover:bg-muted"
          >
            Sign in
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        {features.map(({ icon: Icon, title, body }) => (
          <div key={title} className="rounded-xl border border-border p-5">
            <Icon className="mb-3 size-5 text-primary" />
            <h2 className="font-medium text-foreground">{title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
