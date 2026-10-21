import { bindings, defineConfig, defineWorker } from "cf/config";

const fromBuildEnv = (name: string) => {
  const value = process.env[name];
  return value ? bindings.text(value) : undefined;
};

export default defineConfig(({ mode }) => ({
  worker: defineWorker({
    name: "recursify",
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
    env: {
      ASSETS: bindings.assets(),
      // No id on purpose: `cf deploy` creates the database on first deploy, so
      // nothing user-specific lives in the repo and forks sync cleanly.
      // Tables are created by the Worker itself (src/lib/db.ts).
      DB: bindings.d1({ name: "recursify" }),
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
