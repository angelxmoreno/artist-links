// Pre-fills the MusicBrainz cache for the Featured artists so their pages are fast
// right after a deploy. Requests go through the normal queue (about 1 per second).
import { FEATURED } from "../data/featured";

// musicbrainz.server's OK_TTL_MS (24h) plus a minute: entries expire then, and a cache hit
// would not extend them.
const REWARM_MS = 24 * 60 * 60 * 1000 + 60_000;

export async function warmFeatured(
  warm: (mbid: string) => Promise<unknown>,
  list: { mbid: string; name: string }[] = FEATURED,
): Promise<void> {
  for (const a of list) {
    try {
      await warm(a.mbid);
    } catch (e) {
      console.warn(`[warm] ${a.name} failed`, e instanceof Error ? e.message : e);
    }
  }
}

export function startWarming(warm: (mbid: string) => Promise<unknown>): void {
  void warmFeatured(warm);
  setInterval(() => void warmFeatured(warm), REWARM_MS).unref();
}
