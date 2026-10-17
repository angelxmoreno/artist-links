import type { PublicConfig } from "@/lib/api-types";

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

/** Reads env at call time (never at import) so one image works in any environment. */
export function getPublicConfig(): PublicConfig {
  const siteUrl = readEnv("SITE_URL");
  return {
    siteUrl: siteUrl ? siteUrl.replace(/\/+$/, "") : null,
    sentryDsn: readEnv("SENTRY_DSN"),
    umamiScriptUrl: readEnv("UMAMI_SCRIPT_URL"),
    umamiWebsiteId: readEnv("UMAMI_WEBSITE_ID"),
  };
}
