import { describe, expect, it } from "vitest";

import { resolveRelease, resolveVersion } from "./release";

describe("resolveRelease", () => {
  it("prefers SENTRY_RELEASE over APP_VERSION", () => {
    expect(resolveRelease("custom-1", "v0.0.6")).toBe("custom-1");
  });

  it("falls back to APP_VERSION", () => {
    expect(resolveRelease(undefined, "v0.0.6")).toBe("v0.0.6");
    expect(resolveRelease("  ", " v0.0.6 ")).toBe("v0.0.6");
  });

  it("returns null when nothing real is set", () => {
    expect(resolveRelease(undefined, undefined)).toBeNull();
    expect(resolveRelease("", "")).toBeNull();
    expect(resolveRelease(undefined, "unknown")).toBeNull();
  });
});

describe("resolveVersion", () => {
  it("uses a real APP_VERSION override, trimmed", () => {
    expect(resolveVersion(" v9.9.9 ", "0.0.6")).toBe("v9.9.9");
  });

  it("falls back to the package version as a tag", () => {
    expect(resolveVersion(undefined, "0.0.6")).toBe("v0.0.6");
    expect(resolveVersion("", "0.0.6")).toBe("v0.0.6");
    expect(resolveVersion("unknown", "0.0.6")).toBe("v0.0.6");
  });
});
