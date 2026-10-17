import { describe, expect, it } from "vitest";
import { UnsupportedUrl, normalizeUrl, urlVariants } from "./links";

describe("normalizeUrl", () => {
  it("adds https when the scheme is missing", () => {
    expect(normalizeUrl("instagram.com/foo").href).toBe("https://instagram.com/foo");
  });

  it("upgrades http to https and trims whitespace", () => {
    expect(normalizeUrl("  http://instagram.com/foo  ").href).toBe("https://instagram.com/foo");
  });

  it("lowercases the host and strips www. and m.", () => {
    expect(normalizeUrl("https://WWW.Instagram.com/foo").hostname).toBe("instagram.com");
    expect(normalizeUrl("https://m.facebook.com/foo").hostname).toBe("facebook.com");
  });

  it("strips query string and hash", () => {
    expect(normalizeUrl("https://open.spotify.com/artist/abc?si=xyz#frag").href).toBe(
      "https://open.spotify.com/artist/abc",
    );
  });

  it("removes the Spotify intl-xx path prefix", () => {
    expect(normalizeUrl("https://open.spotify.com/intl-es/artist/abc").pathname).toBe(
      "/artist/abc",
    );
    expect(normalizeUrl("https://open.spotify.com/intl-pt-br/artist/abc").pathname).toBe(
      "/artist/abc",
    );
  });

  it("keeps intl-xx on other hosts", () => {
    expect(normalizeUrl("https://example.com/intl-es/artist/abc").pathname).toBe(
      "/intl-es/artist/abc",
    );
  });

  it("still rejects a Spotify track behind an intl prefix", () => {
    expect(() => normalizeUrl("https://open.spotify.com/intl-de/track/abc")).toThrow(
      UnsupportedUrl,
    );
  });

  it.each(["track", "album", "playlist", "episode", "show"])(
    "throws UnsupportedUrl for /%s/ paths",
    (kind) => {
      expect(() => normalizeUrl(`https://open.spotify.com/${kind}/abc123`)).toThrow(UnsupportedUrl);
    },
  );

  it("throws UnsupportedUrl for bare /watch and /playlist", () => {
    expect(() => normalizeUrl("https://youtube.com/watch?v=abc")).toThrow(UnsupportedUrl);
    expect(() => normalizeUrl("https://youtube.com/playlist?list=abc")).toThrow(UnsupportedUrl);
  });

  it("throws UnsupportedUrl for bandcamp tracks and albums", () => {
    expect(() => normalizeUrl("https://artist.bandcamp.com/track/song")).toThrow(UnsupportedUrl);
    expect(() => normalizeUrl("https://artist.bandcamp.com/album/record")).toThrow(UnsupportedUrl);
  });

  it("accepts a bandcamp artist root", () => {
    expect(normalizeUrl("https://artist.bandcamp.com").href).toBe("https://artist.bandcamp.com/");
  });

  it("throws UnsupportedUrl for soundcloud sets, accepts profiles", () => {
    expect(() => normalizeUrl("https://soundcloud.com/artist/sets/mix")).toThrow(UnsupportedUrl);
    expect(normalizeUrl("https://soundcloud.com/artist").pathname).toBe("/artist");
  });

  it("throws UnsupportedUrl for apple music album, song and playlist", () => {
    for (const k of ["album", "song", "playlist"])
      expect(() => normalizeUrl(`https://music.apple.com/us/${k}/name/123`)).toThrow(
        UnsupportedUrl,
      );
  });

  it("accepts an apple music artist page", () => {
    expect(normalizeUrl("https://music.apple.com/us/artist/name/123").pathname).toBe(
      "/us/artist/name/123",
    );
  });

  it("throws UnsupportedUrl for instagram posts and reels, accepts profiles", () => {
    expect(() => normalizeUrl("https://www.instagram.com/p/abc/")).toThrow(UnsupportedUrl);
    expect(() => normalizeUrl("https://instagram.com/reel/abc/")).toThrow(UnsupportedUrl);
    expect(normalizeUrl("https://instagram.com/artist/").pathname).toBe("/artist/");
  });

  it("throws on garbage input", () => {
    expect(() => normalizeUrl("not a url")).toThrow(TypeError);
    expect(() => normalizeUrl("")).toThrow(TypeError);
    expect(() => normalizeUrl("   ")).toThrow(TypeError);
  });

  it("UnsupportedUrl is an Error", () => {
    expect(new UnsupportedUrl("x")).toBeInstanceOf(Error);
  });
});

describe("urlVariants", () => {
  it("returns 4 variants for a path URL: host/www x path/trailing slash", () => {
    expect(urlVariants(new URL("https://instagram.com/foo"))).toEqual([
      "https://instagram.com/foo",
      "https://instagram.com/foo/",
      "https://www.instagram.com/foo",
      "https://www.instagram.com/foo/",
    ]);
  });

  it("treats a trailing slash the same as none", () => {
    expect(urlVariants(new URL("https://instagram.com/foo/"))).toEqual(
      urlVariants(new URL("https://instagram.com/foo")),
    );
    expect(urlVariants(new URL("https://instagram.com/foo///"))).toHaveLength(4);
  });

  it("dedupes the root path", () => {
    expect(urlVariants(new URL("https://artist.bandcamp.com/"))).toEqual([
      "https://artist.bandcamp.com/",
      "https://www.artist.bandcamp.com/",
    ]);
  });

  it("does not produce www.www. when given a www host", () => {
    const v = urlVariants(new URL("https://www.instagram.com/foo"));
    expect(v).toHaveLength(4);
    expect(v.some((s) => s.includes("www.www."))).toBe(false);
  });

  it("has no duplicates and all entries are https", () => {
    const v = urlVariants(new URL("https://open.spotify.com/artist/abc"));
    expect(new Set(v).size).toBe(v.length);
    expect(v.every((s) => s.startsWith("https://"))).toBe(true);
  });
});
