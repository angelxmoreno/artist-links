// Server functions: the only way the browser talks to MusicBrainz.
// The server module is imported dynamically inside handlers so it never ends
// up in the client bundle.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Artist, LookupResult } from "./api-types";

const SAFE_FALLBACK = "Couldn't reach MusicBrainz. Check your connection or try again in a moment.";

// Only messages we authored reach the browser; anything unexpected is masked.
async function run<T>(
  fn: (mb: typeof import("../server/musicbrainz.server")) => Promise<T>,
): Promise<T> {
  const mb = await import("../server/musicbrainz.server");
  try {
    return await fn(mb);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const safe = new Set([
      mb.UNREACHABLE_MESSAGE,
      mb.INVALID_LINK_MESSAGE,
      "Enter an artist name to search.",
      "That search is too long.",
    ]);
    if (!safe.has(msg)) console.error("[api]", e);
    throw new Error(safe.has(msg) ? msg : SAFE_FALLBACK);
  }
}

export const lookupByUrl = createServerFn({ method: "GET" })
  .inputValidator(z.object({ url: z.string().max(2000) }))
  .handler(({ data }): Promise<LookupResult> => run((mb) => mb.lookupByUrl(data.url)));

export const fetchArtist = createServerFn({ method: "GET" })
  .inputValidator(z.object({ mbid: z.string().max(64) }))
  .handler(({ data }): Promise<Artist | null> => run((mb) => mb.getArtist(data.mbid)));

export const searchByName = createServerFn({ method: "GET" })
  .inputValidator(z.object({ q: z.string().max(500) }))
  .handler(({ data }): Promise<Artist[]> => run((mb) => mb.searchArtists(data.q)));
