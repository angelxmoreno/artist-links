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
  /** Release sent with browser and server errors: SENTRY_RELEASE, else APP_VERSION; null if neither. */
  release: string | null;
  umamiScriptUrl: string | null;
  umamiWebsiteId: string | null;
  /** Hostname Umami should record, taken from SITE_URL so dev/preview traffic is ignored. */
  umamiDomains: string | null;
}

/** An artist photo from Wikimedia Commons (via Wikidata P18), with ready-to-use URLs. */
export interface ArtistPhoto {
  /** Small image for the page header (about 250px wide). */
  thumbUrl: string;
  /** Direct, absolute image URL for og:image (about 1200px wide). */
  ogUrl: string;
  /** The file's page on Commons: author and license live there. */
  pageUrl: string;
  /** Pixel size of the image at `ogUrl`. */
  ogWidth: number;
  ogHeight: number;
}

export type { Artist };
