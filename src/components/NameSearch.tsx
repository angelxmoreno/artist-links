import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import { searchArtists } from "@/lib/musicbrainz";
import { years } from "@/lib/format";
import type { Artist } from "@/lib/types";
import { Notice } from "./Notice";

export function NameSearch({ onPick }: { onPick: (mbid: string) => void }) {
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
          setBusy(true);
          setErr("");
          try {
            setResults(await searchArtists(q.trim()));
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Artist name"
          aria-label="Artist name"
          className="flex-1 min-w-0 h-12 rounded-xl border border-input bg-card px-4 outline-none focus:ring-2 focus:ring-ring"
        />
        <button className="h-12 px-4 rounded-xl bg-secondary text-secondary-foreground inline-flex items-center gap-2">
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}{" "}
          Search
        </button>
      </form>
      {err && (
        <div className="mt-4">
          <Notice tone="error">{err}</Notice>
        </div>
      )}
      {results && (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {results.length === 0 && (
            <li className="text-sm text-muted-foreground">No artists found.</li>
          )}
          {results.map((a) => (
            <li key={a.id}>
              <button
                onClick={() => onPick(a.id)}
                className="w-full text-left rounded-xl border border-border bg-card p-4 hover:bg-accent transition"
              >
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
