// Server-only MusicBrainz client: real User-Agent, global request queue,
// in-memory TTL+LRU cache and in-flight de-duplication. No TanStack imports.
import { normalizeUrl, urlVariants, UnsupportedUrl } from "../lib/links";
import type { Artist, LookupResult } from "../lib/api-types";

const MB = "https://musicbrainz.org/ws/2";
const DEFAULT_CONTACT = "https://github.com/angelxmoreno/artist-links";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MIN_INTERVAL_MS = 1100;
export const RETRY_DELAY_MS = 2000;
export const OK_TTL_MS = 24 * 60 * 60 * 1000;
export const NOTFOUND_TTL_MS = 60 * 60 * 1000;
export const MAX_CACHE_ENTRIES = 500;
export const MAX_QUERY_LENGTH = 100;

export const UNREACHABLE_MESSAGE =
  "Couldn't reach MusicBrainz. Check your connection or try again in a moment.";
export const INVALID_LINK_MESSAGE = "That doesn't look like a valid link.";

export class NotFound extends Error {}

export interface MusicBrainzOptions {
  fetch?: typeof fetch | undefined;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  contact?: string | undefined;
  maxEntries?: number;
  okTtlMs?: number;
  notFoundTtlMs?: number;
  minIntervalMs?: number;
  retryDelayMs?: number;
}

type CacheEntry = { value?: unknown; notFound: boolean; expires: number };

export function createMusicBrainz(opts: MusicBrainzOptions = {}) {
  const doFetch = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const now = opts.now ?? (() => Date.now());
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const contact = opts.contact ?? (process.env["MUSICBRAINZ_CONTACT"] || DEFAULT_CONTACT);
  const maxEntries = opts.maxEntries ?? MAX_CACHE_ENTRIES;
  const okTtl = opts.okTtlMs ?? OK_TTL_MS;
  const nfTtl = opts.notFoundTtlMs ?? NOTFOUND_TTL_MS;
  const minInterval = opts.minIntervalMs ?? MIN_INTERVAL_MS;
  const retryDelay = opts.retryDelayMs ?? RETRY_DELAY_MS;
  const userAgent = `ArtistLinks/0.1 ( ${contact} )`;

  // Global queue: requests to MusicBrainz are at least `minInterval` apart.
  let chain: Promise<unknown> = Promise.resolve();
  let last = -Infinity;
  function schedule<T>(fn: () => Promise<T>): Promise<T> {
    const run = chain.then(async () => {
      const delta = now() - last;
      if (delta < minInterval) await sleep(minInterval - delta);
      last = now();
      return fn();
    });
    chain = run.catch(() => undefined);
    return run;
  }

  // LRU (Map insertion order) + TTL cache keyed by request path.
  const cache = new Map<string, CacheEntry>();
  const inflight = new Map<string, Promise<unknown>>();

  function cacheGet(key: string): CacheEntry | undefined {
    const e = cache.get(key);
    if (!e) return undefined;
    if (e.expires <= now()) {
      cache.delete(key);
      return undefined;
    }
    cache.delete(key);
    cache.set(key, e);
    return e;
  }

  function cacheSet(key: string, entry: CacheEntry) {
    cache.delete(key);
    cache.set(key, entry);
    while (cache.size > maxEntries) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
  }

  async function rawFetch<T>(path: string, retried = false): Promise<T> {
    try {
      const res = await schedule(() =>
        doFetch(MB + path, { headers: { Accept: "application/json", "User-Agent": userAgent } }),
      );
      if (res.status === 404) throw new NotFound("not found");
      if (!res.ok) throw new Error(`MusicBrainz responded with ${res.status}`);
      return (await res.json()) as T;
    } catch (e) {
      if (e instanceof NotFound) throw e;
      if (!retried) {
        await sleep(retryDelay);
        return rawFetch<T>(path, true);
      }
      throw new Error(UNREACHABLE_MESSAGE);
    }
  }

  /** Cached, de-duplicated GET. Throws NotFound on 404 (also cached, shorter TTL). */
  function mbFetch<T>(path: string): Promise<T> {
    const hit = cacheGet(path);
    if (hit)
      return hit.notFound
        ? Promise.reject(new NotFound("not found"))
        : Promise.resolve(hit.value as T);
    const pending = inflight.get(path);
    if (pending) return pending as Promise<T>;
    const p = rawFetch<T>(path)
      .then(
        (value) => {
          cacheSet(path, { value, notFound: false, expires: now() + okTtl });
          return value;
        },
        (e) => {
          if (e instanceof NotFound) cacheSet(path, { notFound: true, expires: now() + nfTtl });
          throw e;
        },
      )
      .finally(() => inflight.delete(path));
    inflight.set(path, p);
    return p;
  }

  async function lookupByUrl(input: string): Promise<LookupResult> {
    let u: URL;
    try {
      u = normalizeUrl(input);
    } catch (e) {
      if (e instanceof UnsupportedUrl) return { status: "unsupported" };
      if (e instanceof TypeError) throw new Error(INVALID_LINK_MESSAGE);
      throw e;
    }
    for (const v of urlVariants(u)) {
      try {
        const data = await mbFetch<{
          relations?: { "target-type"?: string; artist?: { id: string } }[];
        }>(`/url?resource=${encodeURIComponent(v)}&inc=artist-rels&fmt=json`);
        const rel = data.relations?.find((r) => r.artist);
        if (rel?.artist) return { status: "found", mbid: rel.artist.id };
      } catch (e) {
        if (e instanceof NotFound) continue;
        throw e;
      }
    }
    return { status: "notfound" };
  }

  async function getArtist(mbid: string): Promise<Artist | null> {
    if (typeof mbid !== "string" || !UUID_RE.test(mbid)) return null;
    try {
      return await mbFetch<Artist>(`/artist/${mbid.toLowerCase()}?inc=url-rels&fmt=json`);
    } catch (e) {
      if (e instanceof NotFound) return null;
      throw e;
    }
  }

  async function searchArtists(q: string): Promise<Artist[]> {
    const query = typeof q === "string" ? q.trim() : "";
    if (!query) throw new Error("Enter an artist name to search.");
    if (query.length > MAX_QUERY_LENGTH) throw new Error("That search is too long.");
    try {
      const d = await mbFetch<{ artists?: Artist[] }>(
        `/artist?query=${encodeURIComponent(query)}&fmt=json&limit=5`,
      );
      return (d.artists ?? []).slice(0, 5);
    } catch (e) {
      if (e instanceof NotFound) return [];
      throw e;
    }
  }

  return {
    userAgent,
    mbFetch,
    lookupByUrl,
    getArtist,
    searchArtists,
    cacheSize: () => cache.size,
    clearCache: () => cache.clear(),
  };
}

const defaultClient = createMusicBrainz();

export const lookupByUrl = defaultClient.lookupByUrl;
export const getArtist = defaultClient.getArtist;
export const searchArtists = defaultClient.searchArtists;
