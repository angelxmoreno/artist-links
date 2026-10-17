import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SearchBox } from "./SearchBox";
import type { Artist } from "@/lib/types";

const radiohead: Artist = {
  id: "a1",
  name: "Radiohead",
  disambiguation: "UK rock band",
  country: "GB",
  "life-span": { begin: "1985", ended: false },
};
const radioheadTribute: Artist = { id: "a2", name: "Radiohead Tribute", country: "US" };
const many: Artist[] = Array.from({ length: 8 }, (_, i) => ({ id: `m${i}`, name: `Band ${i}` }));

function setup(
  search: (q: string) => Promise<Artist[]> = async () => [radiohead, radioheadTribute],
) {
  const props = {
    onSubmitUrl: vi.fn(),
    onPickArtist: vi.fn(),
    searchArtists: vi.fn(search),
  };
  render(<SearchBox {...props} />);
  const input = screen.getByRole("combobox") as HTMLInputElement;
  return { ...props, input };
}

const type = (input: HTMLElement, value: string) => fireEvent.change(input, { target: { value } });
function nth<T>(list: T[], i: number): T {
  const x = list[i];
  if (x === undefined) throw new Error(`no item at ${i}`);
  return x;
}
const flush = () =>
  act(async () => {
    await vi.advanceTimersByTimeAsync(400);
  });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("SearchBox", () => {
  it("shows placeholder, hint and Find button", () => {
    setup();
    expect(screen.getByPlaceholderText("Paste a link or type an artist name")).toBeTruthy();
    expect(screen.getByText(/Spotify, Instagram or Bandcamp link/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Find" })).toBeTruthy();
  });

  it("submits a pasted URL immediately without searching", () => {
    const { input, onSubmitUrl, searchArtists } = setup();
    fireEvent.paste(input, {
      clipboardData: { getData: () => "https://open.spotify.com/artist/123" },
    });
    expect(onSubmitUrl).toHaveBeenCalledWith("https://open.spotify.com/artist/123");
    expect(input.value).toBe("https://open.spotify.com/artist/123");
    expect(searchArtists).not.toHaveBeenCalled();
  });

  it("lets a pasted name through to normal typing (no submit)", () => {
    const { input, onSubmitUrl } = setup();
    const notPrevented = fireEvent.paste(input, { clipboardData: { getData: () => "Radiohead" } });
    expect(notPrevented).toBe(true);
    expect(onSubmitUrl).not.toHaveBeenCalled();
  });

  it("submits a typed URL on Enter and via Find", () => {
    const { input, onSubmitUrl, searchArtists } = setup();
    type(input, "foo.bandcamp.com");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmitUrl).toHaveBeenCalledWith("foo.bandcamp.com");
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(onSubmitUrl).toHaveBeenCalledTimes(2);
    expect(searchArtists).not.toHaveBeenCalled();
  });

  it("debounces name search by 400ms and needs >= 2 chars", async () => {
    const { input, searchArtists } = setup();
    type(input, "R");
    await flush();
    expect(searchArtists).not.toHaveBeenCalled();
    type(input, "Ra");
    type(input, "Rad");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(399);
    });
    expect(searchArtists).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    expect(searchArtists).toHaveBeenCalledTimes(1);
    expect(searchArtists).toHaveBeenCalledWith("Rad");
  });

  it("renders results with details, caps at 5, and picks on click", async () => {
    const { input, onPickArtist } = setup(async () => many);
    type(input, "band");
    await flush();
    expect(screen.getAllByRole("option")).toHaveLength(5);
    expect(input.getAttribute("aria-expanded")).toBe("true");

    fireEvent.click(nth(screen.getAllByRole("option"), 2));
    expect(onPickArtist).toHaveBeenCalledWith(nth(many, 2));
    expect(input.value).toBe("Band 2");
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("formats name + disambiguation · country · years", async () => {
    const { input } = setup();
    type(input, "radio");
    await flush();
    expect(screen.getByText("UK rock band · GB · 1985–present")).toBeTruthy();
    expect(screen.getByText("US")).toBeTruthy();
  });

  it("supports keyboard navigation, Enter on highlight, and wrap-around", async () => {
    const { input, onPickArtist } = setup();
    type(input, "radio");
    await flush();
    const opts = () => screen.getAllByRole("option");

    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(nth(opts(), 0).getAttribute("aria-selected")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(nth(opts(), 0).id);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe(nth(opts(), 1).id);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toBe(nth(opts(), 0).id);
    fireEvent.keyDown(input, { key: "ArrowUp" });
    expect(input.getAttribute("aria-activedescendant")).toBe(nth(opts(), 1).id);

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPickArtist).toHaveBeenCalledWith(radioheadTribute);
  });

  it("Enter with no highlight picks the first result", async () => {
    const { input, onPickArtist } = setup();
    type(input, "radio");
    await flush();
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPickArtist).toHaveBeenCalledWith(radiohead);
  });

  it("Enter before the debounce fires runs the search now, then picks on next Enter", async () => {
    const { input, searchArtists, onPickArtist } = setup();
    type(input, "radio");
    await act(async () => {
      fireEvent.keyDown(input, { key: "Enter" });
    });
    expect(searchArtists).toHaveBeenCalledTimes(1);
    expect(onPickArtist).not.toHaveBeenCalled();
    // pending debounce was cancelled
    await flush();
    expect(searchArtists).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole("option")).toHaveLength(2);
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onPickArtist).toHaveBeenCalledWith(radiohead);
  });

  it("Escape closes the list and outside click closes it too", async () => {
    const { input } = setup();
    type(input, "radio");
    await flush();
    expect(screen.getAllByRole("option")).toHaveLength(2);
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryAllByRole("option")).toHaveLength(0);
    expect(input.getAttribute("aria-expanded")).toBe("false");

    fireEvent.focus(input);
    expect(screen.getAllByRole("option")).toHaveLength(2);
    fireEvent.mouseDown(document.body);
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("ignores stale responses", async () => {
    const resolvers = new Map<string, (a: Artist[]) => void>();
    const { input } = setup(
      (q) =>
        new Promise((res) => {
          resolvers.set(q, res);
        }),
    );
    type(input, "rad");
    await flush();
    type(input, "radio");
    await flush();
    // newer resolves first, older resolves afterwards and must be ignored
    await act(async () => resolvers.get("radio")?.([radiohead]));
    await act(async () => resolvers.get("rad")?.([radioheadTribute]));
    const opts = screen.getAllByRole("option");
    expect(opts).toHaveLength(1);
    expect(nth(opts, 0).textContent).toContain("Radiohead");
    expect(nth(opts, 0).textContent).not.toContain("Tribute");
  });

  it("drops an in-flight response once the input becomes a URL or too short", async () => {
    let resolve!: (a: Artist[]) => void;
    const { input } = setup(
      () =>
        new Promise((res) => {
          resolve = res;
        }),
    );
    type(input, "radio");
    await flush();
    type(input, "r");
    await act(async () => resolve([radiohead]));
    expect(screen.queryAllByRole("option")).toHaveLength(0);
  });

  it("announces 'No artists found'", async () => {
    setup(async () => []);
    type(screen.getByRole("combobox"), "zzzz");
    await flush();
    const status = screen.getByRole("status");
    expect(status.textContent).toBe("No artists found");
    expect(status.getAttribute("aria-live")).toBe("polite");
  });

  it("shows an inline error when search fails and recovers on next search", async () => {
    let fail = true;
    const { input } = setup(async () => {
      if (fail) throw new Error("MusicBrainz is down");
      return [radiohead];
    });
    type(input, "radio");
    await flush();
    expect(screen.getByRole("status").textContent).toBe("Search failed: MusicBrainz is down");
    expect(screen.queryAllByRole("option")).toHaveLength(0);

    fail = false;
    type(input, "radiohe");
    await flush();
    expect(screen.getByRole("status").textContent).toBe("");
    expect(screen.getAllByRole("option")).toHaveLength(1);
  });

  it("shows a spinner while searching and disables Find when busy", async () => {
    let resolve!: (a: Artist[]) => void;
    const { input } = setup(
      () =>
        new Promise((res) => {
          resolve = res;
        }),
    );
    type(input, "radio");
    await flush();
    expect(input.getAttribute("aria-busy")).toBe("true");
    expect(document.querySelector("svg.animate-spin")).not.toBeNull();
    await act(async () => resolve([radiohead]));
    expect(input.getAttribute("aria-busy")).toBe("false");
    cleanup();
    render(<SearchBox busy onSubmitUrl={vi.fn()} onPickArtist={vi.fn()} searchArtists={vi.fn()} />);
    expect((screen.getByRole("button", { name: "Find" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("uses initialValue and ignores empty submit", () => {
    const onSubmitUrl = vi.fn();
    render(
      <SearchBox
        initialValue="https://a.com/x"
        onSubmitUrl={onSubmitUrl}
        onPickArtist={vi.fn()}
        searchArtists={vi.fn()}
      />,
    );
    const input = screen.getByRole("combobox") as HTMLInputElement;
    expect(input.value).toBe("https://a.com/x");
    type(input, "");
    fireEvent.click(screen.getByRole("button", { name: "Find" }));
    expect(onSubmitUrl).not.toHaveBeenCalled();
  });
});
