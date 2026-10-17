import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Artist } from "@/lib/types";

const fetchArtist = vi.fn();
vi.mock("@/lib/api", () => ({ fetchArtist: (...a: unknown[]) => fetchArtist(...a) }));

import { Route, artistDescription, artistHead, artistJsonLd } from "@/routes/artist.$mbid";

const MBID = "a74b1b7f-71a5-4011-9441-d0b5e4122711";
const radiohead: Artist = {
  id: MBID,
  name: "Radiohead",
  type: "Group",
  country: "GB",
  relations: [
    {
      type: "streaming",
      url: { resource: "https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb" },
    },
    { type: "official homepage", url: { resource: "https://radiohead.com/" } },
  ],
};

afterEach(() => {
  cleanup();
  fetchArtist.mockReset();
});

describe("artist head", () => {
  it("builds title, description, og tags and canonical from the origin", () => {
    const head = artistHead(radiohead, "https://links.example", `/artist/${MBID}`);
    const url = `https://links.example/artist/${MBID}`;
    expect(head.meta).toContainEqual({ title: "Radiohead — all links | Artist Links" });
    expect(head.meta).toContainEqual({
      name: "description",
      content: "Streaming, social and official links for Radiohead (Group, GB).",
    });
    expect(head.meta).toContainEqual({ property: "og:url", content: url });
    expect(head.meta).toContainEqual({ property: "og:type", content: "website" });
    expect(head.links).toEqual([{ rel: "canonical", href: url }]);
  });

  it("omits canonical and og:url when no origin is known", () => {
    const head = artistHead(radiohead, null, `/artist/${MBID}`);
    expect(head.links).toEqual([]);
    expect(head.meta.some((m) => "property" in m && m.property === "og:url")).toBe(false);
  });

  it("keeps the description within 160 characters", () => {
    const long = { ...radiohead, name: "A".repeat(300) };
    expect(artistDescription(long).length).toBeLessThanOrEqual(160);
  });

  it("emits JSON-LD with sameAs links and the right type", () => {
    const ld = artistJsonLd(radiohead, "https://x/y");
    expect(ld["@type"]).toBe("MusicGroup");
    expect(ld["sameAs"]).toEqual([
      "https://open.spotify.com/artist/4Z8W4fKeB5YxbusRsdQVPb",
      "https://radiohead.com/",
    ]);
    expect(artistJsonLd({ ...radiohead, type: "Person" }, null)["@type"]).toBe("Person");
  });
});

function mount(path: string) {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({ component: Outlet });
  const artistRoute = Route.update({
    id: "/artist/$mbid",
    path: "/artist/$mbid",
    getParentRoute: () => root,
  } as never);
  const router = createRouter({
    routeTree: root.addChildren([artistRoute]),
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient: new QueryClient() },
  });
  render(<RouterProvider router={router} />);
}

describe("artist route component", () => {
  it("renders the artist with chrome and MusicBrainz credit", async () => {
    fetchArtist.mockResolvedValue(radiohead);
    mount(`/artist/${MBID}`);
    expect(await screen.findByRole("heading", { name: "Radiohead" })).toBeInTheDocument();
    expect(fetchArtist).toHaveBeenCalledWith({ data: { mbid: MBID } });
    expect(screen.getByRole("link", { name: "Artist Links" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "MusicBrainz" })).toBeInTheDocument();
  });

  it("shows the not-found state when the artist does not exist", async () => {
    fetchArtist.mockResolvedValue(null);
    mount("/artist/nope");
    expect(await screen.findByText("Artist not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Search for an artist" })).toHaveAttribute("href", "/");
  });

  it("shows the error state with a retry button", async () => {
    fetchArtist.mockRejectedValue(new Error("Couldn't reach MusicBrainz."));
    mount(`/artist/${MBID}`);
    expect(await screen.findByText("Couldn't reach MusicBrainz.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
