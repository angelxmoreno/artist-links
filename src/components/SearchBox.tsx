import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import { Loader2 } from "lucide-react";
import { years } from "@/lib/format";
import { looksLikeUrl } from "@/lib/looks-like-url";
import type { Artist } from "@/lib/types";

export interface SearchBoxProps {
  initialValue?: string;
  busy?: boolean;
  onSubmitUrl(url: string): void;
  onPickArtist(artist: Artist): void;
  searchArtists(q: string): Promise<Artist[]>;
}

const DEBOUNCE_MS = 400;
const MIN_CHARS = 2;
const MAX_RESULTS = 5;

export function SearchBox({
  initialValue = "",
  busy = false,
  onSubmitUrl,
  onPickArtist,
  searchArtists,
}: SearchBoxProps) {
  const uid = useId();
  const listId = `${uid}-list`;
  const hintId = `${uid}-hint`;
  const optionId = (i: number) => `${uid}-opt-${i}`;

  const [value, setValue] = useState(initialValue);
  // Results plus the (trimmed) query they belong to.
  const [found, setFound] = useState<{ q: string; items: Artist[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const rootRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const reqId = useRef(0);

  /** Cancel any pending debounce and invalidate in-flight requests. */
  const cancelSearch = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = undefined;
    reqId.current++;
    setLoading(false);
  }, []);

  useEffect(() => cancelSearch, [cancelSearch]);

  // Keep in sync when the parent changes the value (e.g. route search param).
  useEffect(() => {
    cancelSearch();
    setValue(initialValue);
    setFound(null);
    setError("");
    setOpen(false);
    setActive(-1);
  }, [initialValue, cancelSearch]);

  // Close when clicking/tapping outside.
  useEffect(() => {
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
    };
  }, []);

  const runSearch = useCallback(
    async (q: string) => {
      clearTimeout(timer.current);
      timer.current = undefined;
      const id = ++reqId.current;
      setLoading(true);
      setError("");
      try {
        const items = (await searchArtists(q)).slice(0, MAX_RESULTS);
        if (id !== reqId.current) return;
        setFound({ q, items });
        setActive(-1);
        setOpen(true);
      } catch (e) {
        if (id !== reqId.current) return;
        const msg = e instanceof Error && e.message ? e.message : "";
        setFound(null);
        setError(msg ? `Search failed: ${msg}` : "Search failed. Please try again.");
        setOpen(true);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [searchArtists],
  );

  const pick = (artist: Artist) => {
    cancelSearch();
    setValue(artist.name);
    setOpen(false);
    setActive(-1);
    onPickArtist(artist);
  };

  const submitUrl = (url: string) => {
    cancelSearch();
    setOpen(false);
    setActive(-1);
    onSubmitUrl(url);
  };

  const q = value.trim();
  const isUrl = looksLikeUrl(q);
  const items = found && found.q === q && !isUrl ? found.items : [];
  const listVisible = open && items.length > 0;
  const noResults = open && !loading && !error && !isUrl && found?.q === q && items.length === 0;
  const message = error || (noResults ? "No artists found" : "");

  const handleSubmit = () => {
    if (!q) return;
    if (isUrl) return submitUrl(q);
    const highlighted = listVisible ? items[active] : undefined;
    if (highlighted) return pick(highlighted);
    if (q.length < MIN_CHARS) return;
    const [first] = items;
    if (first) return pick(first);
    void runSearch(q);
  };

  const onChange = (next: string) => {
    setValue(next);
    setActive(-1);
    setError("");
    clearTimeout(timer.current);
    timer.current = undefined;
    reqId.current++; // drop responses for older input
    const t = next.trim();
    if (t.length < MIN_CHARS || looksLikeUrl(t)) {
      setLoading(false);
      setOpen(false);
      setFound(null);
      return;
    }
    setOpen(true);
    timer.current = setTimeout(() => void runSearch(t), DEBOUNCE_MS);
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").trim();
    if (text && looksLikeUrl(text)) {
      e.preventDefault();
      setValue(text);
      submitUrl(text);
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      if (items.length === 0) return;
      e.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      const dir = e.key === "ArrowDown" ? 1 : -1;
      setActive((i) =>
        i === -1 ? (dir === 1 ? 0 : items.length - 1) : (i + dir + items.length) % items.length,
      );
    } else if (e.key === "Enter") {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      handleSubmit();
    } else if (e.key === "Escape") {
      if (open) {
        e.preventDefault();
        setOpen(false);
        setActive(-1);
      }
    }
  };

  return (
    <div ref={rootRef} className="w-full">
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          handleSubmit();
        }}
      >
        <div className="relative flex-1 min-w-0">
          <input
            type="text"
            role="combobox"
            aria-label="Artist link or name"
            aria-autocomplete="list"
            aria-expanded={listVisible}
            aria-controls={listId}
            aria-activedescendant={listVisible && active >= 0 ? optionId(active) : undefined}
            aria-describedby={hintId}
            aria-busy={loading}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            value={value}
            placeholder="Paste a link or type an artist name"
            onChange={(e) => onChange(e.target.value)}
            onPaste={onPaste}
            onKeyDown={onKeyDown}
            onFocus={() => {
              if (items.length > 0 || message) setOpen(true);
            }}
            className="w-full h-14 rounded-xl border border-input bg-card pl-4 pr-11 text-base outline-none focus:ring-2 focus:ring-ring"
          />
          {loading && (
            <Loader2
              aria-hidden="true"
              className="pointer-events-none absolute right-4 top-1/2 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            />
          )}

          <ul
            id={listId}
            role="listbox"
            aria-label="Artist suggestions"
            hidden={!listVisible}
            className="absolute left-0 right-0 top-full z-20 mt-2 max-h-80 overflow-auto rounded-xl border border-border bg-card text-card-foreground shadow-lg"
          >
            {listVisible &&
              items.map((a, i) => {
                const detail = [a.disambiguation, a.country, years(a)].filter(Boolean).join(" · ");
                return (
                  <li
                    key={a.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={i === active}
                    // mousedown would blur the input before click lands
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(a)}
                    onMouseEnter={() => setActive(i)}
                    className={`cursor-pointer px-4 py-3 transition ${i === active ? "bg-accent text-accent-foreground" : ""}`}
                  >
                    <div className="font-medium truncate">{a.name}</div>
                    {detail && (
                      <div className="text-sm text-muted-foreground truncate">{detail}</div>
                    )}
                  </li>
                );
              })}
          </ul>

          <div
            role="status"
            aria-live="polite"
            className={
              message && !listVisible
                ? "absolute left-0 right-0 top-full z-20 mt-2 rounded-xl border border-border bg-card px-4 py-3 text-sm text-muted-foreground shadow-lg"
                : "sr-only"
            }
          >
            {message}
          </div>
        </div>
        <button
          type="submit"
          disabled={busy}
          className="h-14 px-5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition inline-flex items-center justify-center gap-2 disabled:opacity-60"
        >
          {busy && <Loader2 aria-hidden="true" className="size-4 animate-spin" />}
          Find
        </button>
      </form>
      <p id={hintId} className="mt-2 text-xs text-muted-foreground">
        e.g. a Spotify, Instagram or Bandcamp link — or just a name
      </p>
    </div>
  );
}
