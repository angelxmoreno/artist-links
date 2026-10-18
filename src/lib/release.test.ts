import { describe, expect, it } from "vitest";

import { resolveRelease } from "./release";

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
