import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig(({ mode }) => ({
  worker: defineWorker({
    name: "leetcode-tracker",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-10-18",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      // Created automatically on first deploy.
      KV: bindings.kv(),
      // Read from .dev.vars locally. In production it's a dashboard secret,
      // left undeclared so the very first deploy doesn't require it.
      SITE_TOKEN: mode === "development" && bindings.secret(),
    },
  }),
}));
