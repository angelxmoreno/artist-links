import { afterEach, describe, expect, it, vi } from "vitest";

import { track } from "./analytics";

afterEach(() => {
  delete window.umami;
});

describe("track", () => {
  it("no-ops when umami is missing", () => {
    expect(() => track("lookup_url")).not.toThrow();
  });

  it("forwards event and props to umami", () => {
    const fn = vi.fn();
    window.umami = { track: fn };
    track("link_click", { platform: "spotify", position: 2 });
    expect(fn).toHaveBeenCalledWith("link_click", { platform: "spotify", position: 2 });
  });

  it("swallows umami errors", () => {
    window.umami = {
      track: () => {
        throw new Error("boom");
      },
    };
    expect(() => track("artist_view")).not.toThrow();
  });
});
