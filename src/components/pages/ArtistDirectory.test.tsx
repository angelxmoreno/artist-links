import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { DirectoryData } from "@/lib/directory-api";
import { letterCounts, pageOf, PAGE_SIZE, sortEntries, type DirectoryEntry } from "@/lib/directory";
import { renderWithRouter } from "@/test/render-with-router";
import { ArtistDirectory } from "./ArtistDirectory";

afterEach(cleanup);

const entry = (name: string, i = 0): DirectoryEntry => ({
  mbid: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  name,
});

function dataFor(entries: DirectoryEntry[], letter: string | null, page = 1): DirectoryData {
  const sorted = sortEntries(entries);
  return {
    letters: letterCounts(sorted),
    totalAll: sorted.length,
    page: pageOf(sorted, letter, page),
  };
}

describe("ArtistDirectory", () => {
  const entries = [entry("Bee Gees", 1), entry("Abba", 2), entry("Adele", 3), entry("9 Lives", 4)];

  it("groups artists under a heading per starting letter, A-Z", async () => {
    await renderWithRouter(<ArtistDirectory data={dataFor(entries, null)} letter={null} />);
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual(["A", "B", "#"]);
    const a = screen.getByRole("heading", { level: 2, name: "A" }).closest("section")!;
    expect(
      within(a)
        .getAllByRole("link")
        .map((l) => l.textContent),
    ).toEqual(["Abba", "Adele"]);
  });

  it("links every artist to its page with a real anchor", async () => {
    await renderWithRouter(<ArtistDirectory data={dataFor(entries, null)} letter={null} />);
    for (const e of entries)
      expect(screen.getByRole("link", { name: e.name })).toHaveAttribute(
        "href",
        `/artist/${e.mbid}`,
      );
  });

  it("links only letters that have artists, plus All", async () => {
    await renderWithRouter(<ArtistDirectory data={dataFor(entries, null)} letter={null} />);
    const nav = screen.getByRole("navigation", { name: "Browse by letter" });
    expect(within(nav).getByRole("link", { name: "All" })).toHaveAttribute("href", "/artists");
    expect(within(nav).getByRole("link", { name: "A, 2 artists" })).toHaveAttribute(
      "href",
      "/artists/a",
    );
    expect(within(nav).getByRole("link", { name: "B, 1 artist" })).toHaveAttribute(
      "href",
      "/artists/b",
    );
    expect(within(nav).getByRole("link", { name: "#, 1 artist" })).toHaveAttribute(
      "href",
      "/artists/other",
    );
    expect(within(nav).queryByRole("link", { name: /^C/ })).not.toBeInTheDocument();
  });

  it("shows only that letter's artists on a letter page", async () => {
    await renderWithRouter(<ArtistDirectory data={dataFor(entries, "a")} letter="a" />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Artists starting with A" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abba" })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Bee Gees" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "A, 2 artists" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("has no pagination when everything fits on one page", async () => {
    await renderWithRouter(<ArtistDirectory data={dataFor(entries, null)} letter={null} />);
    expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
  });

  describe("pagination", () => {
    const big = Array.from({ length: PAGE_SIZE * 2 + 1 }, (_, i) =>
      entry(`Artist ${String(i).padStart(4, "0")}`, i),
    );

    it("shows PAGE_SIZE artists, the page number and a Next link on the first page", async () => {
      await renderWithRouter(<ArtistDirectory data={dataFor(big, null, 1)} letter={null} />);
      expect(screen.getAllByRole("link", { name: /^Artist \d{4}$/ })).toHaveLength(PAGE_SIZE);
      const nav = screen.getByRole("navigation", { name: "Pagination" });
      expect(within(nav).getByText("Page 1 of 3")).toBeInTheDocument();
      expect(within(nav).queryByRole("link", { name: "Previous" })).not.toBeInTheDocument();
      const next = within(nav).getByRole("link", { name: "Next" });
      expect(next.getAttribute("href")).toMatch(/^\/artists\/?\?page=2$/);
      expect(next).toHaveAttribute("rel", "next");
    });

    it("links Previous and Next on a middle page, and Previous only on the last", async () => {
      await renderWithRouter(<ArtistDirectory data={dataFor(big, null, 2)} letter={null} />);
      let nav = screen.getByRole("navigation", { name: "Pagination" });
      expect(within(nav).getByRole("link", { name: "Previous" }).getAttribute("href")).toBe(
        "/artists",
      );
      expect(within(nav).getByRole("link", { name: "Next" }).getAttribute("href")).toMatch(
        /page=3/,
      );
      cleanup();

      await renderWithRouter(<ArtistDirectory data={dataFor(big, null, 3)} letter={null} />);
      nav = screen.getByRole("navigation", { name: "Pagination" });
      expect(screen.getAllByRole("link", { name: /^Artist \d{4}$/ })).toHaveLength(1);
      expect(within(nav).queryByRole("link", { name: "Next" })).not.toBeInTheDocument();
      expect(within(nav).getByRole("link", { name: "Previous" }).getAttribute("href")).toMatch(
        /page=2/,
      );
    });

    it("paginates inside a letter page with the letter in the links", async () => {
      await renderWithRouter(<ArtistDirectory data={dataFor(big, "a", 1)} letter="a" />);
      const next = within(screen.getByRole("navigation", { name: "Pagination" })).getByRole(
        "link",
        {
          name: "Next",
        },
      );
      expect(next.getAttribute("href")).toMatch(/^\/artists\/a\/?\?page=2$/);
    });
  });

  describe("empty state", () => {
    it("explains how artists get listed and links home", async () => {
      await renderWithRouter(<ArtistDirectory data={dataFor([], null)} letter={null} />);
      expect(screen.getByText("No artists here yet")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: "home page" })).toHaveAttribute("href", "/");
      expect(screen.queryByRole("navigation", { name: "Pagination" })).not.toBeInTheDocument();
      expect(
        screen.getByRole("heading", { level: 1, name: "Artist directory" }),
      ).toBeInTheDocument();
    });
  });
});
