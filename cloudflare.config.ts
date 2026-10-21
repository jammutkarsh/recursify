import { bindings, defineConfig, defineWorker } from "cf/config";

const fromBuildEnv = (name: string) => {
  const value = process.env[name];
  return value ? bindings.text(value) : undefined;
};

// Build variable NEXT_PUBLIC_DEMO=true builds the public demo: a separate Worker with no sign-in
// and no D1 (data lives in each visitor's localStorage, see src/lib/demo.ts).
const DEMO = process.env.NEXT_PUBLIC_DEMO === "true";

export default defineConfig(({ mode }) => ({
  worker: defineWorker({
    name: DEMO ? "recursify-demo" : "recursify",
    // Only the demo declares its domain; the main Worker's custom domain is set per deployment in the dashboard.
    ...(DEMO && { domains: ["demo.recursify.utkarshchourasia.in"] }), // same as DEMO_URL in src/lib/links.ts
    // Run near the D1 database: each request makes several D1 round trips. The demo has no database.
    // workers.dev and version preview URLs stay on (Cloudflare's default) even when a custom domain is declared.
    ...(!DEMO && { placement: { mode: "smart" as const }, workersDev: true, previewUrls: true }),
    // Optional build variables, only for a deployment whose settings were changed in the dashboard: after
    // that, CI deploys stop unless this config matches what's live, including the domain and the D1 id.
    ...(!DEMO && process.env.CUSTOM_DOMAIN && { domains: [process.env.CUSTOM_DOMAIN] }),
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-18",
    compatibilityFlags: ["nodejs_compat"],
    observability: {
      logs: { enabled: true, invocationLogs: true, persist: false },
    },
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: DEMO ? { ASSETS: bindings.assets() } : {
      ASSETS: bindings.assets(),
      // No id in the repo: `cf deploy` creates the database on first deploy, so
      // nothing user-specific lives here and forks sync cleanly (D1_DATABASE_ID: see above).
      // Tables are created by the Worker itself (src/lib/db.ts).
      DB: bindings.d1(process.env.D1_DATABASE_ID ? { id: process.env.D1_DATABASE_ID } : { name: "recursify" }),
      // In production these come from the Workers Builds build variables of the same
      // name and are deployed as plain-text vars. Locally they're read from .dev.vars.
      // When a build variable is absent the binding is left undeclared, so a
      // dashboard secret of the same name still works.
      SITE_TOKEN: fromBuildEnv("SITE_TOKEN") ?? (mode === "development" && bindings.secret()),
      // "true" only on the official deployment: serves the marketing home and lets it be indexed.
      PUBLIC_SITE: fromBuildEnv("PUBLIC_SITE") ?? (mode === "development" && bindings.secret()),
    },
  }),
}));
