# Artist Links

Paste one link to a music artist (Spotify, Instagram, Bandcamp, official site, …) or search by name, and get all their other links, grouped by Streaming, Social, Reference, Official website and Other. Data comes from the public [MusicBrainz](https://musicbrainz.org) API, fetched server-side (1 request/second queue, 24h in-memory cache, Featured artists pre-warmed at boot). Each artist has a server-rendered, shareable page at `/artist/<mbid>`; the homepage shows a curated Featured list (`src/data/featured.ts`) and the visitor's recently viewed artists (localStorage).

## Stack

TanStack Start (React 19, file-based routing in `src/routes`, server functions in `src/lib/api.ts`), Tailwind CSS 4, shadcn/ui (Radix), Vite 8, Nitro, Bun, Vitest. Monitoring: Sentry SDKs pointed at Bugsink. Analytics: Umami.

## Development

```sh
bun install
bun run dev      # dev server
bun run test     # vitest
bun run lint
bun run build    # production build (Node server in .output/)
bun run lint && bun run test
```

## Configuration

Copy `.env.example` to `.env`. Everything is optional; empty means the feature is off. In Dokploy set the same variables in the app's Environment tab (runtime, no rebuild needed).

| Variable                                | Purpose                                                          |
| --------------------------------------- | ---------------------------------------------------------------- |
| `MUSICBRAINZ_CONTACT`                   | Contact URL/email in the MusicBrainz `User-Agent` (their policy) |
| `SITE_URL`                              | Base URL for canonical/OG/sitemap; empty = request origin        |
| `SENTRY_DSN`                            | Bugsink DSN for server and browser errors                        |
| `SENTRY_ENVIRONMENT`                    | Environment tag in Bugsink (empty = `NODE_ENV`)                  |
| `UMAMI_SCRIPT_URL` / `UMAMI_WEBSITE_ID` | Umami analytics script and site ID                               |

## Self-hosted deploy (Docker / Dokploy)

`bun run build` produces a plain Node server (`.output/server/index.mjs`, Nitro `node-server` preset set in `vite.config.ts`).

The `Dockerfile` is multi-stage (Bun build, `node:22-slim` runtime), listens on `0.0.0.0:3000`, runs as the non-root `node` user and has a healthcheck.

```sh
# build (Apple Silicon -> amd64 server)
docker build --platform linux/amd64 -t artist-links:deploy-test .

# run, then open http://localhost:3000
docker run --rm --platform linux/amd64 -p 3000:3000 artist-links:deploy-test
```

Without Docker:

```sh
bun run build
HOST=0.0.0.0 PORT=3000 node .output/server/index.mjs
```

In Dokploy, use the Dockerfile build type and container port 3000. Env vars are optional (see Configuration). CI (`.github/workflows/ci.yml`) runs lint, tests, build and a Docker build.
