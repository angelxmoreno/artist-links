import { FEATURED } from "./featured";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe("FEATURED", () => {
  it("has a sensible number of entries", () => {
    expect(FEATURED.length).toBeGreaterThanOrEqual(8);
    expect(FEATURED.length).toBeLessThanOrEqual(12);
  });

  it("has unique UUID mbids", () => {
    const ids = FEATURED.map((a) => a.mbid);
    ids.forEach((id) => expect(id).toMatch(UUID));
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has non-empty names and short blurbs", () => {
    for (const a of FEATURED) {
      expect(a.name.trim()).not.toBe("");
      expect(a.blurb.trim()).not.toBe("");
      expect(a.blurb.split(/\s+/).length).toBeLessThanOrEqual(8);
    }
  });
});
