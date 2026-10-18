import { defineConfig, type Plugin } from "vite";
import tailwindcss from "@tailwindcss/vite";
import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { resolve } from "node:path";
import tsConfigPaths from "vite-tsconfig-paths";

import { processSourcemaps } from "./src/build/sourcemaps";
import { resolveRelease } from "./src/lib/release";

// Runs right after the browser bundle is written and before Nitro scans its public dir (so
// deleted maps never enter Nitro's asset manifest): uploads the source maps to Bugsink when
// SENTRY_AUTH_TOKEN is set, and always deletes them so they are never served.
function bugsinkSourcemaps(): Plugin {
  return {
    name: "artist-links:bugsink-sourcemaps",
    apply: "build",
    applyToEnvironment: (environment) => environment.name === "client",
    async writeBundle(options) {
      const env = process.env;
      const { root, build } = this.environment.config;
      await processSourcemaps({
        dir: options.dir ?? resolve(root, build.outDir),
        token: env["SENTRY_AUTH_TOKEN"]?.trim(),
        url: env["SENTRY_URL"]?.trim(),
        org: env["SENTRY_ORG"]?.trim(),
        project: env["SENTRY_PROJECT"]?.trim(),
        release: resolveRelease(env["SENTRY_RELEASE"], env["APP_VERSION"]),
      });
    },
  };
}

export default defineConfig(({ command }) => ({
  css: { transformer: "lightningcss" },
  environments: { client: { build: { sourcemap: "hidden" } } },
  resolve: {
    dedupe: ["react", "react-dom", "@tanstack/react-query", "@tanstack/query-core"],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({
      // Our SSR error wrapper (src/server.ts) is the server entry.
      server: { entry: "server" },
      // Keep src/server/** out of the client bundle.
      importProtection: {
        behavior: "error",
        client: { files: ["**/server/**"], specifiers: ["server-only"] },
      },
    }),
    // Production builds run as a plain Node server (.output/server/index.mjs).
    ...(command === "build"
      ? [nitro({ preset: "node-server", plugins: ["./src/server/nitro-plugin.ts"] })]
      : []),
    ...(command === "build" ? [bugsinkSourcemaps()] : []),
    viteReact(),
  ],
}));
