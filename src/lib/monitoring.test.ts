import { beforeEach, describe, expect, it, vi } from "vitest";

const init = vi.fn();
const captureException = vi.fn();
vi.mock("@sentry/react", () => ({ init, captureException }));

beforeEach(() => {
  vi.resetModules();
  init.mockClear();
  captureException.mockClear();
});

describe("initClientMonitoring", () => {
  it("passes the release to Sentry and captures errors afterwards", async () => {
    const { initClientMonitoring, captureClientException } = await import("./monitoring");
    initClientMonitoring("https://k@bug.example/1", "production", "v0.0.6");
    expect(init).toHaveBeenCalledOnce();
    expect(init.mock.calls[0]![0]).toMatchObject({ environment: "production", release: "v0.0.6" });
    const err = new Error("boom");
    captureClientException(err);
    expect(captureException).toHaveBeenCalledWith(err);
  });

  it("omits release when there is none", async () => {
    const { initClientMonitoring } = await import("./monitoring");
    initClientMonitoring("https://k@bug.example/1", "production", null);
    expect(init.mock.calls[0]![0]).not.toHaveProperty("release");
  });

  it("does nothing without a DSN", async () => {
    const { initClientMonitoring, captureClientException } = await import("./monitoring");
    initClientMonitoring(null, "production", "v0.0.6");
    captureClientException(new Error("x"));
    expect(init).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });
});
