import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Server functions need the Start runtime; here the handler is called directly.
vi.mock("@tanstack/react-start", () => ({
  createServerFn: () => {
    const chain = {
      inputValidator: () => chain,
      handler: (fn: (a: { data: unknown }) => unknown) => (a: { data: unknown }) => fn(a),
    };
    return chain;
  },
}));

import { FEATURED } from "@/data/featured";
import { PAGE_SIZE } from "@/lib/directory";
import { fetchDirectory } from "@/lib/directory-api";
import { directoryDescription, directoryHead, directoryTitle } from "@/lib/directory-head";
import { Route as IndexRoute } from "@/routes/artists.index";
import { Route as LetterRoute } from "@/routes/artists.$letter";
import { getAppCache, resetAppCacheForTests } from "@/server/cache.server";
import { resetDirectoryForTests } from "@/server/directory.server";

const ORIGIN = "https://links.example";
const id = (i: number) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`;

let fetchSpy: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.stubEnv("CACHE_DB_PATH", "");
  resetAppCacheForTests();
  resetDirectoryForTests();
  fetchSpy = vi.fn(() => Promise.reject(new Error("no network")));
  vi.stubGlobal("fetch", fetchSpy);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  resetAppCacheForTests();
  resetDirectoryForTests();
});

describe("fetchDirectory", () => {
  it("serves the Featured artists on a fresh install, without any network call", async () => {
    const data = await fetchDirectory({ data: { page: 1 } });
    expect(data.page?.items).toHaveLength(FEATURED.length);
    expect(data.totalAll).toBe(FEATURED.length);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("adds viewed artists by name and caps a page at PAGE_SIZE", async () => {
    const cache = getAppCache();
    for (let i = 0; i < PAGE_SIZE + 20; i++)
      await cache.recordViewed(id(i), `Zz ${String(i).padStart(4, "0")}`);
    const first = await fetchDirectory({ data: { page: 1 } });
    const second = await fetchDirectory({ data: { page: 2 } });
    expect(first.page!.items).toHaveLength(PAGE_SIZE);
    expect(first.page!.pageCount).toBe(2);
    expect(second.page!.items.length).toBe(FEATURED.length + 20);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("filters by letter and reports letter counts", async () => {
    await getAppCache().recordViewed(id(1), "Zebra");
    const z = await fetchDirectory({ data: { letter: "z", page: 1 } });
    expect(z.page?.items.map((e) => e.name)).toEqual(["Zebra"]);
    expect(z.letters.find((l) => l.key === "z")?.count).toBe(1);
  });

  it("returns no page for an unknown letter, an empty letter or a page out of range", async () => {
    expect((await fetchDirectory({ data: { letter: "Z", page: 1 } })).page).toBeNull();
    expect((await fetchDirectory({ data: { letter: "zz", page: 1 } })).page).toBeNull();
    expect((await fetchDirectory({ data: { letter: "q", page: 1 } })).page).toBeNull();
    expect((await fetchDirectory({ data: { page: 2 } })).page).toBeNull();
  });
});

describe("directory head", () => {
  const sample = async (letter: string | null, page: number) => {
    const data = await fetchDirectory({ data: { ...(letter ? { letter } : {}), page } });
    return {
      data,
      head: directoryHead(data, letter, ORIGIN) as ReturnType<typeof directoryHead> & {
        meta: Record<string, unknown>[];
        links: { rel: string; href: string }[];
      },
    };
  };

  it("uses /artists as the canonical URL of the first page", async () => {
    const { head } = await sample(null, 1);
    expect(head.links).toEqual([{ rel: "canonical", href: `${ORIGIN}/artists` }]);
    expect(head.meta).toContainEqual({ property: "og:url", content: `${ORIGIN}/artists` });
  });

  it("gives a later page its own canonical plus prev and next", async () => {
    const cache = getAppCache();
    for (let i = 0; i < PAGE_SIZE * 2; i++)
      await cache.recordViewed(id(i), `Zz ${String(i).padStart(4, "0")}`);
    const { head } = await sample(null, 2);
    expect(head.links).toEqual([
      { rel: "canonical", href: `${ORIGIN}/artists?page=2` },
      { rel: "prev", href: `${ORIGIN}/artists` },
      { rel: "next", href: `${ORIGIN}/artists?page=3` },
    ]);
    const title = head.meta.find((m) => "title" in m)!["title"] as string;
    expect(title).toContain("page 2");
  });

  it("puts the letter in the title, description and canonical of a letter page", async () => {
    const letter = FEATURED[0]!.name[0]!.toLowerCase();
    const { head } = await sample(letter, 1);
    expect(head.links).toEqual([{ rel: "canonical", href: `${ORIGIN}/artists/${letter}` }]);
    expect(directoryTitle(letter, 1)).toBe(
      `Artists starting with ${letter.toUpperCase()} | Artist Links`,
    );
    expect(directoryDescription(letter, 3)).toContain(`starts with ${letter.toUpperCase()}`);
  });

  it("describes the page's artists as a CollectionPage with an ItemList", async () => {
    const { head } = await sample(null, 1);
    const ld = head.meta.find((m) => "script:ld+json" in m)!["script:ld+json"] as {
      "@type": string;
      mainEntity: { itemListElement: { position: number; url: string }[]; numberOfItems: number };
    };
    expect(ld["@type"]).toBe("CollectionPage");
    expect(ld.mainEntity.numberOfItems).toBe(FEATURED.length);
    expect(ld.mainEntity.itemListElement[0]).toMatchObject({ position: 1 });
    expect(ld.mainEntity.itemListElement.every((i) => i.url.startsWith(`${ORIGIN}/artist/`))).toBe(
      true,
    );
  });

  it("has exactly one title, description and og:title", async () => {
    const { head } = await sample(null, 1);
    expect(head.meta.filter((m) => "title" in m)).toHaveLength(1);
    expect(head.meta.filter((m) => m["name"] === "description")).toHaveLength(1);
    expect(head.meta.filter((m) => m["property"] === "og:title")).toHaveLength(1);
  });

  it("returns nothing for a missing page", () => {
    expect(directoryHead({ letters: [], totalAll: 0, page: null }, null, ORIGIN)).toEqual({});
  });
});

describe("route search validation", () => {
  const validate = (route: unknown, search: Record<string, unknown>) =>
    (
      route as { options: { validateSearch: (s: Record<string, unknown>) => unknown } }
    ).options.validateSearch(search);

  it("keeps ?page= only when it is a whole number above 1", () => {
    for (const route of [IndexRoute, LetterRoute]) {
      expect(validate(route, { page: "2" })).toEqual({ page: 2 });
      expect(validate(route, { page: "1" })).toEqual({});
      expect(validate(route, { page: "abc" })).toEqual({});
      expect(validate(route, {})).toEqual({});
    }
  });
});
