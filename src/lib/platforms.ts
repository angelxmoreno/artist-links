import type { Artist } from "./types";

export type Group = "Streaming" | "Social" | "Reference" | "Official website" | "Other";
export const GROUPS: Group[] = ["Streaming", "Social", "Reference", "Official website", "Other"];

/** Matches `domain` itself or any subdomain of it (never "box.com" for "x.com"). */
const onDomain = (...domains: string[]): RegExp =>
  new RegExp(`(^|\\.)(${domains.map((d) => d.replace(/\./g, "\\.")).join("|")})$`);

// Matched against the hostname (lowercased, "www." stripped). First match wins,
// so more specific hosts (music.youtube.com) must come before broader ones (youtube.com).
const PLATFORMS: [RegExp, string, Group][] = [
  // Streaming and stores
  [onDomain("spotify.com", "spoti.fi"), "Spotify", "Streaming"],
  [onDomain("music.apple.com", "itunes.apple.com"), "Apple Music", "Streaming"],
  [onDomain("podcasts.apple.com"), "Apple Podcasts", "Streaming"],
  [/^music\.amazon\.[a-z.]+$/, "Amazon Music", "Streaming"],
  [onDomain("deezer.com", "deezer.page.link"), "Deezer", "Streaming"],
  [onDomain("tidal.com"), "Tidal", "Streaming"],
  [onDomain("music.youtube.com"), "YouTube Music", "Streaming"],
  [onDomain("soundcloud.com"), "SoundCloud", "Streaming"],
  [onDomain("bandcamp.com"), "Bandcamp", "Streaming"],
  [onDomain("audiomack.com"), "Audiomack", "Streaming"],
  [onDomain("beatport.com"), "Beatport", "Streaming"],
  [onDomain("beatstars.com"), "Beatstars", "Streaming"],
  [onDomain("mixcloud.com"), "Mixcloud", "Streaming"],
  [onDomain("qobuz.com"), "Qobuz", "Streaming"],
  [onDomain("napster.com"), "Napster", "Streaming"],
  [onDomain("pandora.com"), "Pandora", "Streaming"],
  [onDomain("iheart.com"), "iHeartRadio", "Streaming"],
  [onDomain("shazam.com"), "Shazam", "Streaming"],
  [onDomain("bandlab.com"), "BandLab", "Streaming"],
  // Social
  [onDomain("instagram.com"), "Instagram", "Social"],
  [onDomain("x.com", "twitter.com"), "X / Twitter", "Social"],
  [onDomain("facebook.com", "fb.com", "fb.me", "fb.watch"), "Facebook", "Social"],
  [onDomain("tiktok.com"), "TikTok", "Social"],
  [onDomain("youtube.com", "youtu.be"), "YouTube", "Social"],
  [onDomain("bsky.app"), "Bluesky", "Social"],
  [onDomain("threads.net", "threads.com"), "Threads", "Social"],
  [onDomain("twitch.tv"), "Twitch", "Social"],
  [onDomain("kick.com"), "Kick", "Social"],
  [onDomain("patreon.com"), "Patreon", "Social"],
  [onDomain("ko-fi.com"), "Ko-fi", "Social"],
  [onDomain("buymeacoffee.com"), "Buy Me a Coffee", "Social"],
  [onDomain("linktr.ee", "linktree.com"), "Linktree", "Social"],
  [onDomain("vimeo.com"), "Vimeo", "Social"],
  [onDomain("pinterest.com", "pin.it"), "Pinterest", "Social"],
  [onDomain("snapchat.com"), "Snapchat", "Social"],
  [onDomain("t.me", "telegram.me", "telegram.org"), "Telegram", "Social"],
  [onDomain("discord.com", "discord.gg", "discordapp.com"), "Discord", "Social"],
  [/(^|\.)(mastodon\.[a-z]+|mstdn\.social)$/, "Mastodon", "Social"],
  [onDomain("reddit.com", "redd.it"), "Reddit", "Social"],
  [onDomain("linkedin.com"), "LinkedIn", "Social"],
  [onDomain("tumblr.com"), "Tumblr", "Social"],
  [onDomain("substack.com"), "Substack", "Social"],
  // Reference
  [onDomain("wikipedia.org"), "Wikipedia", "Reference"],
  [onDomain("wikidata.org"), "Wikidata", "Reference"],
  [onDomain("discogs.com"), "Discogs", "Reference"],
  [onDomain("allmusic.com"), "AllMusic", "Reference"],
  [onDomain("genius.com"), "Genius", "Reference"],
  [onDomain("last.fm"), "Last.fm", "Reference"],
  [onDomain("imdb.com"), "IMDb", "Reference"],
  [onDomain("musicbrainz.org"), "MusicBrainz", "Reference"],
  [onDomain("setlist.fm"), "Setlist.fm", "Reference"],
  [onDomain("rateyourmusic.com"), "Rate Your Music", "Reference"],
  [onDomain("songfacts.com"), "Songfacts", "Reference"],
  // Concerts and tickets
  [onDomain("bandsintown.com"), "Bandsintown", "Other"],
  [onDomain("songkick.com"), "Songkick", "Other"],
  [onDomain("ra.co", "residentadvisor.net"), "Resident Advisor", "Other"],
  [onDomain("ticketmaster.com"), "Ticketmaster", "Other"],
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
