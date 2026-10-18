import { afterEach, describe, expect, it, vi } from "vitest";

import { Route } from "@/routes/healthz";

afterEach(() => vi.unstubAllEnvs());

async function get() {
  const handlers = Route.options.server?.handlers as unknown as {
    GET: (ctx: unknown) => Promise<Response>;
  };
  return handlers.GET({ request: new Request("http://localhost/healthz") });
}

describe("GET /healthz", () => {
  it("returns ok JSON with the deployed version and no-store", async () => {
    vi.stubEnv("APP_VERSION", "v9.9.9");
    const res = await get();

    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(res.headers.get("content-type")).toContain("application/json");
    expect(await res.json()).toEqual({ status: "ok", version: "v9.9.9" });
  });

  it("reports unknown when APP_VERSION is unset", async () => {
    vi.stubEnv("APP_VERSION", "");
    expect(await (await get()).json()).toEqual({ status: "ok", version: "unknown" });
  });
});
