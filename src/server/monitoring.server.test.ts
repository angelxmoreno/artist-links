import { version as packageVersion } from "../../package.json";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.fn();
const captureException = vi.fn();
vi.mock("@sentry/node", () => ({ init, captureException, flush: vi.fn() }));

beforeEach(() => {
  vi.resetModules();
  init.mockClear();
  captureException.mockClear();
});
afterEach(() => vi.unstubAllEnvs());

describe("server monitoring release", () => {
  it("uses APP_VERSION as the release when SENTRY_RELEASE is unset", async () => {
    vi.stubEnv("SENTRY_DSN", "https://k@bug.example/1");
    vi.stubEnv("SENTRY_RELEASE", "");
    vi.stubEnv("APP_VERSION", "v0.0.6");
    const { captureServerException } = await import("./monitoring.server");
    const err = new Error("boom");
    await captureServerException(err);
    expect(init.mock.calls[0]![0]).toMatchObject({ release: "v0.0.6" });
    expect(captureException).toHaveBeenCalledWith(err);
  });

  it("prefers SENTRY_RELEASE", async () => {
    vi.stubEnv("SENTRY_DSN", "https://k@bug.example/1");
    vi.stubEnv("SENTRY_RELEASE", "custom");
    vi.stubEnv("APP_VERSION", "v0.0.6");
    const { initServerMonitoring } = await import("./monitoring.server");
    await initServerMonitoring();
    expect(init.mock.calls[0]![0]).toMatchObject({ release: "custom" });
  });

  it("falls back to the package.json version when neither is set", async () => {
    vi.stubEnv("SENTRY_DSN", "https://k@bug.example/1");
    vi.stubEnv("SENTRY_RELEASE", "");
    vi.stubEnv("APP_VERSION", "");
    const { initServerMonitoring } = await import("./monitoring.server");
    await initServerMonitoring();
    expect(init.mock.calls[0]![0].release).toBe(`v${packageVersion}`);
  });
});
