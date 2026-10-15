const MB = "https://musicbrainz.org/ws/2";

// Global queue: at most one MusicBrainz request per second.
let chain: Promise<unknown> = Promise.resolve();
let last = 0;
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function schedule<T>(fn: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const delta = Date.now() - last;
    if (delta < 1000) await wait(1000 - delta);
    last = Date.now();
    return fn();
  });
  chain = run.catch(() => undefined);
  return run;
}

export class NotFound extends Error {}

async function mbFetch<T>(path: string, retried = false): Promise<T> {
  try {
    const res = await schedule(() => fetch(MB + path, { headers: { Accept: "application/json" } }));
    if (res.status === 404) throw new NotFound("not found");
    if (res.status === 503 && !retried) {
      await wait(2000);
      return mbFetch<T>(path, true);
    }
    if (!res.ok) throw new Error(`MusicBrainz responded with ${res.status}`);
    return (await res.json()) as T;
  } catch (e) {
    if (e instanceof NotFound) throw e;
    if (!retried) {
      await wait(2000);
      return mbFetch<T>(path, true);
    }
    throw new Error("Couldn't reach MusicBrainz. Check your connection or try again in a moment.");
  }
}

export interface Artist {
  id: string;
  name: string;
  type?: string;
  country?: string;
  disambiguation?: string;
  "life-span"?: { begin?: string; end?: string; ended?: boolean };
  relations?: { type: string; url?: { resource: string } }[];
}

export class UnsupportedUrl extends Error {}

export function normalizeUrl(input: string): URL {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  const u = new URL(s);
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  u.search = "";
  u.hash = "";
  let path = u.pathname;
  if (u.hostname === "open.spotify.com") path = path.replace(/^\/intl-[a-z-]+\//i, "/");
  u.pathname = path;
  const p = path.toLowerCase();
  const bad =
    /\/(track|album|playlist|episode|show)\//.test(p) ||
    /\/(watch|playlist)$/.test(p) ||
    (u.hostname.endsWith("bandcamp.com") && /\/(track|album)\//.test(p)) ||
    (u.hostname === "soundcloud.com" && /\/sets\//.test(p)) ||
    (u.hostname.endsWith("music.apple.com") && /\/(album|song|playlist)\//.test(p)) ||
    (u.hostname === "instagram.com" && /^\/(p|reel)\//.test(p));
  if (bad) throw new UnsupportedUrl("Paste an artist profile link instead.");
  return u;
}

export function urlVariants(u: URL): string[] {
  const host = u.hostname;
  const path = u.pathname.replace(/\/+$/, "");
  const hosts = [host, "www." + host];
  const out: string[] = [];
  for (const h of hosts) for (const p of [path, path + "/"]) out.push(`https://${h}${p || "/"}`);
  return [...new Set(out)];
}

export async function findArtistByUrl(input: string): Promise<string | null> {
  const u = normalizeUrl(input);
  for (const v of urlVariants(u)) {
    try {
      const data = await mbFetch<{
        relations?: { "target-type"?: string; artist?: { id: string } }[];
      }>(`/url?resource=${encodeURIComponent(v)}&inc=artist-rels&fmt=json`);
      const rel = data.relations?.find((r) => r.artist);
      if (rel?.artist) return rel.artist.id;
    } catch (e) {
      if (e instanceof NotFound) continue;
      throw e;
    }
  }
  return null;
}

export const getArtist = (mbid: string) => mbFetch<Artist>(`/artist/${mbid}?inc=url-rels&fmt=json`);

export const searchArtists = (name: string) =>
  mbFetch<{ artists: Artist[] }>(`/artist?query=${encodeURIComponent(name)}&fmt=json&limit=5`).then(
    (d) => d.artists.slice(0, 5),
  );

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
  } catch {}
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
