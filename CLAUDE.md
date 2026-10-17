# CLAUDE.md

Artist Links: paste a music-artist URL, get all their other links via MusicBrainz. TanStack Start app, deployed as a Node server in Docker.

## Commands

- `bun install --frozen-lockfile` — install (Bun is the package manager; `bun.lock` is authoritative)
- `bun run dev` / `bun run build` / `bun run test` / `bun run lint`
- `bun run build` makes a Node server; run it with `HOST=0.0.0.0 PORT=3000 node .output/server/index.mjs`
- Docker: `docker build --platform linux/amd64 -t artist-links:deploy-test .`

## Layout

- `src/routes/` — file-based routes: `__root.tsx` (head/meta, runtime config via `getRootData`), `index.tsx` (home: SearchBox, Recent, Featured, Hero), `artist.$mbid.tsx` (SSR artist page, per-artist meta + JSON-LD), `sitemap[.]xml.ts`, `robots[.]txt.ts`. `src/routeTree.gen.ts` is generated; don't edit.
- `src/lib/api.ts` — server functions (`lookupByUrl`, `fetchArtist`, `searchByName`); `src/server/musicbrainz.server.ts` — MusicBrainz client with User-Agent, 1 req/s queue, TTL/LRU cache. Server-only code lives in `src/server/` and is imported dynamically inside handlers.
- `src/lib/links.ts` (URL normalize), `platforms.ts` (host → platform/group), `platform-icons.ts`, `types.ts`, `api-types.ts` (server/UI contract), `looks-like-url.ts`, `analytics.ts` (Umami `track`), `monitoring.ts` (browser Sentry), `root-data.ts`.
- `src/server/monitoring.server.ts` (Sentry node), `config.ts` (public runtime config from env), `origin.ts`.
- `src/components/` — app components (SearchBox, ArtistView, FeaturedArtists, RecentList, Hero, SiteShell); `ui/` is shadcn.
- `src/data/featured.ts` — curated Featured artists (MBIDs). Edit to change the homepage list.
- `src/hooks/use-recent.ts` — recently viewed (localStorage).
- `public/` — favicon set, `og.png`, manifest; `brand/` has sources and regeneration notes.
- `src/server.ts`, `src/start.ts`, `src/lib/error-*.ts` — SSR error wrapper; errors also go to Sentry.
- Tests: `src/**/*.test.ts(x)` and `src/test/` (Vitest + Testing Library, jsdom). Put route-level tests in `src/test/`, not `src/routes/`.

## Gotchas

- `vite.config.ts` is a plain Vite config: Tailwind, tsconfig paths, TanStack Start (entry `src/server.ts`, client import protection for `src/server/**`), Nitro `node-server` preset on build, React. The Nitro/Node preset is the only deploy target.
- `bunfig.toml` enforces a 24h `minimumReleaseAge`; don't add excludes without asking.
- Deploy: self-hosted Dokploy, linux/amd64, port 3000. Config is runtime env (see `.env.example`); never use `VITE_*` for it. Never log or send the user's pasted URL to analytics/Sentry.
- Adding a route file requires a build/dev run to regenerate `routeTree.gen.ts`.
- Git: don't stage/commit/push unless asked.
