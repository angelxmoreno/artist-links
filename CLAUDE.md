# CLAUDE.md

Artist Links: paste a music-artist URL, get all their other links via MusicBrainz. Lovable-generated TanStack Start app (see `AGENTS.md` for Lovable git rules: never rewrite pushed history).

## Commands

- `bun install --frozen-lockfile` — install (Bun is the package manager; `bun.lock` is authoritative)
- `bun run dev` / `bun run build` / `bun run test` / `bun run lint`
- Node-server build: `NITRO_PRESET=node-server bun run build`, run with `HOST=0.0.0.0 PORT=3000 node .output/server/index.mjs`
- Docker: `docker build --platform linux/amd64 -t artist-links:deploy-test .`

## Layout

- `src/routes/` — file-based routes (`__root.tsx`, `index.tsx` is the whole UI). `src/routeTree.gen.ts` is generated; don't edit.
- `src/lib/musicbrainz.ts` — MusicBrainz client (browser-side, global 1 req/s queue, retry on 503) and URL → artist matching.
- `src/lib/platform-icons.ts` — platform icon mapping.
- `src/components/ui/` — shadcn/ui components.
- `src/server.ts`, `src/lib/error-*.ts`, `src/lib/lovable-error-reporting.ts` — SSR error wrapper / Lovable error reporting.
- `src/test/` — Vitest + Testing Library (jsdom).

## Gotchas

- `vite.config.ts` uses `@lovable.dev/vite-tanstack-config`, which already adds TanStack Start, React, Tailwind, tsconfig paths and Nitro. Do NOT add those plugins manually (duplicates break the app). Extra config goes through `defineConfig({ vite: {...} })`.
- Default build targets Cloudflare. `NITRO_PRESET=node-server` is honored by the config and used by the Dockerfile; keep the default build unchanged for Lovable.
- `bun.lock` must not contain Lovable's private registry URLs (`*.pkg.dev/lovable-core-prod`) — they 403 outside Lovable and break `--frozen-lockfile`. Use `""` (default registry) for the resolved URL.
- `bunfig.toml` enforces a 24h `minimumReleaseAge`; don't add excludes without asking.
- Deploy: self-hosted Dokploy, linux/amd64, port 3000, no env vars/secrets needed.
- Git: don't stage/commit/push unless asked.
