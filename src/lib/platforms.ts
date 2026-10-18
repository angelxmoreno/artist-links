import type { Artist } from "./types";

export type Group = "Streaming" | "Social" | "Reference" | "Official website" | "Other";
export const GROUPS: Group[] = ["Streaming", "Social", "Reference", "Official website", "Other"];

/** Matches `domain` itself or any subdomain of it (never "box.com" for "x.com"). */
const onDomain = (...domains: string[]): RegExp =>
  new RegExp(`(^|\\.)(${domains.map((d) => d.replace(/\./g, "\\.")).join("|")})$`);

// Matched against the hostname (lowercased, "www." stripped). First match wins,
// so more specific hosts (music.youtube.com) must come before broader ones (youtube.com).
// The fourth entry is an example link pattern (no scheme) shown on the /platforms page; a test
// checks that each pattern is recognised as its own platform.
const PLATFORMS: [RegExp, string, Group, string][] = [
  // Streaming and stores
  [onDomain("spotify.com", "spoti.fi"), "Spotify", "Streaming", "open.spotify.com/artist/<id>"],
  [
    onDomain("music.apple.com", "itunes.apple.com"),
    "Apple Music",
    "Streaming",
    "music.apple.com/us/artist/<name>/<id>",
  ],
  [
    onDomain("podcasts.apple.com"),
    "Apple Podcasts",
    "Streaming",
    "podcasts.apple.com/us/podcast/<name>/id<id>",
  ],
  [/^music\.amazon\.[a-z.]+$/, "Amazon Music", "Streaming", "music.amazon.com/artists/<id>"],
  [onDomain("deezer.com", "deezer.page.link"), "Deezer", "Streaming", "deezer.com/artist/<id>"],
  [onDomain("tidal.com"), "Tidal", "Streaming", "tidal.com/artist/<id>"],
  [onDomain("music.youtube.com"), "YouTube Music", "Streaming", "music.youtube.com/channel/<id>"],
  [onDomain("soundcloud.com"), "SoundCloud", "Streaming", "soundcloud.com/<name>"],
  [onDomain("bandcamp.com"), "Bandcamp", "Streaming", "<name>.bandcamp.com"],
  [onDomain("audiomack.com"), "Audiomack", "Streaming", "audiomack.com/<name>"],
  [onDomain("beatport.com"), "Beatport", "Streaming", "beatport.com/artist/<name>/<id>"],
  [onDomain("beatstars.com"), "Beatstars", "Streaming", "beatstars.com/<name>"],
  [onDomain("mixcloud.com"), "Mixcloud", "Streaming", "mixcloud.com/<name>"],
  [onDomain("qobuz.com"), "Qobuz", "Streaming", "qobuz.com/us-en/interpreter/<name>/<id>"],
  [onDomain("napster.com"), "Napster", "Streaming", "napster.com/artist/<name>"],
  [onDomain("pandora.com"), "Pandora", "Streaming", "pandora.com/artist/<name>"],
  [onDomain("iheart.com"), "iHeartRadio", "Streaming", "iheart.com/artist/<name>-<id>"],
  [onDomain("shazam.com"), "Shazam", "Streaming", "shazam.com/artist/<name>/<id>"],
  [onDomain("bandlab.com"), "BandLab", "Streaming", "bandlab.com/<name>"],
  // Social
  [onDomain("instagram.com"), "Instagram", "Social", "instagram.com/<name>"],
  [onDomain("x.com", "twitter.com"), "X / Twitter", "Social", "x.com/<name>"],
  [
    onDomain("facebook.com", "fb.com", "fb.me", "fb.watch"),
    "Facebook",
    "Social",
    "facebook.com/<name>",
  ],
  [onDomain("tiktok.com"), "TikTok", "Social", "tiktok.com/@<name>"],
  [onDomain("youtube.com", "youtu.be"), "YouTube", "Social", "youtube.com/@<name>"],
  [onDomain("bsky.app"), "Bluesky", "Social", "bsky.app/profile/<name>"],
  [onDomain("threads.net", "threads.com"), "Threads", "Social", "threads.net/@<name>"],
  [onDomain("twitch.tv"), "Twitch", "Social", "twitch.tv/<name>"],
  [onDomain("kick.com"), "Kick", "Social", "kick.com/<name>"],
  [onDomain("patreon.com"), "Patreon", "Social", "patreon.com/<name>"],
  [onDomain("ko-fi.com"), "Ko-fi", "Social", "ko-fi.com/<name>"],
  [onDomain("buymeacoffee.com"), "Buy Me a Coffee", "Social", "buymeacoffee.com/<name>"],
  [onDomain("linktr.ee", "linktree.com"), "Linktree", "Social", "linktr.ee/<name>"],
  [onDomain("vimeo.com"), "Vimeo", "Social", "vimeo.com/<name>"],
  [onDomain("pinterest.com", "pin.it"), "Pinterest", "Social", "pinterest.com/<name>"],
  [onDomain("snapchat.com"), "Snapchat", "Social", "snapchat.com/add/<name>"],
  [onDomain("t.me", "telegram.me", "telegram.org"), "Telegram", "Social", "t.me/<name>"],
  [
    onDomain("discord.com", "discord.gg", "discordapp.com"),
    "Discord",
    "Social",
    "discord.gg/<invite>",
  ],
  [/(^|\.)(mastodon\.[a-z]+|mstdn\.social)$/, "Mastodon", "Social", "mastodon.social/@<name>"],
  [onDomain("reddit.com", "redd.it"), "Reddit", "Social", "reddit.com/r/<name>"],
  [onDomain("linkedin.com"), "LinkedIn", "Social", "linkedin.com/in/<name>"],
  [onDomain("tumblr.com"), "Tumblr", "Social", "<name>.tumblr.com"],
  [onDomain("substack.com"), "Substack", "Social", "<name>.substack.com"],
  // Reference
  [onDomain("wikipedia.org"), "Wikipedia", "Reference", "en.wikipedia.org/wiki/<name>"],
  [onDomain("wikidata.org"), "Wikidata", "Reference", "wikidata.org/wiki/Q<number>"],
  [onDomain("discogs.com"), "Discogs", "Reference", "discogs.com/artist/<id>-<name>"],
  [onDomain("allmusic.com"), "AllMusic", "Reference", "allmusic.com/artist/<name>-mn<id>"],
  [onDomain("genius.com"), "Genius", "Reference", "genius.com/artists/<name>"],
  [onDomain("last.fm"), "Last.fm", "Reference", "last.fm/music/<name>"],
  [onDomain("imdb.com"), "IMDb", "Reference", "imdb.com/name/nm<id>"],
  [onDomain("musicbrainz.org"), "MusicBrainz", "Reference", "musicbrainz.org/artist/<id>"],
  [onDomain("setlist.fm"), "Setlist.fm", "Reference", "setlist.fm/setlists/<name>-<id>.html"],
  [
    onDomain("rateyourmusic.com"),
    "Rate Your Music",
    "Reference",
    "rateyourmusic.com/artist/<name>",
  ],
  [onDomain("songfacts.com"), "Songfacts", "Reference", "songfacts.com/facts/<name>"],
  // Concerts and tickets
  [onDomain("bandsintown.com"), "Bandsintown", "Other", "bandsintown.com/a/<id>"],
  [onDomain("songkick.com"), "Songkick", "Other", "songkick.com/artists/<id>-<name>"],
  [onDomain("ra.co", "residentadvisor.net"), "Resident Advisor", "Other", "ra.co/dj/<name>"],
  [
    onDomain("ticketmaster.com"),
    "Ticketmaster",
    "Other",
    "ticketmaster.com/<name>-tickets/artist/<id>",
  ],
];

export interface LinkItem {
  url: string;
  platform: string;
  group: Group;
}

export function classify(url: string, relType: string): LinkItem {
  let host = url;
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // not a parseable URL: keep the raw string as host
  }
  for (const [re, name, group] of PLATFORMS)
    if (re.test(host)) return { url, platform: name, group };
  if (relType === "official homepage")
    return { url, platform: "Official website", group: "Official website" };
  return { url, platform: host, group: "Other" };
}

export interface PlatformInfo {
  name: string;
  group: Group;
  /** Link pattern without the scheme, e.g. "open.spotify.com/artist/<id>". */
  example: string;
}

/** Every platform the matching table recognises, in table order (feeds the /platforms page). */
export const PLATFORM_LIST: PlatformInfo[] = PLATFORMS.map(([, name, group, example]) => ({
  name,
  group,
  example,
}));

export function artistLinks(a: Artist): LinkItem[] {
  const seen = new Set<string>();
  const items: LinkItem[] = [];
  for (const r of a.relations ?? []) {
    const url = r.url?.resource;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    items.push(classify(url, r.type));
  }
  // Group order first, then A-Z by platform name (unknown hosts sort by hostname).
  return items.sort(
    (a, b) =>
      GROUPS.indexOf(a.group) - GROUPS.indexOf(b.group) ||
      a.platform.localeCompare(b.platform, "en", { sensitivity: "base" }),
  );
}
