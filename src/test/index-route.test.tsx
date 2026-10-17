import { QueryClient } from "@tanstack/react-query";
import {
  createMemoryHistory,
  createRootRouteWithContext,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from "@tanstack/react-router";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const lookupByUrl = vi.fn();
vi.mock("@/lib/api", () => ({
  lookupByUrl: (...a: unknown[]) => lookupByUrl(...a),
  searchByName: vi.fn().mockResolvedValue([]),
}));

import { Route } from "@/routes/index";
import { FEATURED } from "@/data/featured";
import { RECENT_KEY } from "@/hooks/use-recent";

function mount(path: string) {
  const root = createRootRouteWithContext<{ queryClient: QueryClient }>()({ component: Outlet });
  const index = Route.update({ id: "/", path: "/", getParentRoute: () => root } as never);
  const artist = createRoute({
    getParentRoute: () => root,
    path: "/artist/$mbid",
    component: () => <p>artist page</p>,
  });
  const router = createRouter({
    routeTree: root.addChildren([index, artist]),
    history: createMemoryHistory({ initialEntries: [path] }),
    context: { queryClient: new QueryClient() },
  });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  cleanup();
  lookupByUrl.mockReset();
});

describe("home route", () => {
  it("idle: shows the search box, featured artists and how-it-works, no recent list", async () => {
    mount("/");
    expect(await screen.findByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText(FEATURED[0]!.name)).toBeInTheDocument();
    expect(screen.getByText(/how it works/i)).toBeInTheDocument();
    expect(screen.queryByText(/recently viewed/i)).not.toBeInTheDocument();
  });

  it("idle: lists recently viewed artists from localStorage", async () => {
    localStorage.setItem(
      RECENT_KEY,
      JSON.stringify([{ mbid: "m1", name: "Zed Artist", viewedAt: 1 }]),
    );
    mount("/");
    expect(await screen.findByText("Zed Artist")).toBeInTheDocument();
  });

  it("found: redirects ?url= to the artist page", async () => {
    lookupByUrl.mockResolvedValue({ status: "found", mbid: "abc" });
    const router = mount("/?url=https://open.spotify.com/artist/x");
    expect(await screen.findByText("artist page")).toBeInTheDocument();
    expect(lookupByUrl).toHaveBeenCalledWith({
      data: { url: "https://open.spotify.com/artist/x" },
    });
    expect(router.state.location.pathname).toBe("/artist/abc");
  });

  it("unsupported: asks for an artist profile link", async () => {
    lookupByUrl.mockResolvedValue({ status: "unsupported" });
    mount("/?url=https://open.spotify.com/track/x");
    expect(await screen.findByText(/track, album or playlist/i)).toBeInTheDocument();
  });

  it("notfound: points to name search", async () => {
    lookupByUrl.mockResolvedValue({ status: "notfound" });
    mount("/?url=https://example.com/nobody");
    expect(await screen.findByText(/couldn't find an artist for that url/i)).toBeInTheDocument();
  });

  it("error: shows the message", async () => {
    lookupByUrl.mockRejectedValue(new Error("Couldn't reach MusicBrainz."));
    mount("/?url=https://example.com/x");
    expect(await screen.findByText("Couldn't reach MusicBrainz.")).toBeInTheDocument();
  });
});
