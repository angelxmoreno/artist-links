import { afterEach, describe, expect, it, vi } from "vitest";

import { getPublicConfig } from "./config";

const KEYS = ["SITE_URL", "SENTRY_DSN", "UMAMI_SCRIPT_URL", "UMAMI_WEBSITE_ID"];

afterEach(() => vi.unstubAllEnvs());

describe("getPublicConfig", () => {
  it("returns null for unset or empty values", () => {
    for (const k of KEYS) vi.stubEnv(k, "");
    expect(getPublicConfig()).toEqual({
      siteUrl: null,
      sentryDsn: null,
      umamiScriptUrl: null,
      umamiWebsiteId: null,
    });
  });

  it("reads values at call time and trims the site url slash", () => {
    vi.stubEnv("SITE_URL", "https://links.example.com/");
    vi.stubEnv("SENTRY_DSN", "https://k@bug.example/1");
    vi.stubEnv("UMAMI_SCRIPT_URL", "https://u.example/script.js");
    vi.stubEnv("UMAMI_WEBSITE_ID", "abc");
    expect(getPublicConfig()).toEqual({
      siteUrl: "https://links.example.com",
      sentryDsn: "https://k@bug.example/1",
      umamiScriptUrl: "https://u.example/script.js",
      umamiWebsiteId: "abc",
    });
  });
});
