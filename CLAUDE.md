# CLAUDE.md

Artist Links: paste a music-artist URL, get all their other links via MusicBrainz. TanStack Start app, deployed as a Node server in Docker.

## Commands

- `bun install --frozen-lockfile` — install (Bun is the package manager; `bun.lock` is authoritative)
- `bun run dev` / `bun run build` / `bun run test` / `bun run lint`
- `bun run build` makes a Node server; run it with `HOST=0.0.0.0 PORT=3000 node .output/server/index.mjs`
- Docker: `docker build --platform linux/amd64 -t artist-links:deploy-test .`

## Layout

- `src/routes/` — file-based routes: `__root.tsx` (head/meta, runtime config via `getRootData`), `index.tsx` (home: SearchBox, Recent, Featured, Hero), `artist.$mbid.tsx` (SSR artist page, per-artist meta + JSON-LD), `sitemap[.]xml.ts`, `robots[.]txt.ts`, `healthz.ts` (JSON `{status, version}`, used by the Docker HEALTHCHECK; version from `src/server/version.ts`). `src/routeTree.gen.ts` is generated; don't edit.
- `src/lib/api.ts` — server functions (`lookupByUrl`, `fetchArtist`, `searchByName`); `src/server/musicbrainz.server.ts` — MusicBrainz client with User-Agent, 1 req/s queue, in-flight de-dupe, and a keyvhq cache (injectable via `cache` option). Server-only code lives in `src/server/` and is imported dynamically inside handlers.
- `src/server/image.server.ts` — artist photo (MB wikidata relation → Wikidata P18 → Commons imageinfo), 2.5s timeout, never throws, cached in the shared keyvhq cache (7d hit / 1d none / failures not cached); `fetchArtistPhoto` in `api.ts` feeds the header photo and per-artist `og:image` in `artist.$mbid.tsx`.
- `src/lib/links.ts` (URL normalize), `platforms.ts` (host → platform/group), `platform-icons.ts`, `types.ts`, `api-types.ts` (server/UI contract), `looks-like-url.ts`, `analytics.ts` (Umami `track`), `monitoring.ts` (browser Sentry), `root-data.ts`.
- `src/server/cache.server.ts` — keyvhq cache: SQLite file at `CACHE_DB_PATH` (empty or unopenable = bounded memory), namespaces `mb` (responses, TTL) and `viewed` (MBIDs for the sitemap, recorded fire-and-forget from `fetchArtist`), hourly sweep of expired rows. `nitro.config.ts` keeps the native `@vscode/sqlite3` external and traced.
- `src/server/monitoring.server.ts` (Sentry node, tag `runtime=server`; browser uses `runtime=browser`), `config.ts` (public runtime config from env), `origin.ts`, `nitro-plugin.ts` + `warm.server.ts` (boot-time cache warm-up of Featured artists, via the app's own fetch because Nitro bundles plugins separately).
- `src/components/` — app components (SearchBox, ArtistView, FeaturedArtists, RecentList, Hero, SiteShell); `ui/` is shadcn.
- `src/data/featured.ts` — curated Featured artists (MBIDs). Edit to change the homepage list.
- `src/hooks/use-recent.ts` — recently viewed (localStorage).
- `public/` — favicon set, `og.png`, manifest; `brand/` has sources and regeneration notes.
- `src/server.ts`, `src/start.ts`, `src/lib/error-*.ts` — SSR error wrapper; errors also go to Sentry.
- Tests: `src/**/*.test.ts(x)` and `src/test/` (Vitest + Testing Library, jsdom). Put route-level tests in `src/test/`, not `src/routes/`.

## Gotchas

- `vite.config.ts` is a plain Vite config: Tailwind, tsconfig paths, TanStack Start (entry `src/server.ts`, client import protection for `src/server/**`), Nitro `node-server` preset on build, React. The Nitro/Node preset is the only deploy target.
- `bunfig.toml` enforces a 24h `minimumReleaseAge`; don't add excludes without asking.
- Deploy: self-hosted Dokploy, linux/amd64, port 3000. Config is runtime env (see `.env.example`); never use `VITE_*` for it.
- `APP_VERSION` (the deployed tag, shown by `/healthz`) is a Docker build arg turned into a runtime env in the final stage; Dokploy injects nothing, so set it in the app's Build Time Arguments before pushing each tag. Unset = `unknown`.
- `@vscode/sqlite3` is a native addon: compiled at install (needs python3/make/g++), never bundled. Docker compiles it in the `native` stage on `node:22-slim` (glibc must match the runtime). Single app instance only (SQLite file on a `/data` volume).
- Source maps: client build emits hidden maps; `src/build/sourcemaps.ts` (wired in `vite.config.ts`) uploads them to Bugsink with sentry-cli (debug IDs) when `SENTRY_AUTH_TOKEN` is set, and always deletes every `.map` so none ships. The token is a Docker build secret (`--mount=type=secret`), never ARG/ENV. Release = `SENTRY_RELEASE` else `APP_VERSION` (`src/lib/release.ts`).
- Adding a route file requires a build/dev run to regenerate `routeTree.gen.ts`.
- Git: don't stage/commit/push unless asked.
