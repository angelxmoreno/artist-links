import { useCallback, useEffect, useState } from "react";

export const RECENT_KEY = "artist-links:recent";
export const RECENT_CAP = 12;

export interface RecentArtist {
  mbid: string;
  name: string;
  subtitle?: string;
  /** epoch ms when last viewed */
  viewedAt: number;
}

export type RecentInput = Pick<RecentArtist, "mbid" | "name" | "subtitle">;

/** Pure: put `artist` at the front, drop any earlier entry with the same mbid, cap the list. */
export function addRecent(
  list: RecentArtist[],
  artist: RecentInput,
  now: number = Date.now(),
  cap: number = RECENT_CAP,
): RecentArtist[] {
  const entry: RecentArtist = { ...artist, viewedAt: now };
  if (!entry.subtitle) delete entry.subtitle;
  return [entry, ...list.filter((r) => r.mbid !== artist.mbid)].slice(0, cap);
}

/** Pure: parse a stored JSON string defensively; anything malformed yields []. */
export function parseRecent(raw: string | null | undefined): RecentArtist[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const seen = new Set<string>();
    const out: RecentArtist[] = [];
    for (const item of data) {
      if (!item || typeof item !== "object") continue;
      const { mbid, name, subtitle, viewedAt } = item as Record<string, unknown>;
      if (typeof mbid !== "string" || typeof name !== "string" || !mbid || !name) continue;
      if (seen.has(mbid)) continue;
      seen.add(mbid);
      out.push({
        mbid,
        name,
        ...(typeof subtitle === "string" && subtitle ? { subtitle } : {}),
        viewedAt: typeof viewedAt === "number" ? viewedAt : 0,
      });
    }
    return out.slice(0, RECENT_CAP);
  } catch {
    return [];
  }
}

function readStorage(): RecentArtist[] {
  try {
    return parseRecent(window.localStorage.getItem(RECENT_KEY));
  } catch {
    return [];
  }
}

function writeStorage(list: RecentArtist[]) {
  try {
    if (list.length === 0) window.localStorage.removeItem(RECENT_KEY);
    else window.localStorage.setItem(RECENT_KEY, JSON.stringify(list));
  } catch {
    // storage unavailable or full: keep in-memory state only
  }
}

/**
 * Recently viewed artists, persisted per browser. Starts empty on both server
 * and first client render, then hydrates from localStorage in an effect, so
 * there is no hydration mismatch.
 */
export function useRecent() {
  const [recent, setRecent] = useState<RecentArtist[]>([]);

  useEffect(() => {
    setRecent(readStorage());
    const onStorage = (e: StorageEvent) => {
      if (e.key === RECENT_KEY || e.key === null) setRecent(readStorage());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const add = useCallback((artist: RecentInput) => {
    // Re-read storage so concurrent tabs do not clobber each other.
    const next = addRecent(readStorage(), artist);
    writeStorage(next);
    setRecent(next);
  }, []);

  const clear = useCallback(() => {
    writeStorage([]);
    setRecent([]);
  }, []);

  return { recent, add, clear };
}
