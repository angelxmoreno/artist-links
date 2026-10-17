import { act, renderHook } from "@testing-library/react";
import {
  addRecent,
  parseRecent,
  RECENT_CAP,
  RECENT_KEY,
  useRecent,
  type RecentArtist,
} from "./use-recent";

const mk = (n: number): RecentArtist => ({ mbid: `id-${n}`, name: `Artist ${n}`, viewedAt: n });

describe("addRecent", () => {
  it("puts newest first", () => {
    const out = addRecent([mk(1)], { mbid: "id-2", name: "B" }, 5);
    expect(out.map((r) => r.mbid)).toEqual(["id-2", "id-1"]);
    expect(out[0]?.viewedAt).toBe(5);
  });

  it("dedupes by mbid and moves to front", () => {
    const out = addRecent([mk(1), mk(2), mk(3)], { mbid: "id-3", name: "Renamed" });
    expect(out.map((r) => r.mbid)).toEqual(["id-3", "id-1", "id-2"]);
    expect(out[0]?.name).toBe("Renamed");
  });

  it("caps the list", () => {
    let list: RecentArtist[] = [];
    for (let i = 0; i < RECENT_CAP + 5; i++)
      list = addRecent(list, { mbid: `id-${i}`, name: `A${i}` });
    expect(list).toHaveLength(RECENT_CAP);
    expect(list[0]?.mbid).toBe(`id-${RECENT_CAP + 4}`);
  });

  it("does not mutate its input", () => {
    const input = [mk(1)];
    addRecent(input, { mbid: "x", name: "X" });
    expect(input).toHaveLength(1);
  });
});

describe("parseRecent", () => {
  it("returns [] for null, empty and corrupted JSON", () => {
    expect(parseRecent(null)).toEqual([]);
    expect(parseRecent("")).toEqual([]);
    expect(parseRecent("{not json")).toEqual([]);
    expect(parseRecent('{"a":1}')).toEqual([]);
  });

  it("drops invalid and duplicate entries", () => {
    const raw = JSON.stringify([
      mk(1),
      null,
      { mbid: 3 },
      { mbid: "id-1", name: "dup" },
      "x",
      mk(2),
    ]);
    expect(parseRecent(raw).map((r) => r.mbid)).toEqual(["id-1", "id-2"]);
  });
});

describe("useRecent", () => {
  beforeEach(() => localStorage.clear());

  it("hydrates from storage after mount", () => {
    localStorage.setItem(RECENT_KEY, JSON.stringify([mk(1)]));
    const { result } = renderHook(() => useRecent());
    expect(result.current.recent.map((r) => r.mbid)).toEqual(["id-1"]);
  });

  it("add persists, dedupes, and clear empties storage", () => {
    const { result } = renderHook(() => useRecent());
    act(() => result.current.add({ mbid: "a", name: "A", subtitle: "Group" }));
    act(() => result.current.add({ mbid: "b", name: "B" }));
    act(() => result.current.add({ mbid: "a", name: "A" }));
    expect(result.current.recent.map((r) => r.mbid)).toEqual(["a", "b"]);
    expect(parseRecent(localStorage.getItem(RECENT_KEY))).toHaveLength(2);
    act(() => result.current.clear());
    expect(result.current.recent).toEqual([]);
    expect(localStorage.getItem(RECENT_KEY)).toBeNull();
  });

  it("survives corrupted storage", () => {
    localStorage.setItem(RECENT_KEY, "garbage{");
    const { result } = renderHook(() => useRecent());
    expect(result.current.recent).toEqual([]);
    act(() => result.current.add({ mbid: "a", name: "A" }));
    expect(result.current.recent).toHaveLength(1);
  });

  it("survives storage that throws", () => {
    const spy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    const { result } = renderHook(() => useRecent());
    act(() => result.current.add({ mbid: "a", name: "A" }));
    expect(result.current.recent).toHaveLength(1);
    spy.mockRestore();
  });
});
