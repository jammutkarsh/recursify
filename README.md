# Recursify — LeetCode tracker with spaced repetition

Recursify brings each LeetCode problem back right before you'd forget it, and shows which topics are slipping. It's free, self-hosted on Cloudflare, and your data stays in your own account.

- **FSRS spaced repetition.** Grade each re-solve 1–4 (Forgot, Struggled, Recalled, Instant) and the schedule adapts to you. A first solve is seeded by difficulty: Easy about 3 days, Medium 2, Hard 1.
- **Topic polygon.** One wedge per topic of your list, greener as you solve more.
- **Lists.** Blind 75, LeetCode 75 and NeetCode 150 are built in, plus My list for your own problems, LeetCode or not. Follow several at once.
- **Keyboard-first.** `J`/`K` move, `1`–`4` grade, `A` log a solve, `/` search, `?` shows every shortcut.
- **CSV import and export** (`title, url, difficulty, topic, note, reviewed_at, grade`).

Not affiliated with LeetCode.

## Deploy your own

You need a GitHub account and a free Cloudflare account.

1. **Fork** this repository.
2. In the [Cloudflare dashboard](https://dash.cloudflare.com/?to=/:account/workers-and-pages), go to **Workers & Pages → Create → Import a repository** and pick your fork.
3. Use these settings:
   - Project name: `recursify` (must match `name` in `cloudflare.config.ts`)
   - Build command: _leave empty_
   - Deploy command: `bun run deploy` (runs `cf deploy`; not `npx wrangler deploy`, which rejects this build output)
4. Click **Deploy**. The D1 database is created on the first deploy, and the app creates its own tables on first use.
5. Open the Worker's **Settings → Variables and Secrets** and add a **Secret** named `SITE_TOKEN`. Set it to a long random string (at least 24 characters), for example the output of `openssl rand -hex 32`. This is your password; placeholder values are refused.
6. Visit your `*.workers.dev` URL and sign in with `SITE_TOKEN`.

Every push to your fork's `master` branch redeploys.

### Updates

New versions are tagged releases on `master`. To update, click **Sync fork** on your fork's GitHub page; Cloudflare redeploys automatically. Your data lives in D1, not in the repo, so syncing never touches it.

### Optional variables

| Variable      | Purpose |
| ------------- | ------- |
| `PUBLIC_SITE` | Set to `true` only on the official site. It shows the marketing home page and allows search indexing. Every other deployment opens straight to sign-in and sends `noindex`. |

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
