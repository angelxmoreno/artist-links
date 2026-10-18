import { createFileRoute } from "@tanstack/react-router";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const [
          { originFromRequest },
          { FEATURED },
          { listViewedArtists, SITEMAP_MAX_URLS },
          { getDirectory },
          { directoryPaths },
          { SITE_PAGES },
        ] = await Promise.all([
          import("../server/origin"),
          import("../data/featured"),
          import("../server/cache.server"),
          import("../server/directory.server"),
          import("../lib/directory"),
          import("../lib/nav"),
        ]);
        const origin = originFromRequest(request);
        // Home, the static pages, the directory pages that have content and Featured come first;
        // viewed artists fill what is left of the 50,000-URL limit of one sitemap file (beyond
        // that, switch to a sitemap index of several files). /artists is listed by directoryPaths.
        const directory = directoryPaths(await getDirectory());
        const fixed = [
          "/",
          ...SITE_PAGES.map((p) => p.to).filter((p) => p !== "/artists"),
          ...directory,
          ...FEATURED.map((a) => `/artist/${a.mbid}`),
        ];
        const viewed = (await listViewedArtists(SITEMAP_MAX_URLS))
          .filter((id) => UUID_RE.test(id))
          .map((id) => `/artist/${id}`);
        const paths = [...new Set([...fixed, ...viewed])].slice(0, SITEMAP_MAX_URLS);
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
