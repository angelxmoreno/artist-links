import { createFileRoute } from "@tanstack/react-router";

// Liveness probe for the Docker HEALTHCHECK. No rendering, no MusicBrainz.
export const Route = createFileRoute("/healthz")({
  server: {
    handlers: {
      GET: async () => {
        const { getVersion } = await import("../server/version");
        return Response.json(
          { status: "ok", version: getVersion() },
          { headers: { "cache-control": "no-store" } },
        );
      },
    },
  },
});
