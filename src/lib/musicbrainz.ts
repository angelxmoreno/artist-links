// Browser-side MusicBrainz client. Replaced by server functions in task E4.
import { normalizeUrl, urlVariants } from "./links";
import type { Artist } from "./types";

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
