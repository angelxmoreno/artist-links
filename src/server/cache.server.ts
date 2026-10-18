// Server-only persisted cache built on keyvhq. One SQLite file (CACHE_DB_PATH) holds two
// namespaces: "mb" (MusicBrainz responses, TTL'd) and "viewed" (MBIDs, plus the artist's name,
// of artist pages we served, used by the sitemap and the /artists directory). Empty CACHE_DB_PATH, or a file that can't be opened, means
// a bounded in-memory store instead. Cache problems never reach the visitor: reads that fail
// count as misses and writes that fail are dropped.
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Keyv from "@keyvhq/core";
import type { Artist } from "../lib/api-types";
import { artistLinks } from "../lib/platforms";

export const MB_NAMESPACE = "mb";
export const VIEWED_NAMESPACE = "viewed";
/** Max entries of the in-memory fallback store for MusicBrainz responses. */
export const MAX_MEMORY_ENTRIES = 500;
/** A viewed artist drops out of the sitemap after this long without a view (re-recorded on view). */
export const VIEWED_TTL_MS = 365 * 24 * 60 * 60 * 1000;
/** Don't rewrite the same viewed artist more often than this. */
const VIEWED_REWRITE_MS = 24 * 60 * 60 * 1000;
export const SWEEP_INTERVAL_MS = 60 * 60 * 1000;
/** The sitemap protocol allows 50,000 URLs per file. */
export const SITEMAP_MAX_URLS = 50_000;
const WARN_EVERY_MS = 60_000;

/** The subset of the keyvhq store interface we rely on (SQLite store and our memory store). */
export interface RawStore {
  get(key: string): Promise<string | undefined>;
  set(key: string, value: string, ttl?: number): Promise<unknown>;
  delete(key: string): Promise<unknown>;
  clear(namespace?: string): Promise<unknown>;
  iterator(namespace?: string): AsyncGenerator<[string, string]>;
}

export interface ViewedArtist {
  mbid: string;
  name: string | null;
}

/** Longest artist name we store; MusicBrainz names are far shorter. */
const MAX_NAME_LENGTH = 200;

export type CacheBackend = "sqlite" | "memory";

/** Map with a size limit: the least recently used entry goes first. */
export class BoundedMap extends Map<string, string> {
  constructor(private readonly max: number) {
    super();
  }

  override get(key: string): string | undefined {
    const value = super.get(key);
    if (value !== undefined) {
      super.delete(key);
      super.set(key, value);
    }
    return value;
  }

  override set(key: string, value: string): this {
    super.delete(key);
    super.set(key, value);
    while (this.size > this.max) {
      const oldest = this.keys().next().value;
      if (oldest === undefined) break;
      super.delete(oldest);
    }
    return this;
  }
}

function memoryStore(max: number): RawStore {
  const map = new BoundedMap(max);
  const inNamespace = (key: string, ns?: string) => !ns || key.startsWith(`${ns}:`);
  return {
    get: async (key) => map.get(key),
    set: async (key, value) => map.set(key, value),
    delete: async (key) => map.delete(key),
    clear: async (ns) => {
      for (const key of [...map.keys()]) if (inNamespace(key, ns)) map.delete(key);
    },
    async *iterator(ns) {
      for (const entry of [...map]) if (inNamespace(entry[0], ns)) yield entry;
    },
  };
}

/** A Keyv backed by a private bounded in-memory store (used when no cache is injected). */
export function memoryKeyv(max: number, namespace: string): Keyv {
  return newKeyv(memoryStore(max), namespace);
}

function newKeyv(store: RawStore, namespace: string): Keyv {
  return new Keyv({
    store: store as unknown as Keyv.Store<string>,
    namespace,
    // Values are plain JSON; skip keyvhq's Buffer-aware default.
    serialize: JSON.stringify,
    deserialize: JSON.parse,
  });
}

// keyvhq types `iterator()` as an AsyncIterator, which `for await` rejects; it is iterable at runtime.
const entriesOf = (keyv: Keyv) =>
  (keyv as unknown as { iterator(): AsyncIterable<[string, unknown]> }).iterator();

type SqliteInternals = RawStore & { query(sql: string): Promise<unknown> };

async function openSqlite(path: string): Promise<RawStore> {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  // Imported here, not at the top: loading the native addon can fail (wrong platform, missing
  // binary) and that must only mean "use memory", never break the whole server.
  const { default: KeyvSqlite } = await import("@keyvhq/sqlite");
  // The shipped typings omit `iterationLimit` and `query`, which exist at runtime.
  const Store = KeyvSqlite as unknown as new (options: object) => SqliteInternals;
  const store = new Store({ uri: `sqlite://${path}`, iterationLimit: 500 });
  // keyvhq connects lazily; the connection error would otherwise stay an unhandled rejection.
  await store.query("SELECT 1");
  return store;
}

export interface CacheOptions {
  /** SQLite file path; empty or undefined = in-memory only. */
  path?: string | null | undefined;
  maxMemoryEntries?: number;
  /** Test hook: how the SQLite file is opened. */
  open?: (path: string) => Promise<RawStore>;
  warn?: (message: string, error?: unknown) => void;
}

export interface AppCache {
  /** MusicBrainz responses (namespace "mb"). */
  mb: Keyv;
  /** Which store is really in use; resolves once the file was opened (or the fallback chosen). */
  backend(): Promise<CacheBackend>;
  /**
   * Remember an artist page that was served (fire and forget; never throws). The artist's name
   * is stored with the id so the /artists directory can list it without asking MusicBrainz.
   */
  recordViewed(mbid: string, name?: string): Promise<void>;
  /** MBIDs of viewed artists, at most `max`, oldest view first. Empty on error. */
  listViewed(max: number): Promise<string[]>;
  /**
   * Like listViewed, with the stored name. `name` is null for entries recorded before names were
   * stored (their value was just `1`).
   */
  listViewedWithNames(max: number): Promise<ViewedArtist[]>;
  /** Delete expired rows. Returns how many were removed. */
  sweep(): Promise<number>;
}

export function createCache(opts: CacheOptions = {}): AppCache {
  const path = opts.path?.trim() || null;
  const maxMemory = opts.maxMemoryEntries ?? MAX_MEMORY_ENTRIES;
  const open = opts.open ?? openSqlite;
  const warn = opts.warn ?? ((m, e) => console.warn(m, e instanceof Error ? e.message : (e ?? "")));

  let lastWarn = -Infinity;
  const warnThrottled = (message: string, error?: unknown) => {
    const t = Date.now();
    if (t - lastWarn < WARN_EVERY_MS) return;
    lastWarn = t;
    warn(message, error);
  };

  interface Stores {
    backend: CacheBackend;
    mb: RawStore;
    viewed: RawStore;
  }

  const ready: Promise<Stores> = (async () => {
    if (path) {
      try {
        const sqlite = await open(path);
        return { backend: "sqlite", mb: sqlite, viewed: sqlite } as Stores;
      } catch (e) {
        warn(`[cache] cannot open ${path}, using the in-memory cache instead`, e);
      }
    }
    return {
      backend: "memory",
      mb: memoryStore(maxMemory),
      viewed: memoryStore(SITEMAP_MAX_URLS),
    } as Stores;
  })();

  // The Keyv instances are created synchronously; each call waits for the store to be ready.
  function lazy(pick: (s: Stores) => RawStore): RawStore {
    return {
      get: async (key) => pick(await ready).get(key),
      set: async (key, value, ttl) => pick(await ready).set(key, value, ttl),
      // keyvhq calls delete without awaiting it, so it must never reject.
      delete: async (key) => {
        try {
          return await pick(await ready).delete(key);
        } catch (e) {
          warnThrottled("[cache] delete failed", e);
          return false;
        }
      },
      clear: async (ns) => pick(await ready).clear(ns),
      async *iterator(ns) {
        yield* pick(await ready).iterator(ns);
      },
    };
  }

  const mb = newKeyv(
    lazy((s) => s.mb),
    MB_NAMESPACE,
  );
  const viewed = newKeyv(
    lazy((s) => s.viewed),
    VIEWED_NAMESPACE,
  );
  const recorded = new Map<string, number>(); // mbid -> last write, to avoid a write per page view

  async function recordViewed(mbid: string, name?: string): Promise<void> {
    try {
      const t = Date.now();
      const last = recorded.get(mbid);
      if (last !== undefined && t - last < VIEWED_REWRITE_MS) return;
      if (recorded.size >= SITEMAP_MAX_URLS) recorded.clear();
      recorded.set(mbid, t);
      // Only the artist's public name is stored with the id: nothing about the visitor.
      const clean = typeof name === "string" ? name.trim().slice(0, MAX_NAME_LENGTH) : "";
      await viewed.set(mbid, clean || 1, VIEWED_TTL_MS);
    } catch (e) {
      recorded.delete(mbid);
      warnThrottled("[cache] recording a viewed artist failed", e);
    }
  }

  async function listViewedWithNames(max: number): Promise<ViewedArtist[]> {
    const out: ViewedArtist[] = [];
    try {
      if (max <= 0) return out;
      for await (const [mbid, value] of entriesOf(viewed)) {
        out.push({ mbid, name: typeof value === "string" && value ? value : null });
        if (out.length >= max) break;
      }
    } catch (e) {
      warnThrottled("[cache] listing viewed artists failed", e);
    }
    return out;
  }

  async function listViewed(max: number): Promise<string[]> {
    return (await listViewedWithNames(max)).map((v) => v.mbid);
  }

  // keyvhq deletes expired rows only when they are read again, so old rows would pile up.
  // Collect first and delete after: deleting while paging would skip rows.
  async function sweep(): Promise<number> {
    let removed = 0;
    try {
      const stores = await ready;
      const now = Date.now();
      for (const store of new Set([stores.mb, stores.viewed])) {
        const expired: string[] = [];
        for await (const [key, raw] of store.iterator()) {
          const data = JSON.parse(raw) as { expires?: number | null };
          if (typeof data.expires === "number" && now > data.expires) expired.push(key);
        }
        for (const key of expired) await store.delete(key);
        removed += expired.length;
      }
    } catch (e) {
      warnThrottled("[cache] sweep failed", e);
    }
    return removed;
  }

  return {
    mb,
    backend: async () => (await ready).backend,
    recordViewed,
    listViewed,
    listViewedWithNames,
    sweep,
  };
}

let app: AppCache | undefined;

/** The process-wide cache, configured from CACHE_DB_PATH (read when first used). */
export function getAppCache(): AppCache {
  if (!app) {
    app = createCache({ path: process.env["CACHE_DB_PATH"] });
    const cache = app;
    void cache.backend().then((backend) => {
      if (backend !== "sqlite") return;
      void cache.sweep();
      setInterval(() => void cache.sweep(), SWEEP_INTERVAL_MS).unref();
    });
  }
  return app;
}

/** For tests: forget the process-wide cache so the next getAppCache() re-reads the env. */
export function resetAppCacheForTests(): void {
  app = undefined;
}

/** Records an artist page for the sitemap, but only real artists with at least one link. */
export async function recordViewedIfLinked(
  artist: Artist,
  cache: Pick<AppCache, "recordViewed"> = getAppCache(),
): Promise<void> {
  if (artistLinks(artist).length === 0) return;
  await cache.recordViewed(artist.id, artist.name);
}
export const listViewedArtists = (max: number) => getAppCache().listViewed(max);
