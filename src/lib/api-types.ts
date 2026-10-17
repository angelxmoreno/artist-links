// Contract between the server functions (src/lib/api.ts) and the UI.
import type { Artist } from "./types";

export type LookupResult =
  { status: "found"; mbid: string } | { status: "notfound" } | { status: "unsupported" };

/** Values safe to expose to the browser; read from env on the server at request time. */
export interface PublicConfig {
  siteUrl: string | null;
  sentryDsn: string | null;
  /** Sentry/Bugsink environment tag: SENTRY_ENVIRONMENT, else NODE_ENV (development, production). */
  environment: string;
  umamiScriptUrl: string | null;
  umamiWebsiteId: string | null;
  /** Hostname Umami should record, taken from SITE_URL so dev/preview traffic is ignored. */
  umamiDomains: string | null;
}

export type { Artist };
