import { afterEach, describe, expect, it, vi } from "vitest";

import { version as packageVersion } from "../../package.json";
import { getPublicConfig } from "./config";

const KEYS = [
  "SITE_URL",
  "SENTRY_DSN",
  "SENTRY_ENVIRONMENT",
  "SENTRY_RELEASE",
  "APP_VERSION",
  "UMAMI_SCRIPT_URL",
  "UMAMI_WEBSITE_ID",
];

afterEach(() => vi.unstubAllEnvs());

describe("getPublicConfig", () => {
  it("returns null for unset or empty values", () => {
    for (const k of KEYS) vi.stubEnv(k, "");
    vi.stubEnv("NODE_ENV", "development");
    expect(getPublicConfig()).toEqual({
      siteUrl: null,
      sentryDsn: null,
      environment: "development",
      release: `v${packageVersion}`,
      umamiScriptUrl: null,
      umamiWebsiteId: null,
      umamiDomains: null,
    });
  });

  it("reads values at call time and trims the site url slash", () => {
    vi.stubEnv("SITE_URL", "https://links.example.com/");
    vi.stubEnv("SENTRY_DSN", "https://k@bug.example/1");
    vi.stubEnv("UMAMI_SCRIPT_URL", "https://u.example/script.js");
    vi.stubEnv("UMAMI_WEBSITE_ID", "abc");
    vi.stubEnv("SENTRY_ENVIRONMENT", "staging");
    vi.stubEnv("APP_VERSION", "v0.0.6");
    expect(getPublicConfig()).toEqual({
      siteUrl: "https://links.example.com",
      sentryDsn: "https://k@bug.example/1",
      environment: "staging",
      release: "v0.0.6",
      umamiScriptUrl: "https://u.example/script.js",
      umamiWebsiteId: "abc",
      umamiDomains: "links.example.com",
    });
  });

  it("prefers SENTRY_RELEASE, then APP_VERSION, then the package.json version", () => {
    vi.stubEnv("APP_VERSION", "v0.0.6");
    vi.stubEnv("SENTRY_RELEASE", "custom");
    expect(getPublicConfig().release).toBe("custom");
    vi.stubEnv("SENTRY_RELEASE", "");
    expect(getPublicConfig().release).toBe("v0.0.6");
    vi.stubEnv("APP_VERSION", "unknown");
    expect(getPublicConfig().release).toBe(`v${packageVersion}`);
  });
});
