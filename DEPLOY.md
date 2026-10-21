# Deploy Recursify (agent runbook)

This file is written for an AI coding agent (Claude Code, Codex, Cursor, …) with a shell on the user's machine.
The user hands you this file's raw URL; you take them from nothing to a running private Recursify.

**Done means** you hand the user exactly two things at the end:

1. a working URL (`https://recursify.<subdomain>.workers.dev`) that you verified yourself, and
2. their `SITE_TOKEN`, the password for that URL.

Work through the steps in order. Each step says how to check it passed. Don't skip a check.

## Rules

- **Logins belong to the user.** Never ask for a GitHub or Cloudflare password or API token in chat, and never type one. When a CLI needs to log in, tell the user the exact command and have them run it themselves (in Claude Code: type `! <command>`). Both CLIs log in through the browser.
- **The `SITE_TOKEN` is shown once**, in your final report. Don't echo it in between, and never commit it. It lives in `.dev.vars`, which git ignores.
- **Don't overwrite or delete anything you didn't create.** If a Worker named `recursify` or a D1 database named `recursify` already exists on the account, stop and ask the user whether it's theirs to reuse.
- **Stop and ask** when a check fails twice. Report the command and the shortest decisive error line.
- Commands below are for macOS/Linux shells. On Windows, use WSL or translate them.

## 1. Preflight: tools

Run each check. Install whatever is missing (ask the user first if installing needs `sudo` or changes their system package manager).

| Tool | Check | Needs | Install |
| --- | --- | --- | --- |
| git | `git --version` | any | <https://git-scm.com/downloads> |
| Node.js | `node -v` | **22 or newer** | <https://nodejs.org> or `brew install node` |
| Bun | `bun --version` | any (optional: npm works too) | `curl -fsSL https://bun.sh/install \| bash` |
| GitHub CLI | `gh --version` | any | `brew install gh` · <https://cli.github.com> |
| openssl | `openssl version` | any | ships with macOS/Linux |

The Cloudflare CLI (`cf`) is a dependency of the project, so you don't install it globally. Use `npx cf …` from inside the repo after step 3. Before that, `npx -y cf@latest …` works anywhere.

Below, `$PM` means `bun` if Bun is installed, otherwise `npm`.

## 2. Preflight: logins and access

**GitHub.**

```sh
gh auth status
```

Pass: it says "Logged in to github.com" with the `repo` scope. Otherwise ask the user to run `gh auth login` (GitHub.com → HTTPS → login with a web browser), then check again.

**Cloudflare.**

```sh
npx -y cf@latest auth whoami
```

Pass: JSON with `"authenticated": true` and at least one entry in `accounts`. Otherwise ask the user to run `npx -y cf@latest auth login`. It opens the browser, and a free Cloudflare account is enough (they can sign up there).

If `accounts` lists more than one account, ask the user which one to use, then `export CLOUDFLARE_ACCOUNT_ID=<id>` for every later `cf` command.

## 3. Fork and install

```sh
gh repo fork jammutkarsh/recursify --clone --default-branch-only
cd recursify
$PM install
```

If the user already has a fork, `gh repo fork` says so. Then clone it with `gh repo clone <their-login>/recursify` and continue.

Pass: `npx cf --version` prints a version from inside the `recursify` folder.

The fork matters: the user's copy of the code lives in their GitHub, and they get updates with GitHub's **Sync fork** button (step 7).

## 4. Check for name clashes

```sh
npx cf workers scripts search --name recursify
```

Pass: `[]`. If a Worker named `recursify` exists, ask the user whether it's an earlier Recursify of theirs. If it is, deploying updates it in place and keeps its data. If it isn't, stop: the name comes from `name` in `cloudflare.config.ts` and must be unique per account.

## 5. Make the password

```sh
printf 'SITE_TOKEN=%s\nPUBLIC_SITE=false\n' "$(openssl rand -hex 32)" > .dev.vars
chmod 600 .dev.vars
```

The app refuses tokens shorter than 24 characters and the example placeholder. `.dev.vars` is git-ignored, and `bun run dev` uses it for local development too.

## 6. Deploy

```sh
SITE_TOKEN="$(sed -n 's/^SITE_TOKEN=//p' .dev.vars)" $PM run deploy
```

This runs `cf deploy`. It builds the app, creates the D1 database `recursify` on first deploy, and uploads the Worker with `SITE_TOKEN` as a variable. The app creates its own tables on first request. **Don't use `wrangler deploy`**: it rejects this build output.

Find the `https://…workers.dev` URL in the output. Call it `$URL`.

If the deploy fails because the account has no workers.dev subdomain yet, ask the user to open <https://dash.cloudflare.com/?to=/:account/workers-and-pages>, choose a subdomain when prompted, and tell you when done. Then run the deploy again.

**Verify** (all four must pass; a fresh Worker can take ~30 s to answer):

```sh
TOKEN="$(sed -n 's/^SITE_TOKEN=//p' .dev.vars)"
curl -s -o /dev/null -w '%{http_code}\n' "$URL/login"                    # 200
curl -s -o /dev/null -w '%{http_code}\n' -X POST "$URL/api/login" \
  -H 'content-type: application/json' -d '{"token":"wrong-token-for-check"}'   # 401
curl -s -c /tmp/recursify-cookie -o /dev/null -w '%{http_code}\n' -X POST "$URL/api/login" \
  -H 'content-type: application/json' -d "{\"token\":\"$TOKEN\"}"           # 200
curl -s -b /tmp/recursify-cookie "$URL/api/data" | head -c 80; echo; rm -f /tmp/recursify-cookie   # JSON starting {"settings":
```

The last check proves D1 works. If `/api/login` returns a "SITE_TOKEN not set" error, the variable didn't reach the Worker: re-run the deploy command exactly as written above.

## 7. Auto-deploy updates (recommended)

Without this, the Worker only changes when someone re-runs step 6. With it, Cloudflare rebuilds whenever the fork's `master` changes, which is what **Sync fork** does. `master` only ever holds tagged releases, so users only receive released versions.

Connecting GitHub to Cloudflare needs the Cloudflare GitHub app, which only the user can approve in a browser. Ask them to:

1. Open <https://dash.cloudflare.com/?to=/:account/workers/services/view/recursify/production/settings>.
2. Under **Build**, click **Connect**, choose GitHub, and approve the app for their `recursify` fork.
3. Use branch `master`, leave **Build command** empty, set **Deploy command** to `bun run deploy`, and save.

Then you finish the setup. The build needs `SITE_TOKEN` as a build variable, or the next build deploys without a password and sign-in breaks.

```sh
TAG="$(npx cf workers scripts search --name recursify | sed -n 's/.*"id": "\([0-9a-f]*\)".*/\1/p')"
npx cf builds triggers list --external-script-id "$TAG"        # note trigger_uuid; check deploy_command is "bun run deploy"
TRIGGER=<trigger_uuid>
npx cf builds triggers environment-variables upsert "$TRIGGER" \
  --body "{\"SITE_TOKEN\":{\"value\":\"$(sed -n 's/^SITE_TOKEN=//p' .dev.vars)\",\"is_secret\":true}}"
npx cf builds create "$TRIGGER" --branch master
```

Turn off branch previews. Their default `npx wrangler preview` command fails on this project, and a preview would run unreleased code against the same D1 database:

```sh
npx cf builds workers update "$TAG" --previews-enabled false
```

If `deploy_command` isn't `bun run deploy`, fix it with `npx cf builds triggers update "$TRIGGER" --build-command "" --deploy-command "bun run deploy"`.

Wait for the build: poll `npx cf builds list --external-script-id "$TAG" --per-page 1` every ~20 s until `status` is `stopped`. `build_outcome` must be `success`. Then repeat the step 6 checks against `$URL`.

## 8. Report to the user

Give them exactly this, filled in:

```text
Recursify is live.

URL:         <URL>
SITE_TOKEN:  <token from .dev.vars>   ← your password; store it in a password manager

Your fork:   https://github.com/<login>/recursify
Updates:     open your fork on GitHub → Sync fork. Cloudflare redeploys by itself.   (or: re-run step 6, if step 7 was skipped)
Your data:   Cloudflare D1 database "recursify". It's never in the repo, so syncing can't touch it.
```

Then mention, briefly:

- **If a build later fails with "Aborting the upload operation because of conflicts":** that happens after a setting is changed in the dashboard (a custom domain, Smart Placement…). Add build variables `CUSTOM_DOMAIN` (their domain) and `D1_DATABASE_ID` (from `npx cf d1 list` or the dashboard) with the step 7 command, then start a build.

- **Custom domain:** dashboard → Worker `recursify` → Settings → Domains & Routes → Add.
- **Changing the password:** set a new `SITE_TOKEN` build variable (step 7 command) and start a build, or re-run step 6 with a new `.dev.vars`.
- **Local development:** `bun run dev`, then open `http://[::1]:5173` and sign in with the same token.
