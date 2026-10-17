import { describe, expect, it, vi } from "vitest";
import {
  createMusicBrainz,
  INVALID_LINK_MESSAGE,
  UNREACHABLE_MESSAGE,
  type MusicBrainzOptions,
} from "./musicbrainz.server";

const MBID = "11111111-2222-4333-8444-555555555555";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function setup(
  handler: (url: string, init?: RequestInit) => Response | Promise<Response>,
  o: MusicBrainzOptions = {},
) {
  let t = 1_000_000;
  const sleeps: number[] = [];
  const calls: { url: string; at: number; init?: RequestInit | undefined }[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), at: t, init });
    return handler(String(url), init);
  });
  const mb = createMusicBrainz({
    fetch: fetchMock as unknown as typeof fetch,
    now: () => t,
    sleep: async (ms) => {
      sleeps.push(ms);
      t += ms;
    },
    contact: "mailto:test@example.com",
    ...o,
  });
  return { mb, calls, sleeps, fetchMock, advance: (ms: number) => (t += ms) };
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
    expect(mb.cacheSize()).toBe(2);
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

describe("in-flight dedupe", () => {
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
