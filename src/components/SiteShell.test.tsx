import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { REPO_URL, SITE_PAGES } from "@/lib/nav";
import { renderWithRouter } from "@/test/render-with-router";
import { SiteShell } from "./SiteShell";

afterEach(cleanup);

describe("SiteShell navigation", () => {
  it("links every site page from the footer", async () => {
    await renderWithRouter(<SiteShell>content</SiteShell>);
    const footer = screen.getByRole("navigation", { name: "Footer" });
    for (const page of SITE_PAGES)
      expect(within(footer).getByRole("link", { name: page.label })).toHaveAttribute(
        "href",
        page.to,
      );
    expect(within(footer).getByRole("link", { name: "Home" })).toHaveAttribute("href", "/");
  });

  it("links the main pages from the header", async () => {
    await renderWithRouter(<SiteShell>content</SiteShell>);
    const header = screen.getByRole("navigation", { name: "Main" });
    for (const label of ["About", "How it works", "Platforms", "Artists"])
      expect(within(header).getByRole("link", { name: label })).toBeInTheDocument();
  });

  it("keeps the logo link home, the MusicBrainz credit and the repo link", async () => {
    await renderWithRouter(<SiteShell>content</SiteShell>);
    expect(screen.getByRole("link", { name: "Artist Links" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "MusicBrainz" })).toHaveAttribute(
      "href",
      "https://musicbrainz.org",
    );
    expect(screen.getByRole("link", { name: /open source on github/i })).toHaveAttribute(
      "href",
      REPO_URL,
    );
  });

  it("renders its children inside main", async () => {
    await renderWithRouter(<SiteShell>page body</SiteShell>);
    expect(within(screen.getByRole("main")).getByText("page body")).toBeInTheDocument();
  });

  it("has two labelled navigation landmarks", async () => {
    await renderWithRouter(<SiteShell>content</SiteShell>);
    expect(screen.getAllByRole("navigation")).toHaveLength(2);
  });
});
