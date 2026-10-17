import { fireEvent, render, screen } from "@testing-library/react";
import { FEATURED } from "@/data/featured";
import { FeaturedArtists } from "./FeaturedArtists";

describe("FeaturedArtists", () => {
  it("renders one button per featured artist", () => {
    render(<FeaturedArtists onPick={() => {}} />);
    expect(screen.getAllByRole("button")).toHaveLength(FEATURED.length);
    for (const a of FEATURED) {
      expect(screen.getByRole("button", { name: new RegExp(`^${a.name}`) })).toBeInTheDocument();
    }
  });

  it("calls onPick with mbid and name", () => {
    const onPick = vi.fn();
    render(<FeaturedArtists onPick={onPick} />);
    const first = FEATURED[0]!;
    fireEvent.click(screen.getByRole("button", { name: new RegExp(`^${first.name}`) }));
    expect(onPick).toHaveBeenCalledWith(first.mbid, first.name);
  });
});
