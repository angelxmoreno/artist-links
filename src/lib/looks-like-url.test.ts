import { describe, expect, it } from "vitest";
import { looksLikeUrl } from "./looks-like-url";

describe("looksLikeUrl", () => {
  it.each([
    "https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb",
    "http://example.com",
    "HTTPS://Example.com/x",
    "https://instagram.com/radiohead?hl=en",
    "open.spotify.com/artist/abc",
    "www.instagram.com/radiohead",
    "instagram.com/x",
    "foo.bandcamp.com",
    "foo.bandcamp.com/album/bar",
    "  https://x.com/a  ",
    "youtube.com/@artist",
    "music.apple.com/us/artist/radiohead/657515",
    "spoti.fi/abc",
    "localhost.dev:3000",
    "example.com:8080/path",
    "deadmau5.com",
  ])("is a URL: %s", (s) => {
    expect(looksLikeUrl(s)).toBe(true);
  });

  it.each([
    "",
    "   ",
    "Radiohead",
    "Mr. Brightside",
    "Mr.Brightside",
    "St.Vincent",
    "Jay.Z",
    "M.I.A.",
    "S.O.D.",
    "AC/DC",
    "blink-182",
    "Panic! At The Disco",
    "Sunn O)))",
    "the.the.the band",
    "spotify.com is great",
    "open.spotify.com /artist",
    "http://",
    "https:// foo",
    ".com",
    "a.",
    "Beyoncé",
    "Björk",
    "2Pac",
  ])("is not a URL: %j", (s) => {
    expect(looksLikeUrl(s)).toBe(false);
  });
});
