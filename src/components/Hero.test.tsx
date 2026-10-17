import { render, screen } from "@testing-library/react";
import { Hero } from "./Hero";

describe("Hero", () => {
  it("shows three steps and platform chips", () => {
    render(<Hero />);
    expect(screen.getAllByRole("listitem").length).toBeGreaterThan(3);
    expect(screen.getAllByText("Spotify")[0]).toBeInTheDocument();
  });
});
