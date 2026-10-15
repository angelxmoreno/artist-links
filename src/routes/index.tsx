import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Copy, ExternalLink, Search, Music2, Users, BookOpen, Globe, Link2, Check, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import {
  artistLinks, findArtistByUrl, getArtist, searchArtists, GROUPS, UnsupportedUrl,
  type Artist, type Group,
} from "@/lib/musicbrainz";
import { platformIcon } from "@/lib/platform-icons";

type Search = { url?: string };

export const Route = createFileRoute("/")({
  validateSearch: (s: Record<string, unknown>): Search =>
    typeof s["url"] === "string" ? { url: s["url"] } : {},
  head: () => ({
    meta: [
      { title: "Artist Links — every link for any music artist" },
      { name: "description", content: "Paste a Spotify, Instagram, Bandcamp or any artist URL and get all their other links via MusicBrainz." },
      { property: "og:title", content: "Artist Links" },
      { property: "og:description", content: "Paste one artist link, get them all." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Index,
});

const ICONS: Record<Group, typeof Music2> = {
  Streaming: Music2, Social: Users, Reference: BookOpen, "Official website": Globe, Other: Link2,
};

type State =
  | { kind: "idle" }
  | { kind: "loading"; label: string }
  | { kind: "error"; message: string }
  | { kind: "unsupported" }
  | { kind: "notfound" }
  | { kind: "artist"; artist: Artist };

function copy(text: string, what = "Copied") {
  navigator.clipboard.writeText(text).then(() => toast.success(what));
}

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

  const lookup = useCallback(async (raw: string) => {
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
      setState({ kind: "error", message: e instanceof TypeError ? "That doesn't look like a valid link." : (e as Error).message });
    }
  }, [loadArtist]);

  useEffect(() => {
    if (url) { setInput(url); lookup(url); }
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
          <h1 className="font-display text-4xl sm:text-5xl tracking-tight text-center">Artist Links</h1>
          <p className="mt-3 text-center text-muted-foreground">Paste one artist link. Get all of them.</p>
        </div>

        <form
          className="mt-8 mx-auto max-w-4xl flex gap-2"
          onSubmit={(e) => { e.preventDefault(); submit(input); }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onPaste={(e) => {
              const t = e.clipboardData.getData("text");
              if (t) { e.preventDefault(); setInput(t); submit(t); }
            }}
            placeholder="https://open.spotify.com/artist/…"
            aria-label="Artist URL"
            className="flex-1 min-w-0 h-14 rounded-xl border border-input bg-card px-4 text-base outline-none focus:ring-2 focus:ring-ring"
          />
          <button type="submit" className="h-14 px-5 rounded-xl bg-primary text-primary-foreground font-medium hover:opacity-90 transition">
            Find
          </button>
        </form>

        <section className="mt-12" aria-live="polite">
          {state.kind === "loading" && <Skeleton label={state.label} />}
          {state.kind === "error" && <Notice tone="error">{state.message}</Notice>}
          {state.kind === "unsupported" && (
            <Notice>That looks like a track, album or playlist. Paste an artist profile link instead.</Notice>
          )}
          {state.kind === "notfound" && (
            <NameSearch onPick={(mbid) => { const id = ++runId.current; loadArtist(mbid, id).catch((e) => setState({ kind: "error", message: e.message })); }} />
          )}
          {state.kind === "artist" && <ArtistView artist={state.artist} />}
        </section>
      </main>
      <footer className="py-8 text-center text-sm text-muted-foreground">
        Data from <a className="underline hover:text-foreground" href="https://musicbrainz.org" target="_blank" rel="noreferrer">MusicBrainz</a> (CC0)
      </footer>
    </div>
  );
}

function Notice({ children, tone }: { children: React.ReactNode; tone?: "error" }) {
  return (
    <div className={`rounded-xl border p-4 text-sm ${tone === "error" ? "border-destructive/40 text-destructive" : "border-border text-muted-foreground"}`}>
      {children}
    </div>
  );
}

function Skeleton({ label }: { label: string }) {
  return (
    <div>
      <p className="flex items-center gap-2 text-sm text-muted-foreground mb-4"><Loader2 className="size-4 animate-spin" />{label}</p>
      <div className="h-8 w-1/2 rounded-md bg-muted animate-pulse" />
      <div className="mt-2 h-4 w-1/3 rounded-md bg-muted animate-pulse" />
      <div className="mt-8 grid gap-3 sm:grid-cols-2">
        {[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className="h-16 rounded-xl bg-muted animate-pulse" />)}
      </div>
    </div>
  );
}

function shortUrl(u: string) {
  return u.replace(/^https?:\/\//, "").replace(/^www\./, "");
}

function years(a: Artist) {
  const ls = a["life-span"];
  if (!ls?.begin) return "";
  return `${ls.begin.slice(0, 4)}–${ls.end ? ls.end.slice(0, 4) : ls.ended ? "?" : "present"}`;
}

function NameSearch({ onPick }: { onPick: (mbid: string) => void }) {
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [results, setResults] = useState<Artist[] | null>(null);
  return (
    <div>
      <h2 className="text-xl font-semibold">We couldn't find that URL</h2>
      <p className="mt-1 text-sm text-muted-foreground">Try searching by artist name instead.</p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!q.trim()) return;
          setBusy(true); setErr("");
          try { setResults(await searchArtists(q.trim())); }
          catch (e) { setErr((e as Error).message); }
          finally { setBusy(false); }
        }}
      >
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Artist name" aria-label="Artist name"
          className="flex-1 min-w-0 h-12 rounded-xl border border-input bg-card px-4 outline-none focus:ring-2 focus:ring-ring" />
        <button className="h-12 px-4 rounded-xl bg-secondary text-secondary-foreground inline-flex items-center gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Search
        </button>
      </form>
      {err && <div className="mt-4"><Notice tone="error">{err}</Notice></div>}
      {results && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {results.length === 0 && <li className="text-sm text-muted-foreground">No artists found.</li>}
          {results.map((a) => (
            <li key={a.id}>
              <button onClick={() => onPick(a.id)} className="w-full text-left rounded-xl border border-border bg-card p-4 hover:bg-accent transition">
                <div className="font-medium">{a.name}</div>
                <div className="text-sm text-muted-foreground">
                  {[a.disambiguation, a.country, years(a)].filter(Boolean).join(" · ") || "—"}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ArtistView({ artist }: { artist: Artist }) {
  const links = artistLinks(artist);
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-display text-3xl tracking-tight">{artist.name}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {[artist.type, artist.country, artist.disambiguation].filter(Boolean).join(" · ")}
          </p>
        </div>
        {links.length > 0 && (
          <button
            onClick={() => { copy(links.map((l) => l.url).join("\n"), "All links copied"); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="h-10 px-4 rounded-lg border border-border bg-card text-sm inline-flex items-center gap-2 hover:bg-accent"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy all links
          </button>
        )}
      </div>

      {links.length === 0 && <div className="mt-6"><Notice>No links on MusicBrainz yet.</Notice></div>}

      {GROUPS.map((g) => {
        const items = links.filter((l) => l.group === g);
        if (!items.length) return null;
        const Icon = ICONS[g];
        return (
          <div key={g} className="mt-8">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{g}</h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {items.map((l) => {
                const Brand = platformIcon(l.platform);
                return (
                <li key={l.url} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                  <span className="grid place-items-center size-10 shrink-0 rounded-lg bg-accent text-accent-foreground">
                    {Brand ? <Brand className="size-5" /> : <Icon className="size-5" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-sm">{l.platform}</div>
                    <div className="truncate text-xs text-muted-foreground" title={l.url}>{shortUrl(l.url)}</div>
                  </div>
                  <a href={l.url} target="_blank" rel="noreferrer" aria-label={`Open ${l.platform}`}
                    className="size-9 grid place-items-center rounded-lg hover:bg-accent"><ExternalLink className="size-4" /></a>
                  <button onClick={() => copy(l.url)} aria-label={`Copy ${l.platform} link`}
                    className="size-9 grid place-items-center rounded-lg hover:bg-accent"><Copy className="size-4" /></button>
                </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <p className="mt-10 text-sm text-center">
        <a href={`https://musicbrainz.org/artist/${artist.id}`} target="_blank" rel="noreferrer" className="underline text-muted-foreground hover:text-foreground">
          Missing a link? Add it on MusicBrainz
        </a>
      </p>
    </div>
  );
}
