// Server-only reader for the /artists directory: Featured artists plus the artists viewed so far.
// It never calls MusicBrainz (the 1 request/second queue is shared with real visitors): names come
// from the Featured list, from the name stored with each viewed artist, or, for entries recorded
// before names were stored, from a cache-only read of the artist's cached MusicBrainz response.
// Entries whose name is unknown are skipped. The sorted list is kept in memory for a short time so
// a crawler paging through the directory does not re-read the whole store on every request.
import { FEATURED } from "../data/featured";
import { sortEntries, type DirectoryEntry } from "../lib/directory";
import { getAppCache, SITEMAP_MAX_URLS, type AppCache } from "./cache.server";

/** How long the sorted directory is reused before it is rebuilt from the store. */
export const DIRECTORY_TTL_MS = 5 * 60 * 1000;

/** The cache key musicbrainz.server uses for an artist (a test keeps the two in step). */
export const artistCacheKey = (mbid: string) =>
  `/artist/${mbid.toLowerCase()}?inc=url-rels&fmt=json`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const featuredEntries = (): DirectoryEntry[] =>
  FEATURED.map((a) => ({ mbid: a.mbid, name: a.name }));

/** The name in a cached MusicBrainz artist response, or null. Only reads the cache. */
async function cachedName(cache: Pick<AppCache, "mb">, mbid: string): Promise<string | null> {
  try {
    const hit = (await cache.mb.get(artistCacheKey(mbid))) as
      { value?: { name?: unknown } } | undefined;
    const name = hit?.value?.name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  } catch {
    return null;
  }
}

/** Build the sorted directory. Reads the store only; at most SITEMAP_MAX_URLS viewed are read. */
export async function buildDirectory(
  cache: Pick<AppCache, "mb" | "listViewedWithNames">,
): Promise<DirectoryEntry[]> {
  const entries = new Map<string, DirectoryEntry>(featuredEntries().map((e) => [e.mbid, e]));
  for (const v of await cache.listViewedWithNames(SITEMAP_MAX_URLS)) {
    if (entries.has(v.mbid) || !UUID_RE.test(v.mbid)) continue;
    const name = v.name ?? (await cachedName(cache, v.mbid));
    if (name) entries.set(v.mbid, { mbid: v.mbid, name });
  }
  return sortEntries([...entries.values()]);
}

let memo: { cache: AppCache; at: number; list: Promise<DirectoryEntry[]> } | undefined;

/** The sorted directory, rebuilt at most once per DIRECTORY_TTL_MS (and once per cache instance). */
export function getDirectory(
  cache: AppCache = getAppCache(),
  now: number = Date.now(),
): Promise<DirectoryEntry[]> {
  if (!memo || memo.cache !== cache || now - memo.at >= DIRECTORY_TTL_MS) {
    const list = buildDirectory(cache).catch(() => sortEntries(featuredEntries()));
    memo = { cache, at: now, list };
  }
  return memo.list;
}

/** For tests: drop the remembered directory. */
export function resetDirectoryForTests(): void {
  memo = undefined;
}
