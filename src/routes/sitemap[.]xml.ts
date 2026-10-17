import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const [{ originFromRequest }, { FEATURED }] = await Promise.all([
          import("../server/origin"),
          import("../data/featured"),
        ]);
        const origin = originFromRequest(request);
        const paths = ["/", ...FEATURED.map((a) => `/artist/${a.mbid}`)];
        const body =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          paths.map((p) => `  <url><loc>${origin}${p}</loc></url>`).join("\n") +
          `\n</urlset>\n`;
        return new Response(body, { headers: { "content-type": "application/xml" } });
      },
    },
  },
});
