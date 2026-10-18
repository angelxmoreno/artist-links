// Per-client sliding-window rate limiter, in memory and bounded. Used to cap how many
// requests one visitor can send to MusicBrainz (cache hits are never counted: the limiter
// is only consulted right before a request would go out). No TanStack imports.

/** Max MusicBrainz requests per client per window. Constants, not env vars. */
export const RATE_LIMIT_MAX = 30;
export const RATE_LIMIT_WINDOW_MS = 60_000;
/** Max distinct clients tracked; the least recently seen is evicted past this. */
export const RATE_LIMIT_MAX_KEYS = 10_000;

export const RATE_LIMITED_MESSAGE = "Too many requests. Please wait a minute and try again.";

export class RateLimited extends Error {
  constructor() {
    super(RATE_LIMITED_MESSAGE);
  }
}

export interface RateLimiterOptions {
  limit?: number;
  windowMs?: number;
  maxKeys?: number;
  now?: () => number;
}

export function createRateLimiter(opts: RateLimiterOptions = {}) {
  const limit = opts.limit ?? RATE_LIMIT_MAX;
  const windowMs = opts.windowMs ?? RATE_LIMIT_WINDOW_MS;
  const maxKeys = opts.maxKeys ?? RATE_LIMIT_MAX_KEYS;
  const now = opts.now ?? (() => Date.now());

  // key -> timestamps of allowed requests inside the window (at most `limit` each).
  // Map insertion order doubles as least-recently-seen order.
  const hits = new Map<string, number[]>();

  function sweep(t: number) {
    for (const [k, ts] of hits) {
      if ((ts[ts.length - 1] ?? -Infinity) <= t - windowMs) hits.delete(k);
    }
  }

  /** Records a request for `key`. Returns false (and records nothing) when over the limit. */
  function consume(key: string): boolean {
    const t = now();
    let ts = hits.get(key);
    if (ts) {
      hits.delete(key);
      while (ts.length > 0 && (ts[0] ?? 0) <= t - windowMs) ts.shift();
    } else {
      if (hits.size >= maxKeys) sweep(t);
      while (hits.size >= maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest === undefined) break;
        hits.delete(oldest);
      }
      ts = [];
    }
    hits.set(key, ts);
    if (ts.length >= limit) return false;
    ts.push(t);
    return true;
  }

  return { consume, size: () => hits.size, clear: () => hits.clear() };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;

export const defaultLimiter = createRateLimiter();

/** A `beforeNetwork` hook for musicbrainz.server that throws RateLimited when `key` is over. */
export function limitHook(key: string, limiter: RateLimiter = defaultLimiter): () => void {
  return () => {
    if (!limiter.consume(key)) throw new RateLimited();
  };
}

const SHARED_KEY = "shared";
const MAX_KEY_LENGTH = 64;

/**
 * The real client IP behind Cloudflare then Traefik: `cf-connecting-ip`, else the first
 * `x-forwarded-for` entry, else one shared bucket. Capped in length to bound memory.
 */
export function clientKey(getHeader: (name: string) => string | undefined): string {
  const cf = getHeader("cf-connecting-ip")?.trim();
  const xff = getHeader("x-forwarded-for")?.split(",")[0]?.trim();
  return (cf || xff || SHARED_KEY).slice(0, MAX_KEY_LENGTH);
}
