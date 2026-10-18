# syntax=docker/dockerfile:1
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
# --ignore-scripts: the only install script that matters is @vscode/sqlite3's node-gyp compile,
# and its binary is built in the `native` stage below, on the same image that runs it.
RUN bun install --frozen-lockfile --ignore-scripts
COPY . .
# Release name for the source-map upload (same tag as the final stage's APP_VERSION).
ARG APP_VERSION=unknown
# Optional: Bugsink base URL for the upload (empty = the default in src/build/sourcemaps.ts).
ARG SENTRY_URL=
# The Bugsink token is a BuildKit secret (never an ARG/ENV, so it is not stored in any layer or
# in the build history). Optional: without it the build skips the upload. Either way no .map
# file stays in .output.
RUN --mount=type=secret,id=SENTRY_AUTH_TOKEN,env=SENTRY_AUTH_TOKEN \
    APP_VERSION=$APP_VERSION SENTRY_URL=$SENTRY_URL bun run build

# @vscode/sqlite3 (behind the SQLite cache) has no prebuilt binary, so it is compiled here, on the
# runtime base image. Compiling in the bun image would link a newer glibc than node:22-slim has.
FROM node:22-slim AS native
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /native/sqlite3
COPY --from=build /app/node_modules/@vscode/sqlite3 ./
# The package has no install script (npm and Bun see binding.gyp and run node-gyp). Its build
# helpers (tar, node-addon-api) are resolved from the build stage's node_modules via NODE_PATH, and
# the node image ships the Node headers, so nothing is downloaded.
RUN --mount=type=bind,from=build,source=/app/node_modules,target=/nm \
    NODE_PATH=/nm npm_config_nodedir=/usr/local \
    node /usr/local/lib/node_modules/npm/node_modules/node-gyp/bin/node-gyp.js rebuild

FROM node:22-slim
# Deployed tag, reported by /healthz. Pass with --build-arg APP_VERSION=<tag>.
ARG APP_VERSION=unknown
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 APP_VERSION=$APP_VERSION
WORKDIR /app
# .output bundles the JS deps. The one native addon (@vscode/sqlite3) can't be bundled: Nitro
# copies its JS into .output/server/node_modules, and the binary comes from the `native` stage.
COPY --from=build /app/.output ./.output
COPY --from=native /native/sqlite3/build/Release/vscode-sqlite3.node \
  ./.output/server/node_modules/@vscode/sqlite3/build/Release/vscode-sqlite3.node
# Persisted cache: set CACHE_DB_PATH=/data/cache.sqlite and mount a volume at /data (see README).
# Created and owned by `node` so a named volume starts out writable by it.
RUN mkdir -p /data && chown node:node /data
USER node
EXPOSE 3000
HEALTHCHECK CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
