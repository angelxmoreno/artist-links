import { describe, expect, it } from "vitest";
import {
  directoryPath,
  directoryPaths,
  isLetterKey,
  letterCounts,
  letterKey,
  letterLabel,
  pageOf,
  PAGE_SIZE,
  parsePageParam,
  sortEntries,
  type DirectoryEntry,
} from "./directory";

const entry = (name: string, n = 0): DirectoryEntry => ({ mbid: `id-${name}-${n}`, name });
const many = (count: number, prefix = "A") =>
  Array.from({ length: count }, (_, i) => entry(`${prefix}${String(i).padStart(4, "0")}`, i));

describe("letterKey", () => {
  it("uses the first letter, lowercased", () => {
    expect(letterKey("Radiohead")).toBe("r");
    expect(letterKey("  björk")).toBe("b");
  });

  it("ignores accents", () => {
    expect(letterKey("Édith Piaf")).toBe("e");
    expect(letterKey("Ólafur Arnalds")).toBe("o");
  });

  it("groups digits, symbols and other alphabets under 'other'", () => {
    expect(letterKey("2Pac")).toBe("other");
    expect(letterKey("$uicideboy$")).toBe("other");
    expect(letterKey("坂本龍一")).toBe("other");
    expect(letterKey("")).toBe("other");
  });

  it("labels letters in upper case and 'other' as #", () => {
    expect(letterLabel("b")).toBe("B");
    expect(letterLabel("other")).toBe("#");
  });

  it("knows which route params are valid", () => {
    expect(isLetterKey("a")).toBe(true);
    expect(isLetterKey("other")).toBe(true);
    expect(isLetterKey("A")).toBe(false);
    expect(isLetterKey("ab")).toBe(false);
    expect(isLetterKey("1")).toBe(false);
  });
});

describe("sortEntries", () => {
  it("sorts A-Z ignoring case and accents, with names not starting A-Z last", () => {
    const names = sortEntries([entry("beta"), entry("Álvaro"), entry("alpha"), entry("Zed")]).map(
      (e) => e.name,
    );
    expect(names).toEqual(["alpha", "Álvaro", "beta", "Zed"]);
    expect(
      sortEntries([entry("2Pac"), entry("Zed"), entry("坂本龍一"), entry("Abba")]).map(
        (e) => e.name,
      ),
    ).toEqual(["Abba", "Zed", "2Pac", "坂本龍一"]);
  });

  it("keeps one entry per mbid", () => {
    const a = { mbid: "same", name: "A" };
    expect(sortEntries([a, { ...a, name: "A again" }])).toEqual([a]);
  });
});

describe("letterCounts", () => {
  it("counts per letter, in A-Z order with 'other' last, skipping empty letters", () => {
    const sorted = sortEntries([entry("Bee"), entry("Ant"), entry("Axe", 1), entry("9 Lives")]);
    expect(letterCounts(sorted)).toEqual([
      { key: "a", count: 2 },
      { key: "b", count: 1 },
      { key: "other", count: 1 },
    ]);
  });
});

describe("pageOf", () => {
  it("splits the full list into pages of PAGE_SIZE", () => {
    const sorted = sortEntries(many(PAGE_SIZE * 2 + 5));
    const first = pageOf(sorted, null, 1)!;
    const last = pageOf(sorted, null, 3)!;
    expect(first.items).toHaveLength(PAGE_SIZE);
    expect(first).toMatchObject({ page: 1, pageCount: 3, total: PAGE_SIZE * 2 + 5 });
    expect(last.items).toHaveLength(5);
    expect(last.items[0]).toEqual(sorted[PAGE_SIZE * 2]);
  });

  it("filters by letter before paginating", () => {
    const sorted = sortEntries([...many(PAGE_SIZE + 1, "A"), ...many(3, "B")]);
    const a2 = pageOf(sorted, "a", 2)!;
    expect(a2).toMatchObject({ letter: "a", page: 2, pageCount: 2, total: PAGE_SIZE + 1 });
    expect(a2.items).toHaveLength(1);
    expect(pageOf(sorted, "b", 1)!.items).toHaveLength(3);
  });

  it("returns null for a page outside the range", () => {
    const sorted = sortEntries(many(3));
    expect(pageOf(sorted, null, 2)).toBeNull();
    expect(pageOf(sorted, null, 0)).toBeNull();
    expect(pageOf(sorted, null, 1.5)).toBeNull();
  });

  it("gives an empty first page for an empty list", () => {
    expect(pageOf([], null, 1)).toEqual({
      letter: null,
      page: 1,
      pageCount: 1,
      total: 0,
      items: [],
    });
    expect(pageOf([], null, 2)).toBeNull();
  });
});

describe("parsePageParam", () => {
  it("keeps whole numbers above 1 and drops everything else", () => {
    expect(parsePageParam("3")).toEqual({ page: 3 });
    expect(parsePageParam(2)).toEqual({ page: 2 });
    for (const bad of ["1", 1, "0", "-2", "x", "2.5", undefined, null, ["2"], "1000000"])
      expect(parsePageParam(bad)).toEqual({});
  });
});

describe("directoryPath / directoryPaths", () => {
  it("gives page 1 no query string", () => {
    expect(directoryPath(null)).toBe("/artists");
    expect(directoryPath(null, 3)).toBe("/artists?page=3");
    expect(directoryPath("b", 1)).toBe("/artists/b");
    expect(directoryPath("b", 2)).toBe("/artists/b?page=2");
  });

  it("lists /artists alone when the directory is empty", () => {
    expect(directoryPaths([])).toEqual(["/artists"]);
  });

  it("lists the full list's pages and each non-empty letter's pages", () => {
    const sorted = sortEntries([...many(PAGE_SIZE + 1, "A"), entry("Bee")]);
    expect(directoryPaths(sorted)).toEqual([
      "/artists",
      "/artists?page=2",
      "/artists/a",
      "/artists/a?page=2",
      "/artists/b",
    ]);
  });
});
