import { fireEvent, render, screen } from "@testing-library/react";
import { RecentList } from "./RecentList";

const items = [
  { mbid: "a", name: "Alpha", subtitle: "Group", viewedAt: 2 },
  { mbid: "b", name: "Beta", viewedAt: 1 },
];

describe("RecentList", () => {
  it("renders nothing when empty", () => {
    const { container } = render(<RecentList items={[]} onPick={() => {}} onClear={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders items and fires onPick", () => {
    const onPick = vi.fn();
    render(<RecentList items={items} onPick={onPick} onClear={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: /Beta/ }));
    expect(onPick).toHaveBeenCalledWith("b");
    expect(screen.getByRole("button", { name: /Alpha/ })).toBeInTheDocument();
  });

  it("fires onClear", () => {
    const onClear = vi.fn();
    render(<RecentList items={items} onPick={() => {}} onClear={onClear} />);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });
});
