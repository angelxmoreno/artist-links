import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FEATURED } from "@/data/featured";
import { createCache } from "./cache.server";
import {
  artistCacheKey,
  buildDirectory,
  DIRECTORY_TTL_MS,
  getDirectory,
  resetDirectoryForTests,
} from "./directory.server";
import { createMusicBrainz } from "./musicbrainz.server";

const A = "11111111-2222-4333-8444-555555555555";
const B = "66666666-7777-4888-8999-000000000000";
const C = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  resetDirectoryForTests();
  // Building the directory must never reach the network (MusicBrainz or anything else).
  fetchSpy = vi.fn(() => Promise.reject(new Error("network is off limits")));
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => {
  vi.unstubAllGlobals();
  resetDirectoryForTests();
});

const names = (list: { name: string }[]) => list.map((e) => e.name);

describe("buildDirectory", () => {
  it("lists only the Featured artists on a fresh install", async () => {
    const dir = await buildDirectory(createCache());
    expect(dir).toHaveLength(FEATURED.length);
    expect(names(dir)).toEqual([...names(dir)].sort((a, b) => a.localeCompare(b, "en")));
  });

  it("adds viewed artists that have a stored name, sorted among the rest", async () => {
    const cache = createCache();
    await cache.recordViewed(A, "Zebra Band");
    await cache.recordViewed(B, "Aardvark");
    const dir = await buildDirectory(cache);
    expect(dir).toHaveLength(FEATURED.length + 2);
    expect(dir[0]).toEqual({ mbid: B, name: "Aardvark" });
    expect(dir.at(-1)).toEqual({ mbid: A, name: "Zebra Band" });
  });

  it("takes the name of an old entry from the cached MusicBrainz response", async () => {
    const cache = createCache();
    await cache.recordViewed(A); // recorded before names were stored
    await cache.mb.set(artistCacheKey(A), { notFound: false, value: { id: A, name: "Old Timer" } });
    const dir = await buildDirectory(cache);
    expect(dir).toContainEqual({ mbid: A, name: "Old Timer" });
  });

  it("skips an old entry whose response is no longer cached, without a request", async () => {
    const cache = createCache();
    await cache.recordViewed(A);
    await cache.mb.set(artistCacheKey(B), { notFound: true });
    await cache.recordViewed(B);
    const dir = await buildDirectory(cache);
    expect(dir).toHaveLength(FEATURED.length);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("uses the cache key that musicbrainz.server really writes", async () => {
    const cache = createCache();
    const mb = createMusicBrainz({
      cache: cache.mb,
      fetch: (async () =>
        new Response(JSON.stringify({ id: C, name: "Cached By The Client" }), {
          status: 200,
        })) as typeof fetch,
      minIntervalMs: 0,
    });
    await mb.getArtist(C);
    await cache.recordViewed(C); // nameless
    expect(await buildDirectory(cache)).toContainEqual({ mbid: C, name: "Cached By The Client" });
  });

  it("lets a Featured artist keep its Featured name and appear once", async () => {
    const cache = createCache();
    const featured = FEATURED[0]!;
    await cache.recordViewed(featured.mbid, "Different Name");
    const dir = await buildDirectory(cache);
    expect(dir.filter((e) => e.mbid === featured.mbid)).toEqual([
      { mbid: featured.mbid, name: featured.name },
    ]);
  });

  it("ignores stored ids that are not UUIDs", async () => {
    const cache = createCache();
    await cache.recordViewed("<script>", "Evil");
    expect(names(await buildDirectory(cache))).not.toContain("Evil");
  });

  it("never touches the network", async () => {
    const cache = createCache();
    await cache.recordViewed(A, "Zebra Band");
    await cache.recordViewed(B);
    await buildDirectory(cache);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("getDirectory", () => {
  it("reuses the list until it is older than the TTL", async () => {
    const cache = createCache();
    const list = vi.spyOn(cache, "listViewedWithNames");
    await getDirectory(cache, 1000);
    await getDirectory(cache, 1000 + DIRECTORY_TTL_MS - 1);
    expect(list).toHaveBeenCalledTimes(1);
    await getDirectory(cache, 1000 + DIRECTORY_TTL_MS);
    expect(list).toHaveBeenCalledTimes(2);
  });

  it("falls back to the Featured artists when the store breaks", async () => {
    const cache = createCache();
    vi.spyOn(cache, "listViewedWithNames").mockRejectedValue(new Error("disk"));
    expect(await getDirectory(cache)).toHaveLength(FEATURED.length);
  });
});
