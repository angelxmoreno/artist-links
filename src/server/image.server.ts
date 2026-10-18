// Server-only artist photo lookup: MusicBrainz relations -> Wikidata QID -> Wikidata P18
// (Commons file name) -> Commons imageinfo (direct thumbnail URLs). The result feeds the artist
// header photo and og:image. These hosts are not MusicBrainz, so none of this goes through the
// MusicBrainz queue or the rate-limit hook. It never throws: any failure means "no photo this
// time". Results are cached in the existing keyvhq cache (cache.server.ts): photos for 7 days,
// "this artist has no photo" for 1 day, failures not at all.
import type Keyv from "@keyvhq/core";
import type { Artist, ArtistPhoto } from "../lib/api-types";
import { getAppCache, memoryKeyv, MB_NAMESPACE } from "./cache.server";

const WIKIDATA_API = "https://www.wikidata.org/w/api.php";
const COMMONS_API = "https://commons.wikimedia.org/w/api.php";
const DEFAULT_CONTACT = "https://github.com/angelxmoreno/artist-links";

export const PHOTO_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const NO_PHOTO_TTL_MS = 24 * 60 * 60 * 1000;
export const LOOKUP_TIMEOUT_MS = 2500;
/** Width asked from Commons for og:image. */
export const OG_WIDTH = 1200;
/**
 * Width of the avatar thumbnail. Wikimedia only serves a fixed set of thumbnail widths
 * (20, 40, 60, 120, 250, 330, 500, 960, 1280, ...); anything else answers 400, so keep to those.
 */
export const THUMB_WIDTH = 250;

const QID_RE = /^https?:\/\/(?:www\.)?wikidata\.org\/(?:wiki|entity)\/(Q[1-9]\d*)\/?(?:[?#].*)?$/i;
const IMAGE_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);
const PAGE_HOSTS = new Set(["commons.wikimedia.org"]);

/** The Wikidata QID (like "Q44190") from the artist's `wikidata` URL relation, or null. */
export function wikidataQid(artist: Pick<Artist, "relations">): string | null {
  const relations = artist?.relations;
  if (!Array.isArray(relations)) return null;
  for (const r of relations) {
    if (r?.type !== "wikidata") continue;
    const resource = r.url?.resource;
    if (typeof resource !== "string") continue;
    const m = QID_RE.exec(resource.trim());
    if (m?.[1]) return m[1].toUpperCase();
  }
  return null;
}

/** Thrown inside a lookup for anything that should not be cached (the caller returns null). */
export class LookupFailed extends Error {}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** The Commons file name from a wbgetclaims response: preferred rank first, never deprecated. */
export function p18FileName(data: unknown): string | null {
  if (!isObject(data)) throw new LookupFailed("malformed Wikidata response");
  if (data["error"] !== undefined) throw new LookupFailed("Wikidata error");
  const claims = data["claims"];
  if (!isObject(claims)) throw new LookupFailed("malformed Wikidata response");
  const list = claims["P18"];
  if (list === undefined) return null;
  if (!Array.isArray(list)) throw new LookupFailed("malformed Wikidata response");
  const names: { name: string; preferred: boolean }[] = [];
  for (const claim of list) {
    if (!isObject(claim) || claim["rank"] === "deprecated") continue;
    const snak = claim["mainsnak"];
    if (!isObject(snak) || snak["snaktype"] !== "value") continue;
    const value = isObject(snak["datavalue"]) ? snak["datavalue"]["value"] : undefined;
    if (typeof value !== "string") continue;
    const name = value.trim();
    if (!name || name.length > 300 || /[\n\r|]/.test(name)) continue;
    names.push({ name, preferred: claim["rank"] === "preferred" });
  }
  return (names.find((n) => n.preferred) ?? names[0])?.name ?? null;
}

function httpsUrl(value: unknown, hosts: Set<string>): URL | null {
  if (typeof value !== "string") return null;
  try {
    const u = new URL(value);
    return u.protocol === "https:" && hosts.has(u.hostname) ? u : null;
  } catch {
    return null;
  }
}

const positive = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v) && v > 0;

/**
 * Reads a Commons `prop=imageinfo` response (formatversion=2). Returns null when the file does
 * not exist; throws LookupFailed when the response does not have the expected shape.
 */
export function photoFromImageInfo(data: unknown): ArtistPhoto | null {
  const pages = isObject(data) && isObject(data["query"]) ? data["query"]["pages"] : undefined;
  if (!Array.isArray(pages)) throw new LookupFailed("malformed Commons response");
  const page = pages[0];
  if (!isObject(page)) throw new LookupFailed("malformed Commons response");
  if (page["missing"] === true) return null;
  const info = Array.isArray(page["imageinfo"]) ? page["imageinfo"][0] : undefined;
  if (!isObject(info)) throw new LookupFailed("malformed Commons response");

  // The thumbnail URL is a direct, crawlable image; fall back to the original for small files.
  const og = httpsUrl(info["thumburl"], IMAGE_HOSTS) ?? httpsUrl(info["url"], IMAGE_HOSTS);
  const filePage = httpsUrl(info["descriptionurl"], PAGE_HOSTS);
  if (!og || !filePage) throw new LookupFailed("unexpected URLs in Commons response");

  // Wikimedia rounds the width to its standard steps, so read the real one from the URL.
  const width = info["width"];
  const height = info["height"];
  if (!positive(width) || !positive(height)) throw new LookupFailed("missing image size");
  const px = /\/(\d+)px-[^/]*$/.exec(og.pathname);
  let thumb = og;
  let ogWidth = width;
  let ogHeight = height;
  if (px?.[1]) {
    ogWidth = Number(px[1]);
    ogHeight = Math.max(1, Math.round((ogWidth * height) / width));
    thumb = new URL(og.href);
    thumb.pathname = og.pathname.replace(/\/\d+px-([^/]*)$/, `/${THUMB_WIDTH}px-$1`);
  }
  // Otherwise the original file is served as is (it was smaller than the requested width).
  return { thumbUrl: thumb.href, ogUrl: og.href, pageUrl: filePage.href, ogWidth, ogHeight };
}

/** What is stored per QID: the photo, or null for "checked, no photo". */
type CacheEntry = { photo: ArtistPhoto | null };

function isCacheEntry(v: unknown): v is CacheEntry {
  if (!isObject(v) || !("photo" in v)) return false;
  const p = v["photo"];
  if (p === null) return true;
  return (
    isObject(p) &&
    typeof p["thumbUrl"] === "string" &&
    typeof p["ogUrl"] === "string" &&
    typeof p["pageUrl"] === "string" &&
    positive(p["ogWidth"]) &&
    positive(p["ogHeight"])
  );
}

export interface ImageLookupOptions {
  fetch?: typeof fetch | undefined;
  contact?: string | undefined;
  /** keyvhq instance. Default: a private in-memory one (tests, no disk). */
  cache?: Keyv;
  photoTtlMs?: number;
  noPhotoTtlMs?: number;
  /** Deadline for the whole lookup (both requests). */
  timeoutMs?: number;
}

export function createImageLookup(opts: ImageLookupOptions = {}) {
  const doFetch = opts.fetch ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const contact = opts.contact ?? (process.env["MUSICBRAINZ_CONTACT"] || DEFAULT_CONTACT);
  const cache = opts.cache ?? memoryKeyv(100, MB_NAMESPACE);
  const photoTtl = opts.photoTtlMs ?? PHOTO_TTL_MS;
  const noPhotoTtl = opts.noPhotoTtlMs ?? NO_PHOTO_TTL_MS;
  const timeoutMs = opts.timeoutMs ?? LOOKUP_TIMEOUT_MS;
  const userAgent = `ArtistLinks/0.1 ( ${contact} )`;
  const inflight = new Map<string, Promise<ArtistPhoto | null>>();

  async function cacheGet(key: string): Promise<CacheEntry | undefined> {
    try {
      const hit: unknown = await cache.get(key);
      return isCacheEntry(hit) ? hit : undefined;
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

  /** GET JSON, bounded by the shared deadline even if the fetch implementation ignores it. */
  async function getJson(url: string, signal: AbortSignal): Promise<unknown> {
    let onAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => {
      onAbort = () => reject(new LookupFailed("timed out"));
      if (signal.aborted) onAbort();
      else signal.addEventListener("abort", onAbort, { once: true });
    });
    try {
      const request = (async () => {
        const res = await doFetch(url, {
          headers: { Accept: "application/json", "User-Agent": userAgent },
          signal,
        });
        if (!res.ok) throw new LookupFailed(`HTTP ${res.status}`);
        try {
          return (await res.json()) as unknown;
        } catch {
          throw new LookupFailed("response is not JSON");
        }
      })();
      request.catch(() => {}); // when the deadline wins, the late result must not go unhandled
      return await Promise.race([request, aborted]);
    } finally {
      if (onAbort) signal.removeEventListener("abort", onAbort);
    }
  }

  async function fromNetwork(qid: string): Promise<ArtistPhoto | null> {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const claims = new URLSearchParams({
        action: "wbgetclaims",
        entity: qid,
        property: "P18",
        format: "json",
      });
      const file = p18FileName(await getJson(`${WIKIDATA_API}?${claims}`, ac.signal));
      if (!file) return null;
      const info = new URLSearchParams({
        action: "query",
        prop: "imageinfo",
        iiprop: "url|size",
        iiurlwidth: String(OG_WIDTH),
        titles: `File:${file}`,
        format: "json",
        formatversion: "2",
        origin: "*",
      });
      return photoFromImageInfo(await getJson(`${COMMONS_API}?${info}`, ac.signal));
    } finally {
      clearTimeout(timer);
    }
  }

  async function lookup(qid: string): Promise<ArtistPhoto | null> {
    const key = `img:${qid}`;
    const hit = await cacheGet(key);
    if (hit) return hit.photo;
    let photo: ArtistPhoto | null;
    try {
      photo = await fromNetwork(qid);
    } catch (e) {
      // Not cached: the next view tries again.
      if (!(e instanceof LookupFailed)) {
        console.warn("[image] lookup failed", e instanceof Error ? e.message : e);
      }
      return null;
    }
    await cacheSet(key, { photo }, photo ? photoTtl : noPhotoTtl);
    return photo;
  }

  /** The artist's photo, or null (no Wikidata link, no P18, or any failure). Never throws. */
  async function getArtistPhoto(artist: Pick<Artist, "relations">): Promise<ArtistPhoto | null> {
    try {
      const qid = wikidataQid(artist);
      if (!qid) return null;
      const pending = inflight.get(qid);
      if (pending) return await pending;
      const p = lookup(qid).finally(() => inflight.delete(qid));
      inflight.set(qid, p);
      return await p;
    } catch {
      return null;
    }
  }

  return { userAgent, getArtistPhoto };
}

let defaultLookup: ReturnType<typeof createImageLookup> | undefined;

/** Photo lookup with the process-wide cache (created on first use). */
export function getArtistPhoto(artist: Pick<Artist, "relations">): Promise<ArtistPhoto | null> {
  defaultLookup ??= createImageLookup({ cache: getAppCache().mb });
  return defaultLookup.getArtistPhoto(artist);
}
