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

const getArtistPhoto = vi.fn();
vi.mock("@/server/image.server", () => ({
  getArtistPhoto: (...a: unknown[]) => getArtistPhoto(...a),
}));

import { fetchArtistPhoto } from "@/lib/api";
import type { ArtistPhoto } from "@/lib/api-types";

const MBID = "11111111-2222-4333-8444-555555555555";
const artist = {
  id: MBID,
  name: "A",
  relations: [{ type: "wikidata", url: { resource: "https://www.wikidata.org/wiki/Q1" } }],
};
const photo: ArtistPhoto = {
  thumbUrl: "https://thumb.wikimedia.org/a/250px-a.jpg",
  ogUrl: "https://thumb.wikimedia.org/a/1280px-a.jpg",
  pageUrl: "https://commons.wikimedia.org/wiki/File:a.jpg",
  ogWidth: 1280,
  ogHeight: 700,
};

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  vi.restoreAllMocks();
  getArtist.mockReset();
  getArtistPhoto.mockReset();
});

describe("fetchArtistPhoto", () => {
  it("returns the photo for the artist", async () => {
    getArtist.mockResolvedValue(artist);
    getArtistPhoto.mockResolvedValue(photo);
    await expect(fetchArtistPhoto({ data: { mbid: MBID } })).resolves.toEqual(photo);
    expect(getArtistPhoto).toHaveBeenCalledWith(artist);
  });

  it("returns null for an unknown artist", async () => {
    getArtist.mockResolvedValue(null);
    await expect(fetchArtistPhoto({ data: { mbid: MBID } })).resolves.toBeNull();
    expect(getArtistPhoto).not.toHaveBeenCalled();
  });

  it("never throws: MusicBrainz or the lookup failing means no photo", async () => {
    getArtist.mockRejectedValue(new Error("boom"));
    await expect(fetchArtistPhoto({ data: { mbid: MBID } })).resolves.toBeNull();
    getArtist.mockResolvedValue(artist);
    getArtistPhoto.mockRejectedValue(new Error("boom"));
    await expect(fetchArtistPhoto({ data: { mbid: MBID } })).resolves.toBeNull();
  });
});
