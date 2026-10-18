import { describe, expect, it } from "vitest";
import { GROUPS, PLATFORM_LIST, artistLinks, classify, type Group } from "./platforms";
import { platformIcon } from "./platform-icons";
import type { Artist } from "./types";

const CASES: [url: string, platform: string, group: Group][] = [
  ["https://open.spotify.com/artist/abc", "Spotify", "Streaming"],
  ["https://music.apple.com/us/artist/x/1", "Apple Music", "Streaming"],
  ["https://itunes.apple.com/us/artist/x/1", "Apple Music", "Streaming"],
  ["https://podcasts.apple.com/us/podcast/x/id1", "Apple Podcasts", "Streaming"],
  ["https://music.amazon.com/artists/B000", "Amazon Music", "Streaming"],
  ["https://music.amazon.co.uk/artists/B000", "Amazon Music", "Streaming"],
  ["https://www.deezer.com/artist/1", "Deezer", "Streaming"],
  ["https://tidal.com/artist/1", "Tidal", "Streaming"],
  ["https://music.youtube.com/channel/UC1", "YouTube Music", "Streaming"],
  ["https://soundcloud.com/x", "SoundCloud", "Streaming"],
  ["https://x.bandcamp.com", "Bandcamp", "Streaming"],
  ["https://audiomack.com/x", "Audiomack", "Streaming"],
  ["https://www.beatport.com/artist/x/1", "Beatport", "Streaming"],
  ["https://www.beatstars.com/x", "Beatstars", "Streaming"],
  ["https://www.mixcloud.com/x/", "Mixcloud", "Streaming"],
  ["https://www.qobuz.com/us-en/interpreter/x/1", "Qobuz", "Streaming"],
  ["https://us.napster.com/artist/x", "Napster", "Streaming"],
  ["https://www.pandora.com/artist/x", "Pandora", "Streaming"],
  ["https://www.iheart.com/artist/x-1/", "iHeartRadio", "Streaming"],
  ["https://www.shazam.com/artist/x/1", "Shazam", "Streaming"],
  ["https://www.bandlab.com/x", "BandLab", "Streaming"],
  ["https://instagram.com/x", "Instagram", "Social"],
  ["https://x.com/x", "X / Twitter", "Social"],
  ["https://twitter.com/x", "X / Twitter", "Social"],
  ["https://mobile.twitter.com/x", "X / Twitter", "Social"],
  ["https://www.facebook.com/x", "Facebook", "Social"],
  ["https://www.tiktok.com/@x", "TikTok", "Social"],
  ["https://www.youtube.com/@x", "YouTube", "Social"],
  ["https://youtu.be/abc", "YouTube", "Social"],
  ["https://bsky.app/profile/x", "Bluesky", "Social"],
  ["https://www.threads.net/@x", "Threads", "Social"],
  ["https://www.twitch.tv/x", "Twitch", "Social"],
  ["https://kick.com/x", "Kick", "Social"],
  ["https://www.patreon.com/x", "Patreon", "Social"],
  ["https://ko-fi.com/x", "Ko-fi", "Social"],
  ["https://www.buymeacoffee.com/x", "Buy Me a Coffee", "Social"],
  ["https://linktr.ee/x", "Linktree", "Social"],
  ["https://vimeo.com/x", "Vimeo", "Social"],
  ["https://www.pinterest.com/x/", "Pinterest", "Social"],
  ["https://www.snapchat.com/add/x", "Snapchat", "Social"],
  ["https://t.me/x", "Telegram", "Social"],
  ["https://discord.gg/abc", "Discord", "Social"],
  ["https://mastodon.social/@x", "Mastodon", "Social"],
  ["https://www.reddit.com/r/x", "Reddit", "Social"],
  ["https://www.linkedin.com/in/x", "LinkedIn", "Social"],
  ["https://x.tumblr.com", "Tumblr", "Social"],
  ["https://x.substack.com", "Substack", "Social"],
  ["https://en.wikipedia.org/wiki/X", "Wikipedia", "Reference"],
  ["https://www.wikidata.org/wiki/Q1", "Wikidata", "Reference"],
  ["https://www.discogs.com/artist/1", "Discogs", "Reference"],
  ["https://www.allmusic.com/artist/x", "AllMusic", "Reference"],
  ["https://genius.com/artists/x", "Genius", "Reference"],
  ["https://www.last.fm/music/x", "Last.fm", "Reference"],
  ["https://www.imdb.com/name/nm1/", "IMDb", "Reference"],
  ["https://musicbrainz.org/artist/abc", "MusicBrainz", "Reference"],
  ["https://www.setlist.fm/setlists/x-1.html", "Setlist.fm", "Reference"],
  ["https://rateyourmusic.com/artist/x", "Rate Your Music", "Reference"],
  ["https://www.songfacts.com/artist/x", "Songfacts", "Reference"],
  ["https://www.bandsintown.com/a/1", "Bandsintown", "Other"],
  ["https://www.songkick.com/artists/1", "Songkick", "Other"],
  ["https://ra.co/dj/x", "Resident Advisor", "Other"],
  ["https://www.residentadvisor.net/dj/x", "Resident Advisor", "Other"],
  ["https://www.ticketmaster.com/x-tickets/artist/1", "Ticketmaster", "Other"],
];

describe("PLATFORM_LIST (feeds the /platforms page)", () => {
  it("has one entry per platform the cases above expect, none twice", () => {
    const names = PLATFORM_LIST.map((p) => p.name);
    expect(new Set(names).size).toBe(names.length);
    for (const [, platform] of CASES) expect(names).toContain(platform);
  });

  it("gives each platform an example link that is recognised as that platform", () => {
    for (const p of PLATFORM_LIST) {
      const url = `https://${p.example.replace(/<[^>]+>/g, "x")}`;
      expect(classify(url, "other"), p.example).toMatchObject({ platform: p.name, group: p.group });
    }
  });

  it("only uses groups that have a section on the artist page", () => {
    for (const p of PLATFORM_LIST) expect(GROUPS).toContain(p.group);
  });
});

describe("classify", () => {
  it.each(CASES)("%s -> %s (%s)", (url, platform, group) => {
    expect(classify(url, "other")).toEqual({ url, platform, group });
  });

  it("only uses known groups", () => {
    for (const [url] of CASES) expect(GROUPS).toContain(classify(url, "x").group);
  });

  it("is case-insensitive on the host via URL parsing", () => {
    expect(classify("https://WWW.INSTAGRAM.COM/x", "x").platform).toBe("Instagram");
  });

  it("matches music.youtube.com before youtube.com", () => {
    expect(classify("https://music.youtube.com/x", "x").platform).toBe("YouTube Music");
    expect(classify("https://www.youtube.com/x", "x").platform).toBe("YouTube");
  });

  it("does not match hosts that merely end in a platform's letters", () => {
    for (const url of [
      "https://box.com/x",
      "https://fox.com/x",
      "https://notspotify.com/x",
      "https://xtwitter.com/x",
      "https://fakeinstagram.com/x",
      "https://x.com.evil.org/x",
      "https://example.com/x.com",
    ])
      expect(classify(url, "x").group).toBe("Other");
  });

  it("falls back to Other with the host as the platform name", () => {
    expect(classify("https://www.example.org/page", "social network")).toEqual({
      url: "https://www.example.org/page",
      platform: "example.org",
      group: "Other",
    });
  });

  it("uses Official website for an unmatched 'official homepage'", () => {
    expect(classify("https://artist.example/", "official homepage")).toEqual({
      url: "https://artist.example/",
      platform: "Official website",
      group: "Official website",
    });
  });

  it("known platforms win over the official homepage fallback", () => {
    expect(classify("https://artist.bandcamp.com", "official homepage").platform).toBe("Bandcamp");
  });

  it("does not throw on an invalid URL and keeps the raw string", () => {
    expect(classify("not a url", "other")).toEqual({
      url: "not a url",
      platform: "not a url",
      group: "Other",
    });
    expect(classify("", "official homepage").group).toBe("Official website");
  });

  it("every classified platform with an icon resolves it", () => {
    const noIcon = new Set([
      "AllMusic",
      "Amazon Music",
      "Qobuz",
      "LinkedIn",
      "Resident Advisor",
      "Setlist.fm",
      "Rate Your Music",
      "Songfacts",
    ]);
    for (const [url, platform] of CASES) {
      if (noIcon.has(platform)) expect(platformIcon(platform)).toBeUndefined();
      else expect(platformIcon(platform), `${platform} (${url})`).toBeDefined();
    }
  });
});

describe("artistLinks", () => {
  const artist = (relations?: Artist["relations"]): Artist =>
    relations ? { id: "1", name: "A", relations } : { id: "1", name: "A" };

  it("returns [] when there are no relations", () => {
    expect(artistLinks(artist())).toEqual([]);
    expect(artistLinks(artist([]))).toEqual([]);
  });

  it("skips relations without a url", () => {
    const links = artistLinks(
      artist([
        { type: "member of band" },
        { type: "social network", url: { resource: "https://instagram.com/a" } },
        { type: "x", url: { resource: "" } },
      ]),
    );
    expect(links).toHaveLength(1);
    expect(links[0]?.platform).toBe("Instagram");
  });

  it("dedupes identical urls and orders by group, then platform A-Z", () => {
    const links = artistLinks(
      artist([
        { type: "social network", url: { resource: "https://instagram.com/a" } },
        { type: "streaming", url: { resource: "https://open.spotify.com/artist/1" } },
        { type: "social network", url: { resource: "https://instagram.com/a" } },
      ]),
    );
    expect(links.map((l) => l.platform)).toEqual(["Spotify", "Instagram"]);
  });

  it("sorts A-Z within each group", () => {
    const links = artistLinks(
      artist([
        { type: "x", url: { resource: "https://tidal.com/artist/1" } },
        { type: "x", url: { resource: "https://www.tiktok.com/@a" } },
        { type: "x", url: { resource: "https://open.spotify.com/artist/1" } },
        { type: "x", url: { resource: "https://instagram.com/a" } },
        { type: "x", url: { resource: "https://bandcamp.com/a" } },
        { type: "x", url: { resource: "https://en.wikipedia.org/wiki/A" } },
        { type: "x", url: { resource: "https://discogs.com/artist/1" } },
      ]),
    );
    expect(links.map((l) => l.platform)).toEqual([
      "Bandcamp",
      "Spotify",
      "Tidal",
      "Instagram",
      "TikTok",
      "Discogs",
      "Wikipedia",
    ]);
  });

  it("passes the relation type to classify", () => {
    const links = artistLinks(
      artist([{ type: "official homepage", url: { resource: "https://artist.example/" } }]),
    );
    expect(links[0]?.group).toBe("Official website");
  });
});
