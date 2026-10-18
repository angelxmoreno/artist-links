# syntax=docker/dockerfile:1
FROM oven/bun:1 AS build
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM node:22-slim
# Deployed tag, reported by /healthz. Pass with --build-arg APP_VERSION=<tag>.
ARG APP_VERSION=unknown
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 APP_VERSION=$APP_VERSION
WORKDIR /app
# .output is self-contained (deps bundled), no node_modules needed.
COPY --from=build /app/.output ./.output
USER node
EXPOSE 3000
HEALTHCHECK CMD node -e "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"
CMD ["node", ".output/server/index.mjs"]
