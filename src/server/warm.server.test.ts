import { describe, expect, it, vi } from "vitest";

import { warmFeatured } from "./warm.server";

describe("warmFeatured", () => {
  it("fetches every artist in order and survives failures", async () => {
    const fetchArtist = vi.fn().mockRejectedValueOnce(new Error("boom")).mockResolvedValue({});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    await warmFeatured(fetchArtist, [
      { mbid: "a", name: "A" },
      { mbid: "b", name: "B" },
    ]);
    expect(fetchArtist.mock.calls.map((c) => c[0])).toEqual(["a", "b"]);
  });
});
