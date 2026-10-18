import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BoundedMap,
  createCache,
  getAppCache,
  recordViewedIfLinked,
  resetAppCacheForTests,
  SITEMAP_MAX_URLS,
  VIEWED_TTL_MS,
} from "./cache.server";

const A = "11111111-2222-4333-8444-555555555555";
const B = "66666666-7777-4888-8999-000000000000";

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(1_000_000);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  resetAppCacheForTests();
});

describe("backend selection", () => {
  it("uses memory when the path is unset, empty or blank, without opening a file", async () => {
    const open = vi.fn();
    for (const path of [undefined, null, "", "   "]) {
      expect(await createCache({ path, open }).backend()).toBe("memory");
    }
    expect(open).not.toHaveBeenCalled();
  });

  it("uses SQLite when the file opens", async () => {
    const store = {
      get: async () => undefined,
      set: async () => true,
      delete: async () => true,
      clear: async () => undefined,
      async *iterator() {},
    };
    const open = vi.fn(async () => store);
    expect(await createCache({ path: "/data/cache.sqlite", open }).backend()).toBe("sqlite");
    expect(open).toHaveBeenCalledWith("/data/cache.sqlite");
  });

  it("warns and falls back to memory when the file cannot be opened", async () => {
    const warn = vi.fn();
    const cache = createCache({
      path: "/nope/cache.sqlite",
      open: async () => {
        throw new Error("SQLITE_CANTOPEN");
      },
      warn,
    });
    expect(await cache.backend()).toBe("memory");
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]![0]).toContain("/nope/cache.sqlite");
    // and it still works
    await cache.mb.set("k", { v: 1 });
    expect(await cache.mb.get("k")).toEqual({ v: 1 });
  });

  it("getAppCache reads CACHE_DB_PATH and falls back to memory for an unopenable path", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    vi.stubEnv("CACHE_DB_PATH", "/dev/null/cache.sqlite");
    resetAppCacheForTests();
    expect(await getAppCache().backend()).toBe("memory");
    expect(warn).toHaveBeenCalled();
  });

  it("getAppCache is in memory when CACHE_DB_PATH is empty", async () => {
    vi.stubEnv("CACHE_DB_PATH", "");
    resetAppCacheForTests();
    expect(await getAppCache().backend()).toBe("memory");
  });
});

describe("memory store", () => {
  it("expires entries by ttl", async () => {
    const cache = createCache();
    await cache.mb.set("k", "v", 1000);
    vi.setSystemTime(Date.now() + 999);
    expect(await cache.mb.get("k")).toBe("v");
    vi.setSystemTime(Date.now() + 2);
    expect(await cache.mb.get("k")).toBeUndefined();
  });

  it("evicts the least recently used entry past the limit", async () => {
    const cache = createCache({ maxMemoryEntries: 2 });
    await cache.mb.set("a", 1);
    await cache.mb.set("b", 2);
    await cache.mb.get("a");
    await cache.mb.set("c", 3);
    expect(await cache.mb.get("b")).toBeUndefined();
    expect(await cache.mb.get("a")).toBe(1);
    expect(await cache.mb.get("c")).toBe(3);
  });

  it("BoundedMap keeps at most max entries", () => {
    const m = new BoundedMap(1);
    m.set("a", "1").set("b", "2");
    expect([...m.keys()]).toEqual(["b"]);
  });
});

describe("viewed artists", () => {
  it("lists recorded artists, once each", async () => {
    const cache = createCache();
    await cache.recordViewed(A);
    await cache.recordViewed(B);
    await cache.recordViewed(A);
    expect(await cache.listViewed(10)).toEqual([A, B]);
  });

  it("stores the artist name with the id, and null for entries without one", async () => {
    const cache = createCache();
    await cache.recordViewed(A, "  Radiohead ");
    await cache.recordViewed(B); // recorded before names were stored, or without a name
    expect(await cache.listViewedWithNames(10)).toEqual([
      { mbid: A, name: "Radiohead" },
      { mbid: B, name: null },
    ]);
    expect(await cache.listViewed(10)).toEqual([A, B]);
  });

  it("treats a blank name like no name", async () => {
    const cache = createCache();
    await cache.recordViewed(A, "   ");
    expect(await cache.listViewedWithNames(5)).toEqual([{ mbid: A, name: null }]);
  });

  it("caps the stored name length", async () => {
    const cache = createCache();
    await cache.recordViewed(A, "x".repeat(500));
    expect((await cache.listViewedWithNames(1))[0]?.name).toHaveLength(200);
  });

  it("honours the max and returns nothing for max 0", async () => {
    const cache = createCache();
    await cache.recordViewed(A);
    await cache.recordViewed(B);
    expect(await cache.listViewed(1)).toHaveLength(1);
    expect(await cache.listViewed(0)).toEqual([]);
  });

  it("does not rewrite the same artist on every view", async () => {
    const cache = createCache();
    const set = vi.spyOn(Object.getPrototypeOf(cache.mb), "set");
    await cache.recordViewed(A);
    await cache.recordViewed(A);
    await cache.recordViewed(A);
    expect(set).toHaveBeenCalledTimes(1);
  });

  it("forgets artists not viewed for a year", async () => {
    const cache = createCache();
    await cache.recordViewed(A);
    vi.setSystemTime(Date.now() + VIEWED_TTL_MS + 1);
    expect(await cache.listViewed(10)).toEqual([]);
  });

  it("never throws, even when the store is broken", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const cache = createCache({
      path: "x",
      open: async () => ({
        get: async () => undefined,
        set: async () => {
          throw new Error("disk full");
        },
        delete: async () => true,
        clear: async () => undefined,
        // eslint-disable-next-line require-yield
        async *iterator() {
          throw new Error("disk I/O error");
        },
      }),
    });
    await expect(cache.recordViewed(A)).resolves.toBeUndefined();
    await expect(cache.listViewed(5)).resolves.toEqual([]);
  });

  it("the sitemap limit is the protocol's 50,000", () => {
    expect(SITEMAP_MAX_URLS).toBe(50_000);
  });
});

describe("recordViewedIfLinked", () => {
  const withLink = {
    id: A,
    name: "A",
    relations: [{ type: "official homepage", url: { resource: "https://example.com/" } }],
  };

  it("records an artist that has a link", async () => {
    const recordViewed = vi.fn(async () => {});
    await recordViewedIfLinked(withLink, { recordViewed });
    expect(recordViewed).toHaveBeenCalledWith(A, "A");
  });

  it("skips artists with no relations or only relations without a url", async () => {
    const recordViewed = vi.fn(async () => {});
    await recordViewedIfLinked({ id: A, name: "A" }, { recordViewed });
    await recordViewedIfLinked({ id: A, name: "A", relations: [] }, { recordViewed });
    await recordViewedIfLinked(
      { id: A, name: "A", relations: [{ type: "member of band" }] },
      { recordViewed },
    );
    expect(recordViewed).not.toHaveBeenCalled();
  });
});

describe("sweep", () => {
  it("removes expired rows and keeps live ones", async () => {
    const cache = createCache();
    await cache.mb.set("old", 1, 1000);
    await cache.mb.set("live", 2, 100_000);
    await cache.mb.set("forever", 3);
    await cache.recordViewed(A);
    vi.setSystemTime(Date.now() + 5000);
    expect(await cache.sweep()).toBe(1);
    expect(await cache.mb.get("live")).toBe(2);
    expect(await cache.mb.get("forever")).toBe(3);
    expect(await cache.listViewed(5)).toEqual([A]);
  });
});

// The real native addon, a real file: this is what the Docker image has to support.
describe("SQLite file", () => {
  let dir: string;
  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "artist-links-cache-"));
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it("persists responses and viewed artists across a restart, creating missing folders", async () => {
    const path = join(dir, "nested", "cache.sqlite");
    const first = createCache({ path });
    expect(await first.backend()).toBe("sqlite");
    const key = "/artist?query=it's%20a%20test&fmt=json&limit=5"; // quotes must not break the SQL
    await first.mb.set(key, { notFound: false, value: { name: "Guns N' Roses" } }, 60_000);
    await first.recordViewed(A);
    await first.recordViewed(B);

    const second = createCache({ path }); // a new process opening the same file
    expect(await second.backend()).toBe("sqlite");
    expect(await second.mb.get(key)).toEqual({ notFound: false, value: { name: "Guns N' Roses" } });
    expect(await second.listViewed(10)).toEqual([A, B]);
  });

  it("expires rows in the file and sweeps them away", async () => {
    const path = join(dir, "cache.sqlite");
    const cache = createCache({ path });
    for (let i = 0; i < 7; i++) await cache.mb.set(`gone${i}`, i, 1000); // more than one page of rows
    await cache.mb.set("kept", 1, 100_000);
    vi.setSystemTime(Date.now() + 5000);
    expect(await cache.sweep()).toBe(7);
    expect(await cache.sweep()).toBe(0);
    expect(await cache.mb.get("kept")).toBe(1);
  });

  it("falls back to memory when the folder cannot be created", async () => {
    const warn = vi.fn();
    writeFileSync(join(dir, "blocker"), "a file, not a folder");
    const cache = createCache({ path: join(dir, "blocker", "cache.sqlite"), warn });
    expect(await cache.backend()).toBe("memory");
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
