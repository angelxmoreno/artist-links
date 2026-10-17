import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { findArtistByUrl, getArtist } from "@/lib/musicbrainz";
import { UnsupportedUrl } from "@/lib/links";
import type { Artist } from "@/lib/types";
import { ArtistView } from "@/components/ArtistView";
import { NameSearch } from "@/components/NameSearch";
import { Notice } from "@/components/Notice";
import { ResultSkeleton } from "@/components/ResultSkeleton";

type Search = { url?: string };

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): Search =>
    typeof s["url"] === "string" ? { url: s["url"] } : {},
  head: () => ({
    meta: [
      { title: "Artist Links — every link for any music artist" },
      {
        name: "description",
        content:
          "Paste a Spotify, Instagram, Bandcamp or any artist URL and get all their other links via MusicBrainz.",
      },
      { property: "og:title", content: "Artist Links" },
      { property: "og:description", content: "Paste one artist link, get them all." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

type State =
  | { kind: "idle" }
  | { kind: "loading"; label: string }
  | { kind: "error"; message: string }
  | { kind: "unsupported" }
  | { kind: "notfound" }
  | { kind: "artist"; artist: Artist };

function Index() {
  const { url } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const [input, setInput] = useState(url ?? "");
  const [state, setState] = useState<State>({ kind: "idle" });
  const runId = useRef(0);

  const loadArtist = useCallback(async (mbid: string, id: number) => {
    setState({ kind: "loading", label: "Loading links…" });
    const artist = await getArtist(mbid);
    if (id === runId.current) setState({ kind: "artist", artist });
  }, []);

  const lookup = useCallback(
    async (raw: string) => {
      const id = ++runId.current;
      if (!raw.trim()) return;
      setState({ kind: "loading", label: "Looking up on MusicBrainz…" });
      try {
        const mbid = await findArtistByUrl(raw);
        if (id !== runId.current) return;
        if (!mbid) return setState({ kind: "notfound" });
        await loadArtist(mbid, id);
      } catch (e) {
        if (id !== runId.current) return;
        if (e instanceof UnsupportedUrl) return setState({ kind: "unsupported" });
        setState({
          kind: "error",
          message:
            e instanceof TypeError ? "That doesn't look like a valid link." : (e as Error).message,
        });
      }
    },
    [loadArtist],
  );

  useEffect(() => {
    if (url) {
      setInput(url);
      lookup(url);
    }
  }, [url, lookup]);

  const submit = (value: string) => {
    const v = value.trim();
    if (!v) return;
    if (v === url) lookup(v);
    else navigate({ search: { url: v } });
  };

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 w-full max-w-7xl mx-auto px-5 sm:px-8 pt-14 sm:pt-20 pb-16">
        <div className="mx-auto max-w-3xl">
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-center">
            Artist Links
          </h1>
          <p className="mt-3 text-center text-muted-foreground">
            Paste one artist link. Get all of them.
          </p>
        </div>

        <form
          className="mt-8 mx-auto max-w-4xl flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => {
              const t = e.clipboardData.getData("text");
              if (t) {
                e.preventDefault();
                setInput(t);
                submit(t);
              }
            }}
            placeholder="https://open.spotify.com/artist/…"
            aria-label="Artist URL"
            className="flex-1 min-w-0 h-14 rounded-xl border border-input bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="submit"
            className="h-14 px-5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition"
          >
            Find
          </button>
        </form>

        <section className="mt-12" aria-live="polite">
          {state.kind === "loading" && <ResultSkeleton label={state.label} />}
          {state.kind === "error" && <Notice tone="error">{state.message}</Notice>}
          {state.kind === "unsupported" && (
            <Notice>
              That looks like a track, album or playlist. Paste an artist profile link instead.
            </Notice>
          )}
          {state.kind === "notfound" && (
            <NameSearch
              onPick={(mbid) => {
                const id = ++runId.current;
                loadArtist(mbid, id).catch((e) => setState({ kind: "error", message: e.message }));
              }}
            />
          )}
          {state.kind === "artist" && <ArtistView artist={state.artist} />}
        </section>
      </main>
      <footer className="py-8 text-center text-sm text-muted-foreground">
        Data from{" "}
        <a
          className="underline hover:text-foreground"
          href="https://musicbrainz.org"
          target="_blank"
          rel="noreferrer"
        >
          MusicBrainz
        </a>{" "}
        (CC0)
      </footer>
    </div>
  );
}
