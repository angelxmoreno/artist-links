# Artist Links

Paste one link to a music artist (Spotify, Instagram, Bandcamp, official site, …) or search by name, and get all their other links, grouped by Streaming, Social, Reference, Official website and Other. Data comes from the public [MusicBrainz](https://musicbrainz.org) API, fetched server-side (1 request/second queue, 24h cache that survives restarts when a SQLite file is configured, Featured artists pre-warmed at boot). Each artist has a server-rendered, shareable page at `/artist/<mbid>`; the homepage shows a curated Featured list (`src/data/featured.ts`) and the visitor's recently viewed artists (localStorage).

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
| `SENTRY_RELEASE`                        | Release tag for errors (empty = `APP_VERSION`, none if unknown)  |
| `UMAMI_SCRIPT_URL` / `UMAMI_WEBSITE_ID` | Umami analytics script and site ID                               |
| `CACHE_DB_PATH`                         | SQLite file for the persisted cache; empty = memory only         |
| `APP_VERSION`                           | Deployed tag shown by `/healthz` (build arg, see Deploy below)   |

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

### Persisted cache and the volume at /data

MusicBrainz responses and the list of viewed artists are stored with [keyvhq](https://github.com/microlinkhq/keyvhq) (`@keyvhq/core` + `@keyvhq/sqlite`) in one SQLite file, so a restart or deploy no longer starts cold and the sitemap keeps growing.

- **What is cached:** the parsed MusicBrainz response per request path (artist pages, URL lookups, name searches), 24h for hits and 1h for "not found". A request that is already cached never reaches the rate limiter or MusicBrainz. Expired rows are deleted by an hourly sweep, so the file does not grow forever.
- **Sitemap:** `/sitemap.xml` lists home, the Featured artists and every artist page that was served with at least one link (re-recorded on each view; an artist not viewed for a year drops out). It is capped at 50,000 URLs, the sitemap protocol limit per file; beyond that it should become a sitemap index pointing at several files.
- **No file configured:** `CACHE_DB_PATH` empty or unset keeps everything in memory (dev, tests; lost on restart, capped at 500 cached responses). If the file cannot be opened (missing permission, no volume) the server logs `[cache] cannot open ...` and falls back to memory instead of crashing.
- **Single instance only.** SQLite on a local volume does not support several app replicas writing to one file. Keep Dokploy at 1 replica.
- No backup needed: everything in the file can be fetched again.

Set it up in Dokploy once (the Dockerfile already creates `/data` owned by the `node` user):

1. App, **Environment** tab: add `CACHE_DB_PATH=/data/cache.sqlite` (runtime variable, no rebuild needed).
2. App, **Advanced**, **Volumes / Mounts**: add a **Volume Mount** (a named volume, not a bind mount) with **Mount Path** `/data`.
3. Redeploy. Check the logs for a missing `[cache] cannot open` line, then open a few artist pages and `/sitemap.xml`: viewed artists appear after the Featured ones.

A named volume starts out owned by `node`. If you use a bind mount instead, `chown 1000:1000` the host folder first, otherwise the app falls back to memory (see the log line above).

The SQLite driver (`@vscode/sqlite3`) is a native addon with no prebuilt binary, so it is compiled during the install. The Dockerfile compiles it in a separate stage on `node:22-slim` (the image that runs it, so the glibc matches) and copies it next to the traced JS in `.output/server/node_modules`. `bun install` locally and in CI needs `python3`, `make` and a C++ compiler (macOS with Xcode tools and GitHub's Ubuntu runners have them). A server started with plain `node .output/server/index.mjs` must run on the machine type it was built on.

### Health check and deployed version

`GET /healthz` returns `{ "status": "ok", "version": "v0.0.5" }` (`Cache-Control: no-store`, no MusicBrainz calls). The Docker `HEALTHCHECK` uses it, and you can curl it after a deploy to confirm which tag is live.

The version comes from `APP_VERSION`, a Docker build arg (`ARG APP_VERSION=unknown`) that the Dockerfile copies into the runtime env. Dokploy does not inject the git tag, branch or commit into Dockerfile builds, so set it by hand each release:

1. In the app's **Environment** tab, under **Build Time Arguments**, set `APP_VERSION=v0.0.6` (one `KEY=value` per line).
2. Then push the tag (tag-triggered deploys start as soon as the tag arrives, so the argument must already be updated).

If you forget, `/healthz` reports `"version": "unknown"`. Locally: `docker build --build-arg APP_VERSION=v0.0.6 .` or `APP_VERSION=v0.0.6 node .output/server/index.mjs`.

### Source maps and releases in Bugsink

Errors carry a `release` (server and browser): `SENTRY_RELEASE` if set, otherwise `APP_VERSION` (the tag), otherwise none. The browser gets it at runtime through the public config, so nothing is baked into the bundle.

To make browser stack traces readable, `bun run build` emits hidden source maps (no `sourceMappingURL` in the bundles), and right after the browser bundle is written (`src/build/sourcemaps.ts`, wired in `vite.config.ts`) it runs `sentry-cli sourcemaps inject` + `upload` against Bugsink. **Every `.map` file is deleted afterwards, whether or not the upload ran**, so none is ever served or shipped in the image. Bugsink matches maps to events by the debug ID that `inject` writes into each bundle, not by release name or URL. It needs Bugsink 2.0.14 or newer and `sentry-cli` 2.x (pinned as a devDependency).

The upload only happens when a token is available. Without one (local dev, CI, forgotten setting) the build logs `[sourcemaps] SENTRY_AUTH_TOKEN not set: skipping upload ...`, still succeeds, and errors in Bugsink show minified frames. If a token is present but the upload fails (bad token, Bugsink down), the build logs `[sourcemaps] upload failed ...` and still succeeds with minified stack traces; the maps are always deleted.

**One-time setup in Bugsink:** open the **Tokens** menu (superuser), create an API token limited to this project with the `debug-files:upload` capability.

**In Dokploy, on the app's Environment tab:**

| Field                | Name / value                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------------ |
| Build Time Arguments | `APP_VERSION=v0.0.6` (the tag; update every release, see above)                                        |
| Build-time Secrets   | `SENTRY_AUTH_TOKEN=<token from Bugsink>` (the name must be exactly this: it is the BuildKit secret id) |
| Build Time Arguments | optional `SENTRY_URL=https://...` if Bugsink is not at the default `https://bugsink.2719.fyi`          |

Do not put the token in Build Time Arguments or in the runtime Environment: those persist in the image. The Dockerfile reads it only through `RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN`, so it is not stored in any layer or in `docker history`. Locally:

```sh
SENTRY_AUTH_TOKEN=... docker build --build-arg APP_VERSION=v0.0.6 \
  --secret id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN .
```

Optional build env vars: `SENTRY_URL`, `SENTRY_ORG` (default `bugsinkhasnoorgs`, Bugsink has no organizations) and `SENTRY_PROJECT` (default `artist-links`; Bugsink ignores it). To verify after a deploy, throw a test error in the browser console on the live site and check that the event in Bugsink shows the original file and line and the right release.
