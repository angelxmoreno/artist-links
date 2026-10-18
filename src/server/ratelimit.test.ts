import { describe, expect, it } from "vitest";
import { clientKey, createRateLimiter, limitHook, RATE_LIMITED_MESSAGE } from "./ratelimit";

function setup(o: Parameters<typeof createRateLimiter>[0] = {}) {
  let t = 1_000_000;
  const rl = createRateLimiter({ limit: 3, windowMs: 1000, now: () => t, ...o });
  return { rl, advance: (ms: number) => (t += ms) };
}

describe("createRateLimiter", () => {
  it("allows up to the limit then refuses", () => {
    const { rl } = setup();
    expect([1, 2, 3, 4, 5].map(() => rl.consume("a"))).toEqual([true, true, true, false, false]);
  });

  it("allows again once the window has passed", () => {
    const { rl, advance } = setup();
    for (let i = 0; i < 3; i++) rl.consume("a");
    expect(rl.consume("a")).toBe(false);
    advance(999);
    expect(rl.consume("a")).toBe(false);
    advance(1);
    expect(rl.consume("a")).toBe(true);
  });

  it("slides: only requests that left the window are freed", () => {
    const { rl, advance } = setup();
    rl.consume("a");
    advance(600);
    rl.consume("a");
    rl.consume("a");
    advance(400); // the first one has expired, the other two have not
    expect(rl.consume("a")).toBe(true);
    expect(rl.consume("a")).toBe(false);
  });

  it("does not record refused requests", () => {
    const { rl, advance } = setup();
    for (let i = 0; i < 10; i++) rl.consume("a");
    advance(1000);
    expect(rl.consume("a")).toBe(true);
  });

  it("keeps IPs independent", () => {
    const { rl } = setup();
    for (let i = 0; i < 3; i++) rl.consume("a");
    expect(rl.consume("a")).toBe(false);
    expect(rl.consume("b")).toBe(true);
  });

  it("bounds memory: evicts the oldest key, and sweeps expired ones when full", () => {
    const { rl, advance } = setup({ maxKeys: 3 });
    rl.consume("a");
    rl.consume("b");
    rl.consume("c");
    expect(rl.size()).toBe(3);
    rl.consume("d"); // full and nothing expired: evicts "a"
    expect(rl.size()).toBe(3);
    advance(2000);
    rl.consume("e"); // sweeps the expired ones
    expect(rl.size()).toBe(1);
  });

  it("an evicted key starts fresh", () => {
    const { rl } = setup({ maxKeys: 1, limit: 1 });
    expect(rl.consume("a")).toBe(true);
    expect(rl.consume("a")).toBe(false);
    rl.consume("b"); // evicts "a"
    expect(rl.consume("a")).toBe(true);
  });
});

describe("limitHook", () => {
  it("throws a friendly error when over the limit", () => {
    const { rl } = setup({ limit: 1 });
    const hook = limitHook("a", rl);
    expect(() => hook()).not.toThrow();
    expect(() => hook()).toThrow(RATE_LIMITED_MESSAGE);
  });
});

describe("clientKey", () => {
  const headers = (h: Record<string, string>) => (name: string) => h[name];

  it("prefers cf-connecting-ip", () => {
    expect(
      clientKey(headers({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" })),
    ).toBe("1.1.1.1");
  });

  it("falls back to the first x-forwarded-for entry", () => {
    expect(clientKey(headers({ "x-forwarded-for": " 2.2.2.2 , 3.3.3.3" }))).toBe("2.2.2.2");
  });

  it("falls back to a shared bucket", () => {
    expect(clientKey(headers({}))).toBe("shared");
    expect(clientKey(headers({ "cf-connecting-ip": " ", "x-forwarded-for": "" }))).toBe("shared");
  });

  it("caps the key length", () => {
    expect(clientKey(headers({ "cf-connecting-ip": "x".repeat(500) }))).toHaveLength(64);
  });
});
