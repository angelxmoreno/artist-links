import { createFileRoute } from "@tanstack/react-router";

// Dynamic so the Sitemap line can be absolute without a configured domain.
export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { originFromRequest } = await import("../server/origin");
        const body = `User-agent: *\nAllow: /\n\nSitemap: ${originFromRequest(request)}/sitemap.xml\n`;
        return new Response(body, { headers: { "content-type": "text/plain" } });
      },
    },
  },
});
