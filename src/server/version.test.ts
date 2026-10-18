import { afterEach, describe, expect, it, vi } from "vitest";

import { getVersion } from "./version";

afterEach(() => vi.unstubAllEnvs());

describe("getVersion", () => {
  it("returns the trimmed APP_VERSION", () => {
    vi.stubEnv("APP_VERSION", "  v1.2.3\n");
    expect(getVersion()).toBe("v1.2.3");
  });

  it("falls back to unknown when empty or blank", () => {
    vi.stubEnv("APP_VERSION", "");
    expect(getVersion()).toBe("unknown");
    vi.stubEnv("APP_VERSION", "   ");
    expect(getVersion()).toBe("unknown");
  });

  it("falls back to unknown when unset", () => {
    vi.stubEnv("APP_VERSION", undefined);
    expect(getVersion()).toBe("unknown");
  });
});
