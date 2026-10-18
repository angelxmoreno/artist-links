import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FEATURED } from "@/data/featured";
import { renderWithRouter } from "@/test/render-with-router";
import { FeaturedArtists } from "./FeaturedArtists";

afterEach(cleanup);

const firstName = () => new RegExp(`^${FEATURED[0]!.name}`);

describe("FeaturedArtists", () => {
  it("renders one link per featured artist, pointing at its artist page", async () => {
    await renderWithRouter(<FeaturedArtists />);
    expect(screen.getAllByRole("link")).toHaveLength(FEATURED.length);
    expect(screen.queryAllByRole("button")).toHaveLength(0);
    for (const a of FEATURED) {
      const link = screen.getByRole("link", { name: new RegExp(`^${a.name}`) });
      expect(link.tagName).toBe("A");
      expect(link).toHaveAttribute("href", `/artist/${a.mbid}`);
      expect(link).toHaveAccessibleName(`${a.name}: ${a.blurb}`);
    }
  });

  it("navigates client-side on a normal click and reports the pick", async () => {
    const onPick = vi.fn();
    const { router } = await renderWithRouter(<FeaturedArtists onPick={onPick} />);
    const first = FEATURED[0]!;
    fireEvent.click(screen.getByRole("link", { name: firstName() }));
    expect(onPick).toHaveBeenCalledWith(first.mbid, first.name);
    expect(await screen.findByText("artist page")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/artist/${first.mbid}`);
  });

  it("reports a middle-click without navigating in-app", async () => {
    const onPick = vi.fn();
    const { router } = await renderWithRouter(<FeaturedArtists onPick={onPick} />);
    const first = FEATURED[0]!;
    const link = screen.getByRole("link", { name: firstName() });
    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }));
    expect(onPick).toHaveBeenCalledTimes(1);
    expect(onPick).toHaveBeenCalledWith(first.mbid, first.name);
    expect(router.state.location.pathname).toBe("/");
  });

  it("does not report other aux buttons", async () => {
    const onPick = vi.fn();
    await renderWithRouter(<FeaturedArtists onPick={onPick} />);
    const link = screen.getByRole("link", { name: firstName() });
    fireEvent(link, new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 2 }));
    expect(onPick).not.toHaveBeenCalled();
  });
});
