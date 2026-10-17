import type { PublicConfig } from "@/lib/api-types";

function readEnv(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

export function sentryEnvironment(): string {
  return readEnv("SENTRY_ENVIRONMENT") ?? readEnv("NODE_ENV") ?? "production";
}

function hostnameOf(url: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** Reads env at call time (never at import) so one image works in any environment. */
export function getPublicConfig(): PublicConfig {
  const siteUrl = readEnv("SITE_URL");
  return {
    siteUrl: siteUrl ? siteUrl.replace(/\/+$/, "") : null,
    sentryDsn: readEnv("SENTRY_DSN"),
    environment: sentryEnvironment(),
    umamiScriptUrl: readEnv("UMAMI_SCRIPT_URL"),
    umamiWebsiteId: readEnv("UMAMI_WEBSITE_ID"),
    umamiDomains: hostnameOf(siteUrl),
  };
}
