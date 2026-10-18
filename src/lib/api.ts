// Server functions: the only way the browser talks to MusicBrainz.
// The server module is imported dynamically inside handlers so it never ends
// up in the client bundle.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { Artist, LookupResult } from "./api-types";

const SAFE_FALLBACK = "Couldn't reach MusicBrainz. Check your connection or try again in a moment.";

type Mb = typeof import("../server/musicbrainz.server");
type Ctx = import("../server/musicbrainz.server").CallContext;

// The key only counts requests per visitor; the pasted URL is never logged or sent anywhere.
async function currentClientKey(): Promise<string> {
  const { clientKey } = await import("../server/ratelimit");
  try {
    const { getRequestHeader } = await import("@tanstack/react-start/server");
    return clientKey((name) => getRequestHeader(name as "x-forwarded-for"));
  } catch {
    return clientKey(() => undefined);
  }
}

// Only messages we authored reach the browser; anything unexpected is masked.
// The rate limit is applied lazily (ctx.beforeNetwork), so cache hits never count.
async function run<T>(fn: (mb: Mb, ctx: Ctx) => Promise<T>): Promise<T> {
  const mb = await import("../server/musicbrainz.server");
  const { limitHook, RATE_LIMITED_MESSAGE } = await import("../server/ratelimit");
  try {
    return await fn(mb, { beforeNetwork: limitHook(await currentClientKey()) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const safe = new Set([
      mb.UNREACHABLE_MESSAGE,
      mb.INVALID_LINK_MESSAGE,
      mb.BUSY_MESSAGE,
      RATE_LIMITED_MESSAGE,
      "Enter an artist name to search.",
      "That search is too long.",
    ]);
    if (!safe.has(msg)) console.error("[api]", e);
    throw new Error(safe.has(msg) ? msg : SAFE_FALLBACK);
  }
}

export const lookupByUrl = createServerFn({ method: "GET" })
  .inputValidator(z.object({ url: z.string().max(2000) }))
  .handler(({ data }): Promise<LookupResult> => run((mb, ctx) => mb.lookupByUrl(data.url, ctx)));

// Remember the artist for the sitemap. Fire and forget: never awaited, never throws.
function recordForSitemap(artist: Artist): void {
  void import("../server/cache.server").then((c) => c.recordViewedIfLinked(artist)).catch(() => {});
}

export const fetchArtist = createServerFn({ method: "GET" })
  .inputValidator(z.object({ mbid: z.string().max(64) }))
  .handler(({ data }): Promise<Artist | null> =>
    run(async (mb, ctx) => {
      const artist = await mb.getArtist(data.mbid, ctx);
      if (artist) recordForSitemap(artist);
      return artist;
    }),
  );

export const searchByName = createServerFn({ method: "GET" })
  .inputValidator(z.object({ q: z.string().max(500) }))
  .handler(({ data }): Promise<Artist[]> => run((mb, ctx) => mb.searchArtists(data.q, ctx)));
