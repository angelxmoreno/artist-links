import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { FEATURED } from "@/data/featured";
import { SITE_PAGES } from "@/lib/nav";
import { getAppCache, resetAppCacheForTests, SITEMAP_MAX_URLS } from "@/server/cache.server";
import { Route } from "@/routes/sitemap[.]xml";

const VIEWED = "11111111-2222-4333-8444-555555555555";

beforeEach(() => {
  vi.stubEnv("CACHE_DB_PATH", "");
  resetAppCacheForTests();
});
afterEach(() => {
  vi.unstubAllEnvs();
  resetAppCacheForTests();
});

const ORIGIN = "https://links.example";
const abs = (paths: string[]) => paths.map((p) => `${ORIGIN}${p}`);
const STATIC = SITE_PAGES.map((p) => p.to);

async function sitemap() {
  const handlers = Route.options.server?.handlers as unknown as {
    GET: (ctx: unknown) => Promise<Response>;
  };
  const res = await handlers.GET({ request: new Request("https://links.example/sitemap.xml") });
  const body = await res.text();
  return { res, body, locs: [...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]!) };
}

describe("GET /sitemap.xml", () => {
  it("lists home, the static pages and Featured when nothing was viewed", async () => {
    const { res, locs } = await sitemap();
    expect(res.headers.get("content-type")).toContain("application/xml");
    expect(locs).toEqual([
      ...abs(["/", ...STATIC]),
      ...FEATURED.map((a) => `${ORIGIN}/artist/${a.mbid}`),
    ]);
  });

  it("lists every static page", async () => {
    const { locs } = await sitemap();
    for (const path of ["/about", "/how-it-works", "/platforms", "/privacy"])
      expect(locs).toContain(`${ORIGIN}${path}`);
  });

  it("has no /artists directory pages", async () => {
    const { locs } = await sitemap();
    expect(locs.some((l) => l.includes("/artists"))).toBe(false);
  });

  it("includes viewed artists after Featured", async () => {
    await getAppCache().recordViewed(VIEWED);
    const { locs } = await sitemap();
    expect(locs.at(-1)).toBe(`https://links.example/artist/${VIEWED}`);
    expect(locs.filter((l) => l.includes("/artist/"))).toHaveLength(FEATURED.length + 1);
  });

  it("lists an artist that is both Featured and viewed only once", async () => {
    const featured = FEATURED[0]!.mbid;
    await getAppCache().recordViewed(featured);
    const { locs } = await sitemap();
    expect(locs.filter((l) => l.endsWith(featured))).toHaveLength(1);
    expect(locs.filter((l) => l.includes("/artist/"))).toHaveLength(FEATURED.length);
  });

  it("ignores stored ids that are not UUIDs", async () => {
    await getAppCache().recordViewed("<script>x</script>");
    const { body } = await sitemap();
    expect(body).not.toContain("script");
  });

  it("caps the file at 50,000 URLs, keeping home and Featured", async () => {
    const cache = getAppCache();
    const list = vi
      .spyOn(cache, "listViewed")
      .mockResolvedValue(
        Array.from(
          { length: SITEMAP_MAX_URLS + 10 },
          (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
        ),
      );
    const { locs } = await sitemap();
    expect(list).toHaveBeenCalledWith(SITEMAP_MAX_URLS);
    expect(locs).toHaveLength(SITEMAP_MAX_URLS);
    expect(locs[0]).toBe("https://links.example/");
    expect(locs).toContain(`https://links.example/artist/${FEATURED[0]!.mbid}`);
  });
});
