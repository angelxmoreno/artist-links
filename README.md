# Artist Links

Paste one link to a music artist (Spotify, Instagram, Bandcamp, official site, …) and get all their other links, grouped by Streaming, Social, Reference, Official website and Other. Data comes from the public [MusicBrainz](https://musicbrainz.org) API, called from the browser (rate-limited to 1 request/second).

Built with [Lovable](https://lovable.dev) — [open in the editor](https://lovable.dev/projects/51fccf8f-ee02-4650-a5bc-224c0f5f1aa3). Commits pushed to `main` sync back into Lovable, so avoid rewriting published history.

## Stack

TanStack Start (React 19, file-based routing in `src/routes`), Tailwind CSS 4, shadcn/ui (Radix), Vite 8, Nitro, Bun, Vitest.

## Development

```sh
bun install
bun run dev      # dev server
bun run test     # vitest
bun run lint
bun run build    # production build (Cloudflare target by default)
```

## Self-hosted deploy (Docker / Dokploy)

`@lovable.dev/vite-tanstack-config` builds Nitro for Cloudflare by default. Setting `NITRO_PRESET=node-server` switches the build to a plain Node server (`.output/server/index.mjs`); no config change is needed, so the Lovable build is unaffected.

The `Dockerfile` is multi-stage (Bun build, `node:22-slim` runtime), sets that variable, listens on `0.0.0.0:3000`, runs as the non-root `node` user and has a healthcheck.

```sh
# build (Apple Silicon -> amd64 server)
docker build --platform linux/amd64 -t artist-links:deploy-test .

# run, then open http://localhost:3000
docker run --rm --platform linux/amd64 -p 3000:3000 artist-links:deploy-test
```

Without Docker:

```sh
NITRO_PRESET=node-server bun run build
HOST=0.0.0.0 PORT=3000 node .output/server/index.mjs
```

In Dokploy, use the Dockerfile build type and container port 3000. No env vars or secrets are required.
