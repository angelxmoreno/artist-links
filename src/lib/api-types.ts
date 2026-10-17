// Contract between the server functions (src/lib/api.ts) and the UI.
import type { Artist } from "./types";

export type LookupResult =
  | { status: "found"; mbid: string }
  | { status: "notfound" }
  | { status: "unsupported" };

/** Values safe to expose to the browser; read from env on the server at request time. */
export interface PublicConfig {
  siteUrl: string | null;
  sentryDsn: string | null;
  umamiScriptUrl: string | null;
  umamiWebsiteId: string | null;
}

export type { Artist };
