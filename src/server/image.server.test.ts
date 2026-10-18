import Keyv from "@keyvhq/core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createImageLookup,
  LookupFailed,
  NO_PHOTO_TTL_MS,
  p18FileName,
  photoFromImageInfo,
  PHOTO_TTL_MS,
  wikidataQid,
  type ImageLookupOptions,
} from "./image.server";

// keyvhq expires entries with Date.now(), so tests move the clock (as musicbrainz.server.test.ts).
beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const wd = (qid: string) => ({
  relations: [{ type: "wikidata", url: { resource: `https://www.wikidata.org/wiki/${qid}` } }],
});

const claims = (file: string, rank = "normal") => ({
  claims: {
    P18: [
      {
        rank,
        mainsnak: { snaktype: "value", datavalue: { value: file, type: "string" } },
      },
    ],
  },
});

const THUMB =
  "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/Radiohead.jpg/1280px-Radiohead.jpg?utm_source=commons.wikimedia.org";
const imageInfo = (over: Record<string, unknown> = {}) => ({
  query: {
    pages: [
      {
        title: "File:Radiohead.jpg",
        imageinfo: [
          {
            width: 5940,
            height: 2160,
            thumburl: THUMB,
            thumbwidth: 1200,
            url: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Radiohead.jpg",
            descriptionurl: "https://commons.wikimedia.org/wiki/File:Radiohead.jpg",
            ...over,
          },
        ],
      },
    ],
  },
});

const EXPECTED = {
  thumbUrl:
    "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/Radiohead.jpg/250px-Radiohead.jpg?utm_source=commons.wikimedia.org",
  ogUrl: THUMB,
  pageUrl: "https://commons.wikimedia.org/wiki/File:Radiohead.jpg",
  ogWidth: 1280,
  ogHeight: 465,
};

/** Routes by host: Wikidata gets `wikidata`, Commons gets `commons`. */
function setup(
  wikidata: () => Response | Promise<Response>,
  commons: () => Response | Promise<Response>,
  o: ImageLookupOptions = {},
) {
  const calls: { url: string; init?: RequestInit | undefined }[] = [];
  const fetchMock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init });
    return String(url).startsWith("https://www.wikidata.org/") ? wikidata() : commons();
  });
  const cache = new Keyv({ namespace: "mb" });
  const lookup = createImageLookup({
    fetch: fetchMock as unknown as typeof fetch,
    contact: "mailto:test@example.com",
    cache,
    ...o,
  });
  return { lookup, calls, fetchMock, cache };
}

describe("wikidataQid", () => {
  it("reads the QID from the wikidata relation", () => {
    expect(wikidataQid(wd("Q44190"))).toBe("Q44190");
    expect(
      wikidataQid({
        relations: [
          { type: "official homepage", url: { resource: "https://radiohead.com/" } },
          { type: "wikidata", url: { resource: "http://wikidata.org/entity/q44190/" } },
        ],
      }),
    ).toBe("Q44190");
  });

  it("is null without a wikidata relation", () => {
    expect(wikidataQid({})).toBeNull();
    expect(wikidataQid({ relations: [] })).toBeNull();
    expect(
      wikidataQid({ relations: [{ type: "wikipedia", url: { resource: "https://x/wiki/Q1" } }] }),
    ).toBeNull();
  });

  it("is null for malformed relations", () => {
    for (const resource of [
      "https://www.wikidata.org/wiki/Special:Search",
      "https://www.wikidata.org/wiki/Q",
      "https://www.wikidata.org/wiki/Q0",
      "https://www.wikidata.org/wiki/Q12abc",
      "https://evil.example/wiki/Q123",
      "not a url",
    ]) {
      expect(wikidataQid({ relations: [{ type: "wikidata", url: { resource } }] })).toBeNull();
    }
    expect(wikidataQid({ relations: [{ type: "wikidata" }] })).toBeNull();
    expect(wikidataQid({ relations: "nope" } as never)).toBeNull();
    expect(wikidataQid(null as never)).toBeNull();
  });
});

describe("p18FileName / photoFromImageInfo", () => {
  it("prefers the preferred rank and skips deprecated claims", () => {
    const data = {
      claims: {
        P18: [
          { rank: "deprecated", mainsnak: { snaktype: "value", datavalue: { value: "Old.jpg" } } },
          { rank: "normal", mainsnak: { snaktype: "value", datavalue: { value: "Normal.jpg" } } },
          { rank: "preferred", mainsnak: { snaktype: "value", datavalue: { value: "Best.jpg" } } },
        ],
      },
    };
    expect(p18FileName(data)).toBe("Best.jpg");
    expect(p18FileName(claims("Only.jpg", "deprecated"))).toBeNull();
  });

  it("is null without P18 and throws on malformed data", () => {
    expect(p18FileName({ claims: {} })).toBeNull();
    expect(() => p18FileName(null)).toThrow(LookupFailed);
    expect(() => p18FileName({ error: { code: "no-such-entity" } })).toThrow(LookupFailed);
    expect(() => p18FileName({ claims: { P18: "x" } })).toThrow(LookupFailed);
  });

  it("builds the photo with a derived avatar URL and the real width", () => {
    expect(photoFromImageInfo(imageInfo())).toEqual(EXPECTED);
  });

  it("uses the original file when no resized thumbnail exists", () => {
    const photo = photoFromImageInfo(imageInfo({ thumburl: undefined, width: 600, height: 400 }));
    expect(photo).toEqual({
      thumbUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Radiohead.jpg",
      ogUrl: "https://upload.wikimedia.org/wikipedia/commons/a/a1/Radiohead.jpg",
      pageUrl: EXPECTED.pageUrl,
      ogWidth: 600,
      ogHeight: 400,
    });
  });

  it("returns null for a missing file and rejects bad shapes or foreign hosts", () => {
    expect(
      photoFromImageInfo({ query: { pages: [{ title: "File:X", missing: true }] } }),
    ).toBeNull();
    expect(() => photoFromImageInfo({})).toThrow(LookupFailed);
    expect(() => photoFromImageInfo({ query: { pages: [{ title: "File:X" }] } })).toThrow(
      LookupFailed,
    );
    expect(() =>
      photoFromImageInfo(imageInfo({ thumburl: "https://evil.example/a.jpg", url: "x" })),
    ).toThrow(LookupFailed);
    expect(() =>
      photoFromImageInfo(imageInfo({ descriptionurl: "https://evil.example/x" })),
    ).toThrow(LookupFailed);
    expect(() => photoFromImageInfo(imageInfo({ width: undefined }))).toThrow(LookupFailed);
  });
});

describe("getArtistPhoto", () => {
  it("looks up Wikidata then Commons and returns the photo", async () => {
    const { lookup, calls } = setup(
      () => json(claims("Radiohead.jpg")),
      () => json(imageInfo()),
    );
    await expect(lookup.getArtistPhoto(wd("Q44190"))).resolves.toEqual(EXPECTED);
    expect(calls).toHaveLength(2);
    const w = new URL(calls[0]!.url);
    expect(w.origin + w.pathname).toBe("https://www.wikidata.org/w/api.php");
    expect(Object.fromEntries(w.searchParams)).toMatchObject({
      action: "wbgetclaims",
      entity: "Q44190",
      property: "P18",
      format: "json",
    });
    const c = new URL(calls[1]!.url);
    expect(c.origin).toBe("https://commons.wikimedia.org");
    expect(c.searchParams.get("titles")).toBe("File:Radiohead.jpg");
    expect(c.searchParams.get("iiurlwidth")).toBe("1200");
    expect(c.searchParams.get("prop")).toBe("imageinfo");
    for (const call of calls) {
      expect((call.init?.headers as Record<string, string>)["User-Agent"]).toBe(
        "ArtistLinks/0.1 ( mailto:test@example.com )",
      );
    }
  });

  it("does no request for an artist without a wikidata link", async () => {
    const { lookup, fetchMock } = setup(
      () => json({}),
      () => json({}),
    );
    await expect(lookup.getArtistPhoto({ relations: [] })).resolves.toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when the entity has no P18, without asking Commons", async () => {
    const { lookup, calls } = setup(
      () => json({ claims: {} }),
      () => json(imageInfo()),
    );
    await expect(lookup.getArtistPhoto(wd("Q1"))).resolves.toBeNull();
    expect(calls).toHaveLength(1);
  });

  it.each([
    ["Wikidata HTTP error", () => json({}, 503), () => json(imageInfo())],
    ["Commons HTTP error", () => json(claims("A.jpg")), () => json({}, 500)],
    [
      "Wikidata malformed JSON",
      () => new Response("<html>oops", { status: 200 }),
      () => json(imageInfo()),
    ],
    [
      "Commons malformed JSON",
      () => json(claims("A.jpg")),
      () => new Response("nope", { status: 200 }),
    ],
    ["Commons unexpected shape", () => json(claims("A.jpg")), () => json({ query: {} })],
    [
      "Wikidata error body",
      () => json({ error: { code: "no-such-entity" } }),
      () => json(imageInfo()),
    ],
  ])("returns null on %s", async (_name, wikidata, commons) => {
    const { lookup } = setup(wikidata, commons);
    await expect(lookup.getArtistPhoto(wd("Q1"))).resolves.toBeNull();
  });

  it("returns null when fetch itself rejects", async () => {
    const { lookup } = setup(
      () => {
        throw new TypeError("network down");
      },
      () => json(imageInfo()),
    );
    await expect(lookup.getArtistPhoto(wd("Q1"))).resolves.toBeNull();
  });

  it("gives up at the deadline even when fetch ignores the abort signal", async () => {
    vi.useRealTimers(); // a real, short deadline
    const { lookup } = setup(
      () => new Promise<Response>(() => {}),
      () => json(imageInfo()),
      { timeoutMs: 30 },
    );
    const started = performance.now();
    await expect(lookup.getArtistPhoto(wd("Q1"))).resolves.toBeNull();
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("passes an abort signal to fetch", async () => {
    const { lookup, calls } = setup(
      () => json(claims("A.jpg")),
      () => json(imageInfo()),
    );
    await lookup.getArtistPhoto(wd("Q1"));
    expect(calls[0]!.init?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("caching", () => {
  const ok = () =>
    setup(
      () => json(claims("Radiohead.jpg")),
      () => json(imageInfo()),
    );

  it("serves a photo from the cache for 7 days", async () => {
    const { lookup, fetchMock } = ok();
    await lookup.getArtistPhoto(wd("Q44190"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.setSystemTime(Date.now() + PHOTO_TTL_MS - 1000);
    await expect(lookup.getArtistPhoto(wd("Q44190"))).resolves.toEqual(EXPECTED);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    vi.setSystemTime(Date.now() + 2000);
    await lookup.getArtistPhoto(wd("Q44190"));
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("remembers 'no image' for 1 day", async () => {
    const { lookup, fetchMock } = setup(
      () => json({ claims: {} }),
      () => json(imageInfo()),
    );
    await expect(lookup.getArtistPhoto(wd("Q7"))).resolves.toBeNull();
    await expect(lookup.getArtistPhoto(wd("Q7"))).resolves.toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    vi.setSystemTime(Date.now() + NO_PHOTO_TTL_MS + 1000);
    await lookup.getArtistPhoto(wd("Q7"));
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("also remembers a Commons file that does not exist", async () => {
    const { lookup, fetchMock } = setup(
      () => json(claims("Gone.jpg")),
      () => json({ query: { pages: [{ title: "File:Gone.jpg", missing: true }] } }),
    );
    await lookup.getArtistPhoto(wd("Q8"));
    await lookup.getArtistPhoto(wd("Q8"));
    expect(fetchMock).toHaveBeenCalledTimes(2); // one pair of requests, then the cache
  });

  it("does not cache failures", async () => {
    let failing = true;
    const { lookup, fetchMock, cache } = setup(
      () => (failing ? json({}, 503) : json(claims("Radiohead.jpg"))),
      () => json(imageInfo()),
    );
    await expect(lookup.getArtistPhoto(wd("Q44190"))).resolves.toBeNull();
    expect(await cache.get("img:Q44190")).toBeUndefined();
    failing = false;
    await expect(lookup.getArtistPhoto(wd("Q44190"))).resolves.toEqual(EXPECTED);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("ignores a corrupt cache entry and keeps working when the cache throws", async () => {
    const { lookup, cache } = ok();
    await cache.set("img:Q44190", { photo: "garbage" });
    await expect(lookup.getArtistPhoto(wd("Q44190"))).resolves.toEqual(EXPECTED);

    const broken = new Keyv({ namespace: "mb" });
    vi.spyOn(broken, "get").mockRejectedValue(new Error("disk"));
    vi.spyOn(broken, "set").mockRejectedValue(new Error("disk"));
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const again = setup(
      () => json(claims("Radiohead.jpg")),
      () => json(imageInfo()),
      {
        cache: broken,
      },
    );
    await expect(again.lookup.getArtistPhoto(wd("Q44190"))).resolves.toEqual(EXPECTED);
  });

  it("de-duplicates concurrent lookups of the same artist", async () => {
    const { lookup, fetchMock } = ok();
    const results = await Promise.all([
      lookup.getArtistPhoto(wd("Q44190")),
      lookup.getArtistPhoto(wd("Q44190")),
      lookup.getArtistPhoto(wd("Q44190")),
    ]);
    expect(results).toEqual([EXPECTED, EXPECTED, EXPECTED]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
