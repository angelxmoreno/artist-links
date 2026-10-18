import { afterEach, describe, expect, it, vi } from "vitest";

import { version as packageVersion } from "../../package.json";
import { getVersion } from "./version";

afterEach(() => vi.unstubAllEnvs());

describe("getVersion", () => {
  it("returns the trimmed APP_VERSION override", () => {
    vi.stubEnv("APP_VERSION", "  v1.2.3\n");
    expect(getVersion()).toBe("v1.2.3");
  });

  it("falls back to the package.json version when empty, blank, unknown or unset", () => {
    for (const value of ["", "   ", "unknown", undefined]) {
      vi.stubEnv("APP_VERSION", value);
      expect(getVersion()).toBe(`v${packageVersion}`);
    }
  });
});
