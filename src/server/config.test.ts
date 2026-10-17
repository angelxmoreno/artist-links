import { afterEach, describe, expect, it, vi } from "vitest";

import { getPublicConfig } from "./config";

const KEYS = [
  "SITE_URL",
  "SENTRY_DSN",
  "SENTRY_ENVIRONMENT",
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
    expect(getPublicConfig()).toEqual({
      siteUrl: "https://links.example.com",
      sentryDsn: "https://k@bug.example/1",
      environment: "staging",
      umamiScriptUrl: "https://u.example/script.js",
      umamiWebsiteId: "abc",
      umamiDomains: "links.example.com",
    });
  });
});
