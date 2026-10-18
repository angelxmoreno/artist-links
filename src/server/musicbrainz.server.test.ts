import Keyv from "@keyvhq/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUSY_MESSAGE,
  createMusicBrainz,
  INVALID_LINK_MESSAGE,
  MAX_QUEUE_LENGTH,
  UNREACHABLE_MESSAGE,
  type MusicBrainzOptions,
} from "./musicbrainz.server";
import { createRateLimiter, limitHook, RATE_LIMITED_MESSAGE } from "./ratelimit";

const MBID = "11111111-2222-4333-8444-555555555555";

// keyvhq expires entries with Date.now(), so tests move the clock instead of passing `now`.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function setup(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
  o: MusicBrainzOptions = {},
) {
  const sleeps: number[] = [];
  const calls: { url: string; at: number; init?: RequestInit | undefined }[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), at: Date.now(), init });
    return handler(String(url), init);
  });
  const mb = createMusicBrainz({
    fetch: fetchMock as unknown as typeof fetch,
    sleep: async (ms) => {
      sleeps.push(ms);
      vi.setSystemTime(Date.now() + ms);
    },
    contact: "mailto:test@example.com",
    ...o,
  });
  return {
    mb,
    calls,
    sleeps,
    fetchMock,
    advance: (ms: number) => vi.setSystemTime(Date.now() + ms),
  };
}

describe("cache", () => {
  it("serves repeated requests from cache", async () => {
    const { mb, fetchMock } = setup(() => json({ id: MBID, name: "A" }));
    await mb.getArtist(MBID);
    await mb.getArtist(MBID);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("misses for different keys", async () => {
    const { mb, fetchMock } = setup(() => json({ artists: [] }));
    await mb.searchArtists("a");
    await mb.searchArtists("b");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("expires ok entries after 24h", async () => {
    const { mb, fetchMock, advance } = setup(() => json({ id: MBID, name: "A" }));
    await mb.getArtist(MBID);
    advance(24 * 3600_000 - 1);
    await mb.getArtist(MBID);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    advance(2);
    await mb.getArtist(MBID);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("expires notfound entries after 1h", async () => {
    const { mb, fetchMock, advance } = setup(() => new Response("", { status: 404 }));
    expect(await mb.getArtist(MBID)).toBeNull();
    advance(3600_000 - 1);
    expect(await mb.getArtist(MBID)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    advance(2);
    await mb.getArtist(MBID);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("evicts least recently used past the max", async () => {
    const { mb, fetchMock } = setup(() => json({ artists: [] }), { maxEntries: 2 });
    await mb.searchArtists("a");
    await mb.searchArtists("b");
    await mb.searchArtists("a"); // refresh a
    await mb.searchArtists("c"); // evicts b
    await mb.searchArtists("a");
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await mb.searchArtists("b");
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("does not cache errors", async () => {
    let fail = true;
    const { mb, fetchMock } = setup(() =>
      fail ? new Response("", { status: 500 }) : json({ id: MBID, name: "A" }),
    );
    await expect(mb.getArtist(MBID)).rejects.toThrow(UNREACHABLE_MESSAGE);
    fail = false;
    expect((await mb.getArtist(MBID))?.name).toBe("A");
    expect(fetchMock).toHaveBeenCalledTimes(3); // 2 failed attempts + 1 success
  });
});

describe("injected keyvhq cache", () => {
  it("stores parsed responses under the request path with the OK ttl", async () => {
    const cache = new Keyv({ namespace: "mb" });
    const { mb } = setup(() => json({ id: MBID, name: "A" }), { cache });
    await mb.getArtist(MBID);
    const key = `/artist/${MBID}?inc=url-rels&fmt=json`;
    expect(await cache.get(key, { raw: true })).toEqual({
      value: { value: { id: MBID, name: "A" }, notFound: false },
      expires: Date.now() + 24 * 3600_000,
    });
  });

  it("stores a remembered 404 with the shorter ttl", async () => {
    const cache = new Keyv({ namespace: "mb" });
    const { mb } = setup(() => new Response("", { status: 404 }), { cache });
    await mb.getArtist(MBID);
    const raw = await cache.get(`/artist/${MBID}?inc=url-rels&fmt=json`, { raw: true });
    expect(raw?.expires).toBe(Date.now() + 3600_000);
    expect(raw?.value).toEqual({ notFound: true });
  });

  it("a second client on the same store answers from it (survives a restart)", async () => {
    const cache = new Keyv({ namespace: "mb" });
    const first = setup(() => json({ id: MBID, name: "A" }), { cache });
    await first.mb.getArtist(MBID);
    const second = setup(() => json({ id: MBID, name: "changed" }), { cache });
    expect((await second.mb.getArtist(MBID))?.name).toBe("A");
    expect(second.fetchMock).not.toHaveBeenCalled();
  });

  it("cache hits skip beforeNetwork, so the rate limiter is bypassed", async () => {
    const cache = new Keyv({ namespace: "mb" });
    await setup(() => json({ id: MBID, name: "A" }), { cache }).mb.getArtist(MBID);
    const { mb } = setup(() => json({}), { cache });
    const hook = vi.fn(() => {
      throw new Error("denied");
    });
    await expect(mb.getArtist(MBID, { beforeNetwork: hook })).resolves.toMatchObject({ name: "A" });
    expect(hook).not.toHaveBeenCalled();
  });

  it("treats a failing store as a miss and still answers", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const broken = {
      get: async () => {
        throw new Error("disk I/O error");
      },
      set: async () => {
        throw new Error("disk full");
      },
      delete: async () => false,
      clear: async () => {},
    };
    const cache = new Keyv({ store: broken as never, namespace: "mb" });
    const { mb, fetchMock } = setup(() => json({ id: MBID, name: "A" }), { cache });
    expect((await mb.getArtist(MBID))?.name).toBe("A");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("in-flight dedupe", () => {
  it("does not refetch when a call arrives right after the first one finished", async () => {
    const { mb, fetchMock } = setup(() => json({ id: MBID, name: "A" }));
    const first = mb.getArtist(MBID);
    await first;
    await mb.getArtist(MBID);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("shares one request across concurrent identical calls", async () => {
    const { mb, fetchMock } = setup(() => json({ id: MBID, name: "A" }));
    const [a, b, c] = await Promise.all([
      mb.getArtist(MBID),
      mb.getArtist(MBID),
      mb.getArtist(MBID),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });
});

describe("queue", () => {
  it("spaces requests at least 1100ms apart", async () => {
    const { mb, calls } = setup(() => json({ artists: [] }));
    await Promise.all([mb.searchArtists("a"), mb.searchArtists("b"), mb.searchArtists("c")]);
    expect(calls).toHaveLength(3);
    expect(calls[1]!.at - calls[0]!.at).toBeGreaterThanOrEqual(1100);
    expect(calls[2]!.at - calls[1]!.at).toBeGreaterThanOrEqual(1100);
  });
});

describe("queue cap", () => {
  function gated(maxQueue: number) {
    let open!: () => void;
    const gate = new Promise<void>((r) => (open = r));
    const s = setup(
      async () => {
        await gate;
        return json({ artists: [] });
      },
      { maxQueue },
    );
    return { ...s, open };
  }

  it("rejects with a friendly busy error once the queue is full, without calling MusicBrainz", async () => {
    const { mb, fetchMock, open } = gated(2);
    const a = mb.searchArtists("a");
    const b = mb.searchArtists("b");
    await expect(mb.searchArtists("c")).rejects.toThrow(BUSY_MESSAGE);
    open();
    await Promise.all([a, b]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry or cache the rejection, and frees room as requests finish", async () => {
    const { mb, fetchMock, open } = gated(1);
    const a = mb.searchArtists("a");
    await expect(mb.searchArtists("c")).rejects.toThrow(BUSY_MESSAGE);
    open();
    await a;
    await expect(mb.searchArtists("c")).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("cache hits and in-flight joins are never refused", async () => {
    const { mb, fetchMock, open } = gated(1);
    const a = mb.searchArtists("a");
    const joined = mb.searchArtists("a"); // joins the in-flight request
    open();
    await Promise.all([a, joined]);
    await expect(mb.searchArtists("a")).resolves.toEqual([]); // cached
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("defaults to a bounded queue", async () => {
    const { mb, open } = gated(MAX_QUEUE_LENGTH);
    const ok = Array.from({ length: MAX_QUEUE_LENGTH }, (_, i) => mb.searchArtists(`q${i}`));
    await expect(mb.searchArtists("overflow")).rejects.toThrow(BUSY_MESSAGE);
    open();
    await Promise.all(ok);
  });
});

describe("beforeNetwork hook", () => {
  it("runs once per request that goes out, not for cache hits or in-flight joins", async () => {
    const { mb, fetchMock } = setup(() => json({ artists: [] }));
    const hook = vi.fn();
    await Promise.all([
      mb.searchArtists("a", { beforeNetwork: hook }),
      mb.searchArtists("a", { beforeNetwork: hook }),
    ]);
    await mb.searchArtists("a", { beforeNetwork: hook }); // cache hit
    expect(hook).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await mb.searchArtists("b", { beforeNetwork: hook });
    expect(hook).toHaveBeenCalledTimes(2);
  });

  it("a throwing hook blocks the request, is not cached and surfaces its error", async () => {
    const { mb, fetchMock } = setup(() => json({ artists: [] }));
    const deny = () => {
      throw new Error("denied");
    };
    await expect(mb.searchArtists("a", { beforeNetwork: deny })).rejects.toThrow("denied");
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(mb.searchArtists("a")).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("works through lookupByUrl and getArtist", async () => {
    const { mb } = setup(() => json({ id: MBID, name: "A", relations: [] }));
    const hook = vi.fn();
    await mb.getArtist(MBID, { beforeNetwork: hook });
    await mb.lookupByUrl("https://open.spotify.com/artist/abc", { beforeNetwork: hook });
    expect(hook.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("per-IP rate limit with the mb layer", () => {
  function limited() {
    const s = setup(() => json({ artists: [] }));
    let t = 5_000;
    const rl = createRateLimiter({ limit: 2, windowMs: 60_000, now: () => t });
    return { ...s, rl, advance: (ms: number) => (t += ms) };
  }

  it("enforces the limit on uncached requests only, per IP, with window expiry", async () => {
    const { mb, fetchMock, rl, advance } = limited();
    const ctx = (ip: string) => ({ beforeNetwork: limitHook(ip, rl) });

    await mb.searchArtists("a", ctx("1.1.1.1"));
    await mb.searchArtists("b", ctx("1.1.1.1"));
    await expect(mb.searchArtists("c", ctx("1.1.1.1"))).rejects.toThrow(RATE_LIMITED_MESSAGE);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // cache hits for the limited IP still work and do not count
    await expect(mb.searchArtists("a", ctx("1.1.1.1"))).resolves.toEqual([]);
    await expect(mb.searchArtists("b", ctx("1.1.1.1"))).resolves.toEqual([]);

    // a different IP is independent
    await expect(mb.searchArtists("c", ctx("2.2.2.2"))).resolves.toEqual([]);

    // after the window the first IP can go out again
    advance(60_000);
    await expect(mb.searchArtists("d", ctx("1.1.1.1"))).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe("request shape", () => {
  it("sends User-Agent with contact and Accept json", async () => {
    const { mb, calls } = setup(() => json({ id: MBID, name: "A" }));
    await mb.getArtist(MBID);
    const h = calls[0]!.init?.headers as Record<string, string>;
    expect(h["User-Agent"]).toBe("ArtistLinks/0.1 ( mailto:test@example.com )");
    expect(h["Accept"]).toBe("application/json");
    expect(calls[0]!.url).toBe(`https://musicbrainz.org/ws/2/artist/${MBID}?inc=url-rels&fmt=json`);
  });

  it("defaults the contact to the repo URL", () => {
    const mb = createMusicBrainz({ contact: undefined, fetch: vi.fn() as never });
    expect(mb.userAgent).toMatch(/^ArtistLinks\/0\.1 \( .+ \)$/);
  });
});

describe("errors and retry", () => {
  it("404 -> getArtist null", async () => {
    const { mb, fetchMock } = setup(() => new Response("", { status: 404 }));
    expect(await mb.getArtist(MBID)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once after 2s on 503", async () => {
    let n = 0;
    const { mb, fetchMock, sleeps } = setup(() =>
      n++ === 0 ? new Response("", { status: 503 }) : json({ id: MBID, name: "A" }),
    );
    expect((await mb.getArtist(MBID))?.name).toBe("A");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleeps).toContain(2000);
  });

  it("retries once on network error then gives a user-safe message", async () => {
    const { mb, fetchMock } = setup(() => {
      throw new TypeError("fetch failed");
    });
    await expect(mb.getArtist(MBID)).rejects.toThrow(UNREACHABLE_MESSAGE);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("503 twice fails", async () => {
    const { mb, fetchMock } = setup(() => new Response("", { status: 503 }));
    await expect(mb.getArtist(MBID)).rejects.toThrow(UNREACHABLE_MESSAGE);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("getArtist / searchArtists validation", () => {
  it("returns null for non-UUID without fetching", async () => {
    const { mb, fetchMock } = setup(() => json({}));
    expect(await mb.getArtist("not-a-uuid")).toBeNull();
    expect(await mb.getArtist("../../x")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects empty and too-long queries, trims and limits", async () => {
    const { mb, calls } = setup(() =>
      json({ artists: Array.from({ length: 8 }, (_, i) => ({ id: String(i), name: "x" })) }),
    );
    await expect(mb.searchArtists("   ")).rejects.toThrow();
    await expect(mb.searchArtists("x".repeat(101))).rejects.toThrow();
    expect(calls).toHaveLength(0);
    const res = await mb.searchArtists("  Daft Punk ");
    expect(res).toHaveLength(5);
    expect(calls[0]!.url).toBe(
      "https://musicbrainz.org/ws/2/artist?query=Daft%20Punk&fmt=json&limit=5",
    );
  });
});

describe("lookupByUrl", () => {
  it("found", async () => {
    const { mb, calls } = setup(() =>
      json({ relations: [{ "target-type": "artist", artist: { id: MBID } }] }),
    );
    expect(await mb.lookupByUrl("open.spotify.com/artist/abc")).toEqual({
      status: "found",
      mbid: MBID,
    });
    expect(calls[0]!.url).toContain(
      "/url?resource=" + encodeURIComponent("https://open.spotify.com/artist/abc"),
    );
  });

  it("notfound after trying all variants", async () => {
    const { mb, fetchMock } = setup(() => new Response("", { status: 404 }));
    expect(await mb.lookupByUrl("https://example.com/artist/abc")).toEqual({ status: "notfound" });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("notfound when url has no artist relation", async () => {
    const { mb } = setup(() => json({ relations: [] }));
    expect(await mb.lookupByUrl("https://example.com/a")).toEqual({ status: "notfound" });
  });

  it("unsupported for track URLs, without fetching", async () => {
    const { mb, fetchMock } = setup(() => json({}));
    expect(await mb.lookupByUrl("https://open.spotify.com/track/abc")).toEqual({
      status: "unsupported",
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("invalid URL throws a friendly error", async () => {
    const { mb } = setup(() => json({}));
    await expect(mb.lookupByUrl("http://")).rejects.toThrow(INVALID_LINK_MESSAGE);
  });
});
