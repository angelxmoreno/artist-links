import { History } from "lucide-react";
import type { RecentArtist } from "@/hooks/use-recent";

export function RecentList({
  items,
  onPick,
  onClear,
}: {
  items: RecentArtist[];
  onPick: (mbid: string) => void;
  onClear: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="recent-heading">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2
          id="recent-heading"
          className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          <History aria-hidden="true" className="size-3.5" /> Recently viewed
        </h2>
        <button
          type="button"
          onClick={onClear}
          className="rounded-md px-2 py-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Clear
        </button>
      </div>
      <ul className="flex flex-wrap gap-2">
        {items.map((r) => (
          <li key={r.mbid} className="max-w-full">
            <button
              type="button"
              onClick={() => onPick(r.mbid)}
              title={r.subtitle ? `${r.name} · ${r.subtitle}` : r.name}
              className="inline-flex max-w-full items-baseline gap-2 rounded-full border border-border bg-card px-3.5 py-1.5 text-sm transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="truncate font-medium">{r.name}</span>
              {r.subtitle && (
                <span className="hidden truncate text-xs text-muted-foreground sm:inline">
                  {r.subtitle}
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
