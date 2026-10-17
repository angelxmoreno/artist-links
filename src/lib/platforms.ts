import type { Artist } from "./types";

export type Group = "Streaming" | "Social" | "Reference" | "Official website" | "Other";
export const GROUPS: Group[] = ["Streaming", "Social", "Reference", "Official website", "Other"];

const PLATFORMS: [RegExp, string, Group][] = [
  [/spotify\.com/, "Spotify", "Streaming"],
  [/music\.apple\.com|itunes\.apple\.com/, "Apple Music", "Streaming"],
  [/deezer\.com/, "Deezer", "Streaming"],
  [/tidal\.com/, "Tidal", "Streaming"],
  [/music\.youtube\.com/, "YouTube Music", "Streaming"],
  [/soundcloud\.com/, "SoundCloud", "Streaming"],
  [/bandcamp\.com/, "Bandcamp", "Streaming"],
  [/audiomack\.com/, "Audiomack", "Streaming"],
  [/instagram\.com/, "Instagram", "Social"],
  [/(twitter|x)\.com/, "X / Twitter", "Social"],
  [/facebook\.com/, "Facebook", "Social"],
  [/tiktok\.com/, "TikTok", "Social"],
  [/youtube\.com|youtu\.be/, "YouTube", "Social"],
  [/bsky\.app/, "Bluesky", "Social"],
  [/wikipedia\.org/, "Wikipedia", "Reference"],
  [/wikidata\.org/, "Wikidata", "Reference"],
  [/discogs\.com/, "Discogs", "Reference"],
  [/allmusic\.com/, "AllMusic", "Reference"],
  [/genius\.com/, "Genius", "Reference"],
  [/last\.fm/, "Last.fm", "Reference"],
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
  return items;
}
