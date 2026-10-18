import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { ArtistPhoto } from "@/lib/api-types";
import type { Artist } from "@/lib/types";
import { ArtistView } from "./ArtistView";

afterEach(cleanup);

const artist: Artist = {
  id: "a74b1b7f-71a5-4011-9441-d0b5e4122711",
  name: "Radiohead",
  type: "Group",
  country: "GB",
  relations: [{ type: "official homepage", url: { resource: "https://radiohead.com/" } }],
};

const photo: ArtistPhoto = {
  thumbUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/R.jpg/250px-R.jpg",
  ogUrl: "https://thumb.wikimedia.org/wikipedia/commons/thumb/a/a1/R.jpg/1280px-R.jpg",
  pageUrl: "https://commons.wikimedia.org/wiki/File:R.jpg",
  ogWidth: 1280,
  ogHeight: 465,
};

describe("ArtistView photo", () => {
  it("shows the photo with the artist name as alt, a size, and a Commons caption", () => {
    render(<ArtistView artist={artist} photo={photo} />);
    const img = screen.getByRole("img", { name: "Radiohead" });
    expect(img).toHaveAttribute("src", photo.thumbUrl);
    expect(img).toHaveAttribute("width", "80");
    expect(img).toHaveAttribute("height", "80");
    expect(img).not.toHaveAttribute("loading");
    const caption = screen.getByRole("link", { name: "Photo via Wikimedia Commons" });
    expect(caption).toHaveAttribute("href", photo.pageUrl);
    expect(caption).toHaveAttribute("target", "_blank");
    expect(caption.getAttribute("rel")).toContain("noopener");
  });

  it.each([undefined, null])("looks like before when the photo is %s", (value) => {
    render(<ArtistView artist={artist} photo={value} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText(/Wikimedia Commons/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Radiohead" })).toBeInTheDocument();
  });

  it("hides the photo and caption when the image fails to load", () => {
    render(<ArtistView artist={artist} photo={photo} />);
    fireEvent.error(screen.getByRole("img", { name: "Radiohead" }));
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(screen.queryByText(/Wikimedia Commons/)).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Radiohead" })).toBeInTheDocument();
  });
});
