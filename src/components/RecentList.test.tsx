import { cleanup, fireEvent, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderWithRouter } from "@/test/render-with-router";
import { RecentList } from "./RecentList";

const items = [
  { mbid: "a", name: "Alpha", subtitle: "Group", viewedAt: 2 },
  { mbid: "b", name: "Beta", viewedAt: 1 },
];

afterEach(cleanup);

describe("RecentList", () => {
  it("renders nothing when empty", async () => {
    await renderWithRouter(<RecentList items={[]} onClear={() => {}} />);
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.queryByText(/recently viewed/i)).not.toBeInTheDocument();
  });

  it("renders each item as a link to its artist page", async () => {
    await renderWithRouter(<RecentList items={items} onClear={() => {}} />);
    const alpha = screen.getByRole("link", { name: /Alpha/ });
    const beta = screen.getByRole("link", { name: /Beta/ });
    expect(alpha.tagName).toBe("A");
    expect(alpha).toHaveAttribute("href", "/artist/a");
    expect(beta).toHaveAttribute("href", "/artist/b");
    expect(screen.getAllByRole("link")).toHaveLength(items.length);
  });

  it("navigates client-side on click", async () => {
    const { router } = await renderWithRouter(<RecentList items={items} onClear={() => {}} />);
    fireEvent.click(screen.getByRole("link", { name: /Beta/ }));
    expect(await screen.findByText("artist page")).toBeInTheDocument();
    expect(router.state.location.pathname).toBe("/artist/b");
  });

  it("keeps Clear as a button and fires onClear", async () => {
    const onClear = vi.fn();
    await renderWithRouter(<RecentList items={items} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
