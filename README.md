# Recursify — LeetCode tracker with spaced repetition

Recursify brings each LeetCode problem back right before you'd forget it, and shows which topics are slipping. It's free, self-hosted on Cloudflare, and your data stays in your own account.

- **FSRS spaced repetition.** Grade each re-solve 1–4 (Forgot, Struggled, Recalled, Instant) and the schedule adapts to you. A first solve is seeded by difficulty: Easy about 3 days, Medium 2, Hard 1.
- **Topic polygon.** One wedge per topic of your list, greener as you solve more.
- **Lists.** Blind 75, LeetCode 75 and NeetCode 150 are built in, plus My list for your own problems, LeetCode or not. Follow several at once.
- **Keyboard-first.** `J`/`K` move, `1`–`4` grade, `A` log a solve, `/` search, `?` shows every shortcut.
- **CSV import and export** (`title, url, difficulty, topic, note, reviewed_at, grade`).

Not affiliated with LeetCode.

## Deploy your own

You need a GitHub account and a free Cloudflare account. Give your coding agent (Claude Code, Codex, Cursor, …) this link:

```
https://raw.githubusercontent.com/jammutkarsh/recursify/master/DEPLOY.md
```

It checks your tools and logins, forks this repo, deploys it to Cloudflare Workers with a D1 database, verifies the deployment, and hands you your URL and password (`SITE_TOKEN`). [DEPLOY.md](DEPLOY.md) is also readable by people who'd rather run the steps themselves.

### Updates

`master` only ever holds tagged releases. To update, click **Sync fork** on your fork's GitHub page; Cloudflare redeploys automatically if you connected builds (DEPLOY.md step 7). Your data lives in D1, not in the repo, so syncing never touches it.

### Optional variables

| Variable      | Purpose |
| ------------- | ------- |
| `PUBLIC_SITE` | Build variable. Set to `true` only on the official site. It shows the marketing home page and allows search indexing. Every other deployment opens straight to sign-in and sends `noindex`. |

## Releasing (maintainers)

Work happens on `dev`. To release, tag a commit on `dev` and push the tag and `master` together:

```bash
git tag v1.2.0 && git push origin v1.2.0 'v1.2.0^{commit}:refs/heads/master'
```

The push fails unless it fast-forwards `master`, and the `Release` workflow publishes the GitHub release notes. Cloudflare builds only `master`, so production and every fork's Sync fork only ever see tagged code. The LeetCode catalog is data, not code, so it skips releases: a weekly Action publishes it to the `catalog` branch, and every deployment (forks included) reads it through jsDelivr. The copy bundled in each release (refreshed on `dev`) is only the fallback.

## Local development

Requires [Bun](https://bun.sh) and Node.js 22.18+.

```bash
bun install
cp .dev.vars.example .dev.vars   # set SITE_TOKEN (24+ random characters)
bun run dev
```

Local D1 data is stored under `.wrangler/` and never touches your deployed data.

| Script            | What it does                          |
| ----------------- | ------------------------------------- |
| `bun run dev`     | Dev server with HMR                   |
| `bun test`        | Unit tests (scheduler, CSV, derived views) |
| `bun run build`   | Production build                      |
| `bun run deploy`  | Build and deploy with `cf deploy`     |
| `bun run types`   | Regenerate Cloudflare binding types   |

## How it works

- `/today`, `/library`, `/progress` need sign-in. `/login` checks your token against `SITE_TOKEN` and stores it in an httpOnly cookie.
- Data lives in D1: custom problems, My list, settings, and one row per solve or review. Scheduling state is never stored; it's rebuilt by replaying the review log (`src/lib/fsrs.ts`), so undo just deletes the last review.
- Design reference: Figma file `KeyG3THsnvKLlsiMzZyn0e`, colours in `design/tokens.css`, build notes in `design/BUILD.md`.
