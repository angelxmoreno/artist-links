import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Server functions need the Start runtime; here the handler is called directly.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      inputValidator: () => chain,
      handler: (fn: (a: { data: unknown }) => unknown) => (a: { data: unknown }) => fn(a),
    };
    return chain;
  },
}));

const getArtist = vi.fn();
vi.mock("@/server/musicbrainz.server", async (orig) => ({
  ...(await orig<typeof import("@/server/musicbrainz.server")>()),
  getArtist: (...a: unknown[]) => getArtist(...a),
}));

import { fetchArtist } from "@/lib/api";
import { getAppCache, resetAppCacheForTests } from "@/server/cache.server";

const MBID = "11111111-2222-4333-8444-555555555555";
const withLink = {
  id: MBID,
  name: "A",
  relations: [{ type: "official homepage", url: { resource: "https://example.com/" } }],
};

beforeEach(() => {
  vi.stubEnv("CACHE_DB_PATH", "");
  resetAppCacheForTests();
});
afterEach(() => {
  vi.unstubAllEnvs();
  getArtist.mockReset();
  resetAppCacheForTests();
});

// The recording is fire and forget, so give its promise chain a moment to settle.
const settle = () => new Promise((r) => setTimeout(r, 20));

describe("fetchArtist records viewed artists", () => {
  it("records an artist with links", async () => {
    getArtist.mockResolvedValue(withLink);
    await expect(fetchArtist({ data: { mbid: MBID } })).resolves.toEqual(withLink);
    await settle();
    expect(await getAppCache().listViewed(10)).toEqual([MBID]);
  });

  it("stores the artist's name with the id", async () => {
    getArtist.mockResolvedValue(withLink);
    await fetchArtist({ data: { mbid: MBID } });
    await settle();
    expect(await getAppCache().listViewedWithNames(10)).toEqual([{ mbid: MBID, name: "A" }]);
  });

  it("does not record an artist with zero links", async () => {
    getArtist.mockResolvedValue({ id: MBID, name: "A", relations: [] });
    await fetchArtist({ data: { mbid: MBID } });
    await settle();
    expect(await getAppCache().listViewed(10)).toEqual([]);
  });

  it("does not record when the artist does not exist", async () => {
    getArtist.mockResolvedValue(null);
    await expect(fetchArtist({ data: { mbid: MBID } })).resolves.toBeNull();
    await settle();
    expect(await getAppCache().listViewed(10)).toEqual([]);
  });

  it("still serves the page when recording fails", async () => {
    getArtist.mockResolvedValue(withLink);
    vi.spyOn(getAppCache(), "recordViewed").mockRejectedValue(new Error("boom"));
    await expect(fetchArtist({ data: { mbid: MBID } })).resolves.toEqual(withLink);
    await settle();
  });
});
