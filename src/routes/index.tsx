import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { lookupByUrl, searchByName } from "@/lib/api";
import { track } from "@/lib/analytics";
import { FeaturedArtists } from "@/components/FeaturedArtists";
import { Hero } from "@/components/Hero";
import { Notice } from "@/components/Notice";
import { RecentList } from "@/components/RecentList";
import { ResultSkeleton } from "@/components/ResultSkeleton";
import { SearchBox } from "@/components/SearchBox";
import { SiteShell } from "@/components/SiteShell";
import { useRecent } from "@/hooks/use-recent";

type Search = { url?: string };

const TITLE = "Artist Links — every link for any music artist";
const DESCRIPTION =
  "Paste a Spotify, Instagram, Bandcamp or any artist URL, or search by name, and get all their other links via MusicBrainz.";

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): Search =>
    typeof s["url"] === "string" ? { url: s["url"] } : {},
  head: ({ matches }) => {
    const root = matches.find((m) => (m.routeId as string) === "__root__");
    const origin = (root?.loaderData as { origin?: string | null } | undefined)?.origin;
    return {
      meta: [
        { title: TITLE },
        { name: "description", content: DESCRIPTION },
        { property: "og:title", content: "Artist Links" },
        { property: "og:description", content: "Paste one artist link, get them all." },
        ...(origin ? [{ property: "og:url", content: `${origin}/` }] : []),
      ],
      links: origin ? [{ rel: "canonical", href: `${origin}/` }] : [],
    };
  },
  component: Index,
});

type State =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "unsupported" }
  | { kind: "notfound" };

function Index() {
  const { url } = Route.useSearch();
  const navigate = useNavigate({ from: "/" });
  const [state, setState] = useState<State>({ kind: "idle" });
  const runId = useRef(0);
  const { recent, clear } = useRecent();

  // Resolve ?url= to an artist, then move to the shareable /artist/$mbid page.
  useEffect(() => {
    const id = ++runId.current;
    if (!url) {
      setState({ kind: "idle" });
      return;
    }
    setState({ kind: "loading" });
    lookupByUrl({ data: { url } })
      .then((res) => {
        if (id !== runId.current) return;
        if (res.status === "found") {
          void navigate({ to: "/artist/$mbid", params: { mbid: res.mbid }, replace: true });
        } else {
          setState({ kind: res.status });
        }
      })
      .catch((e: unknown) => {
        if (id !== runId.current) return;
        setState({ kind: "error", message: e instanceof Error ? e.message : "Lookup failed." });
      });
  }, [url, navigate]);

  const goToArtist = (mbid: string) => navigate({ to: "/artist/$mbid", params: { mbid } });

  return (
    <SiteShell>
      <div className="mt-4 sm:mt-8">
        <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-center">
          Artist Links
        </h1>
        <p className="mt-3 text-center text-muted-foreground">
          Paste one artist link, or search by name. Get all of them.
        </p>
      </div>

      <div className="mt-8">
        <SearchBox
          initialValue={url ?? ""}
          busy={state.kind === "loading"}
          searchArtists={(q) => searchByName({ data: { q } })}
          onSubmitUrl={(v) => {
            track("lookup_url");
            if (v === url) setState({ kind: "loading" });
            void navigate({ search: { url: v } });
          }}
          onPickArtist={(a) => {
            track("lookup_name");
            void goToArtist(a.id);
          }}
        />
      </div>

      <section className="mt-8" aria-live="polite">
        {state.kind === "loading" && <ResultSkeleton label="Looking up on MusicBrainz…" />}
        {state.kind === "error" && <Notice tone="error">{state.message}</Notice>}
        {state.kind === "unsupported" && (
          <Notice>
            That looks like a track, album or playlist. Paste an artist profile link instead.
          </Notice>
        )}
        {state.kind === "notfound" && (
          <Notice>
            We couldn't find an artist for that URL. Try typing the artist's name in the box above.
          </Notice>
        )}
      </section>

      {state.kind === "idle" && (
        <div className="mt-12 space-y-14">
          <RecentList items={recent} onPick={(mbid) => void goToArtist(mbid)} onClear={clear} />
          <FeaturedArtists
            onPick={(mbid) => {
              track("featured_click");
              void goToArtist(mbid);
            }}
          />
          <Hero />
        </div>
      )}
    </SiteShell>
  );
}
