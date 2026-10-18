# LeetCode Tracker

A personal LeetCode tracker you host yourself on Cloudflare. Fork it, set one secret, and it's your own site.

- `Blind 75`, `LeetCode 75` and `NeetCode 150` built in, plus custom sets from LeetCode links
- Spaced repetition reviews (1, 3, 7, 14, 30 days)
- Daily streaks and optional browser reminders
- Data synced to your own Cloudflare KV, so it follows you across devices
- Export / import as JSON

Built with [vinext](https://github.com/cloudflare/vinext) (Next.js API on Vite) and deployed to Cloudflare Workers.

## Deploy your own

You need a GitHub account and a free Cloudflare account.

1. **Fork** this repository.
2. In the [Cloudflare dashboard](https://dash.cloudflare.com/?to=/:account/workers-and-pages), go to **Workers & Pages → Create → Import a repository** and pick your fork.
3. Use these settings:
   - Project name: `leetcode-tracker` (must match `name` in `cloudflare.config.ts`)
   - Build command: _leave empty_
   - Deploy command: `bun run deploy`
4. Click **Deploy**. The KV namespace for your data is created automatically on the first deploy.
5. Open the Worker's **Settings → Variables and Secrets**, add a **Secret** named `SITE_TOKEN`, and set it to a long random string (for example the output of `openssl rand -hex 32`). This is your password.
6. Visit your `*.workers.dev` URL, click **Sign in**, and enter `SITE_TOKEN`.

Every push to your fork's `master` branch redeploys. To get updates, use **Sync fork** on GitHub.

Until `SITE_TOKEN` is set, sign-in is refused. Changing it signs out every device.

## Local development

Requires [Bun](https://bun.sh) and Node.js 22.18+.

```bash
bun install
cp .dev.vars.example .dev.vars   # set SITE_TOKEN for local sign-in
bun run dev
```

Local KV data is stored under `.wrangler/` and never touches your deployed data.

| Script            | What it does                          |
| ----------------- | ------------------------------------- |
| `bun run dev`     | Dev server with HMR                   |
| `bun run build`   | Production build                      |
| `bun run preview` | Run the production build locally      |
| `bun run deploy`  | Build and deploy to Cloudflare        |
| `bun run types`   | Regenerate Cloudflare binding types   |

## How it works

- `/` is a landing page. Signed-in visitors are sent to `/tracker`.
- `/login` checks your token against `SITE_TOKEN` and stores it in an httpOnly cookie.
- Tracker state is cached in `localStorage` and saved to KV (`/api/state`). The last write wins if two devices edit at the same time.
- Reminders are local to each browser where you enable them.
