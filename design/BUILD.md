# Recursify v1 — build brief

Source of truth for the rewrite. Design: Figma `KeyG3THsnvKLlsiMzZyn0e`, page **Hi-fi**, numbered
sections 1–9. Colours: `design/tokens.css`. Copy text exactly as it appears in Figma.

## Product in one paragraph

Recursify is a self-hosted LeetCode tracker with spaced repetition. You log a solve. FSRS predicts
when you'll forget the problem and brings it back in the review queue. You grade each re-solve 1–4,
and the topic polygon shows how much of each topic in your list you've covered. It's a fresh site:
no data migration, FSRS from day one.

## Stack (keep)

- vinext (Next.js App Router API on Vite), React 19, Tailwind 4, `@base-ui/react`, lucide icons.
- Cloudflare Workers via `cf` (`cloudflare.config.ts`). Deploy = `cf deploy` (`bun run deploy`).
  Never `wrangler deploy`.
- **D1** replaces KV. Binding `DB`, declared by name with no `id` in the repo; `cf deploy`
  provisions it. The Worker applies its own append-only migrations on first request
  (`src/lib/db.ts`), because `cf d1 migrations apply` needs a database ID the repo never has.
- Auth unchanged: `SITE_TOKEN` secret plus an httpOnly cookie. Reject the placeholder and tokens
  shorter than 24 chars.
- No new runtime dependencies unless unavoidable. FSRS, CSV and the polygon are hand-written.

## Data model (D1)

Built-in lists (Blind 75, LeetCode 75, NeetCode 150) stay as JSON in `src/data`. The DB stores only
what the user creates:

| table | columns |
|---|---|
| `custom_problems` | `id` TEXT PK, `title`, `url` NULL, `difficulty` (Easy/Medium/Hard), `topics` (JSON array), `note` NULL, `created_at` |
| `reviews` | `id` INTEGER PK, `problem_id` TEXT, `reviewed_at` TEXT (ISO date), `grade` INTEGER NULL (NULL = first solve, 1–4 otherwise) |
| `settings` | `key` TEXT PK, `value` TEXT (JSON) — `followedLists`, `polygonList`, `targetRecall` (0.70–0.97, default 0.90), `newPerDay` (3), `reminder` |

Problem id = LeetCode slug for LeetCode problems, `custom-<uuid>` otherwise. FSRS card state is
**derived by replaying `reviews`**, never stored. Undo = delete the last review row.

## Scheduling (FSRS)

`src/lib/fsrs.ts` is pure and unit-tested.
- R(t,S) = (1 + 19/81 · t/S)^−0.5. Interval for target recall T = S·81/19·(T^−2 − 1).
- Default FSRS weights. Grades: 1 Forgot, 2 Struggled, 3 Recalled, 4 Instant.
- **First solve has no grade.** LeetCode difficulty seeds the state:
  - Easy = Good (≈3d)
  - Medium = Good with S×0.65 and D+1 (≈2d)
  - Hard = Hard (≈1d)
  - Custom problems without a difficulty count as Medium.
- Queue = solved problems with due ≤ today, sorted by lowest retrievability.
- New problems per day: `newPerDay` suggestions from the weakest topics of the polygon list.
- Catch-up: if more than 2× the usual daily load is due, cap the batch at 20/day, most forgotten
  first, and pause new problems.
- Progress copy never shows points: "Recall the next X reviews", X = ⌈(T·n − s)/(1 − T)⌉ over the
  last 4 weeks.

## Screens → routes

| Figma (Hi-fi section) | Route / component |
|---|---|
| 1 Home, Login, SEO frame, OG image | `/` (only when `PUBLIC_SITE=true`, else redirect), `/login`, `public/og.png` |
| 2 Today (+ logging, graded, first run, catch-up states) | `/today` |
| 3 Library (+ filtered, search, problem drawer, custom list, CSV) | `/library?topic=&q=`, drawer = `?p=<id>` |
| 4 Progress | `/progress` |
| 5 Overlays: search dropdown, list picker, shortcuts, settings | header components and dialogs |
| 6 Error & empty states | inline in each screen |
| 7 Mobile | the same routes, responsive below 768px |

Shared: `AppHeader` (brand, Today/Library/Progress nav, list picker, centered search, `A` add,
`?` keys, settings), `AppFooter` (key hints per screen), `Banner`, `InfoTip`, `Kbd`, `TopicPolygon`
(N-gon SVG; hover card; click opens `/library?topic=`).

## Layout rules

- Fixed viewport (`h-dvh` flex column). Header and footer are always visible. Only the Today list,
  queue rows, Library table, Progress body and mobile bodies scroll.
- Newest logged item goes on **top**. Rows animate in with `grid-template-rows 0fr→1fr` plus
  opacity via `@starting-style`, with no animation under `prefers-reduced-motion`.
- Custom problems, or problems where lookup returned no topics, show a `+` that expands an inline
  topics and difficulty editor.

## Keyboard map

| Key | Action |
|---|---|
| `J` / `K` | Move in the queue |
| `Enter` | Open on LeetCode |
| `1`–`4` | Grade focused |
| `Z` | Undo last grade |
| `A` | Focus the log input |
| `/` | Search |
| `L` | List picker |
| `?` | Shortcuts |
| `,` | Settings |
| `Esc` | Close |
| `G T` / `G L` | Go to Today / Library |

The polygon is mouse-only.

## SEO

Copy verbatim from the Figma frame "Home — SEO & meta (for build)". Official origin is
`https://recursify.utkarshchourasia.in`. Forks, demo, `/login` and app routes get
`noindex, nofollow`; `robots.txt` disallows everything unless `PUBLIC_SITE=true`.

## Import / export

CSV only: `title*, url, difficulty, topic, note, reviewed_at, grade`. One row per review; a row
without `reviewed_at` is an unsolved problem. Import replays rows in date order.

## Build order (each phase ends green: `bun run build` + tests + manual check in `bun run dev`)

1. Deploy fix (`cf deploy`). D1 binding plus migration, `fsrs.ts` with tests, data API.
2. Tokens, AppHeader/AppFooter, fixed-viewport shell, Today (polygon, banner, Today section,
   queue, grading, undo toast).
3. Library (table, topic filter, search, drawer), custom problems, CSV import/export.
4. Progress (tiles, lists, heatmap, upcoming bars, recall line).
5. Overlays (search dropdown, list picker, shortcuts, settings), catch-up states, error states.
6. Home, Login, SEO (meta, robots, sitemap, OG image), `PUBLIC_SITE` gating, README.
7. Mobile pass, dark mode via tokens, accessibility pass.

Deferred: AI pattern hints, Chrome extension, time tracking, reminders' push delivery.
