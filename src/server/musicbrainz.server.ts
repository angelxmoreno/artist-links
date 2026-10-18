// Server-only MusicBrainz client: real User-Agent, global request queue, keyvhq cache
// (SQLite file or memory, see cache.server.ts) and in-flight de-duplication. No TanStack imports.
import type Keyv from "@keyvhq/core";
import { normalizeUrl, urlVariants, UnsupportedUrl } from "../lib/links";
import type { Artist, LookupResult } from "../lib/api-types";
import { getAppCache, MAX_MEMORY_ENTRIES, memoryKeyv, MB_NAMESPACE } from "./cache.server";

const MB = "https://musicbrainz.org/ws/2";
const DEFAULT_CONTACT = "https://github.com/angelxmoreno/artist-links";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const MIN_INTERVAL_MS = 1100;
export const RETRY_DELAY_MS = 2000;
export const OK_TTL_MS = 24 * 60 * 60 * 1000;
export const NOTFOUND_TTL_MS = 60 * 60 * 1000;
export const MAX_CACHE_ENTRIES = MAX_MEMORY_ENTRIES;
export const MAX_QUERY_LENGTH = 100;
/** Max requests pending (in flight plus waiting) in the queue; about 22s of waiting at 1 req/s. */
export const MAX_QUEUE_LENGTH = 20;

export const UNREACHABLE_MESSAGE =
  "Couldn't reach MusicBrainz. Check your connection or try again in a moment.";
export const INVALID_LINK_MESSAGE = "That doesn't look like a valid link.";
export const BUSY_MESSAGE = "MusicBrainz is busy right now. Please try again in a moment.";

export class NotFound extends Error {}
/** The queue is full; the request was not sent. */
export class QueueFull extends Error {
  constructor() {
    super(BUSY_MESSAGE);
  }
}

/** Per-call context. `beforeNetwork` runs only when a request would really go out to
 * MusicBrainz (not for cache hits or joins of an in-flight request); throw to refuse it. */
export interface CallContext {
  beforeNetwork?: () => void;
}

export interface MusicBrainzOptions {
  fetch?: typeof fetch | undefined;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  contact?: string | undefined;
  /** keyvhq instance holding the responses. Default: a private in-memory one (tests, no disk). */
  cache?: Keyv;
  /** Size of the default in-memory cache (ignored when `cache` is given). */
  maxEntries?: number;
  okTtlMs?: number;
  notFoundTtlMs?: number;
  minIntervalMs?: number;
  retryDelayMs?: number;
  maxQueue?: number;
}

/** What is stored per request path: the parsed response, or a remembered 404. */
type CacheEntry = { value?: unknown; notFound: boolean };

export function createMusicBrainz(opts: MusicBrainzOptions = {}) {
  const doFetch = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const now = opts.now ?? (() => Date.now());
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const contact = opts.contact ?? (process.env["MUSICBRAINZ_CONTACT"] || DEFAULT_CONTACT);
  const cache = opts.cache ?? memoryKeyv(opts.maxEntries ?? MAX_CACHE_ENTRIES, MB_NAMESPACE);
  const okTtl = opts.okTtlMs ?? OK_TTL_MS;
  const nfTtl = opts.notFoundTtlMs ?? NOTFOUND_TTL_MS;
  const minInterval = opts.minIntervalMs ?? MIN_INTERVAL_MS;
  const retryDelay = opts.retryDelayMs ?? RETRY_DELAY_MS;
  const maxQueue = opts.maxQueue ?? MAX_QUEUE_LENGTH;
  const userAgent = `ArtistLinks/0.1 ( ${contact} )`;

  // Global queue: requests to MusicBrainz are at least `minInterval` apart.
  let chain: Promise<unknown> = Promise.resolve();
  let last = -Infinity;
  let queued = 0; // in flight + waiting; beyond maxQueue we refuse instead of growing forever
  function schedule<T>(fn: () => Promise<T>): Promise<T> {
    if (queued >= maxQueue) return Promise.reject(new QueueFull());
    queued++;
    const run = chain.then(async () => {
      try {
        const delta = now() - last;
        if (delta < minInterval) await sleep(minInterval - delta);
        last = now();
        return await fn();
      } finally {
        queued--;
      }
    });
    chain = run.catch(() => undefined);
    return run;
  }

  const inflight = new Map<string, Promise<unknown>>();

  // The cache is best effort: a failing store counts as a miss / a dropped write, and the
  // request goes to MusicBrainz as usual.
  async function cacheGet(key: string): Promise<CacheEntry | undefined> {
    try {
      return (await cache.get(key)) as CacheEntry | undefined;
    } catch (e) {
      console.warn("[cache] read failed", e instanceof Error ? e.message : e);
      return undefined;
    }
  }

  async function cacheSet(key: string, entry: CacheEntry, ttl: number): Promise<void> {
    try {
      await cache.set(key, entry, ttl);
    } catch (e) {
      console.warn("[cache] write failed", e instanceof Error ? e.message : e);
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
      if (e instanceof NotFound || e instanceof QueueFull) throw e;
      if (!retried) {
        await sleep(retryDelay);
        return rawFetch<T>(path, true);
      }
      throw new Error(UNREACHABLE_MESSAGE);
    }
  }

  /** Cached, de-duplicated GET. Throws NotFound on 404 (also cached, shorter TTL). */
  function mbFetch<T>(path: string, ctx?: CallContext): Promise<T> {
    const pending = inflight.get(path);
    if (pending) return pending as Promise<T>;
    return (async () => {
      const hit = await cacheGet(path);
      if (hit) {
        if (hit.notFound) throw new NotFound("not found");
        return hit.value as T;
      }
      // Someone may have started the same request while we read the cache.
      const started = inflight.get(path);
      if (started) return (await started) as T;
      ctx?.beforeNetwork?.();
      const p = rawFetch<T>(path)
        .then(
          async (value) => {
            await cacheSet(path, { value, notFound: false }, okTtl);
            return value;
          },
          async (e) => {
            if (e instanceof NotFound) await cacheSet(path, { notFound: true }, nfTtl);
            throw e;
          },
        )
        // After the write, so a new caller finds either the in-flight request or the cache entry.
        .finally(() => inflight.delete(path));
      inflight.set(path, p);
      return p;
    })();
  }

  async function lookupByUrl(input: string, ctx?: CallContext): Promise<LookupResult> {
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
        }>(`/url?resource=${encodeURIComponent(v)}&inc=artist-rels&fmt=json`, ctx);
        const rel = data.relations?.find((r) => r.artist);
        if (rel?.artist) return { status: "found", mbid: rel.artist.id };
      } catch (e) {
        if (e instanceof NotFound) continue;
        throw e;
      }
    }
    return { status: "notfound" };
  }

  async function getArtist(mbid: string, ctx?: CallContext): Promise<Artist | null> {
    if (typeof mbid !== "string" || !UUID_RE.test(mbid)) return null;
    try {
      return await mbFetch<Artist>(`/artist/${mbid.toLowerCase()}?inc=url-rels&fmt=json`, ctx);
    } catch (e) {
      if (e instanceof NotFound) return null;
      throw e;
    }
  }

  async function searchArtists(q: string, ctx?: CallContext): Promise<Artist[]> {
    const query = typeof q === "string" ? q.trim() : "";
    if (!query) throw new Error("Enter an artist name to search.");
    if (query.length > MAX_QUERY_LENGTH) throw new Error("That search is too long.");
    try {
      const d = await mbFetch<{ artists?: Artist[] }>(
        `/artist?query=${encodeURIComponent(query)}&fmt=json&limit=5`,
        ctx,
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
    clearCache: () => cache.clear(),
  };
}

const defaultClient = createMusicBrainz({ cache: getAppCache().mb });

export const lookupByUrl = defaultClient.lookupByUrl;
export const getArtist = defaultClient.getArtist;
export const searchArtists = defaultClient.searchArtists;
