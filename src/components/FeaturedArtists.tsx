import { ArrowUpRight } from "lucide-react";
import { FEATURED } from "@/data/featured";

export function FeaturedArtists({ onPick }: { onPick: (mbid: string, name: string) => void }) {
  return (
    <section aria-labelledby="featured-heading">
      <div className="mb-4 flex items-baseline justify-between gap-3">
        <h2 id="featured-heading" className="font-display text-2xl tracking-tight">
          Start with a favourite
        </h2>
        <span className="text-xs uppercase tracking-widest text-muted-foreground">Featured</span>
      </div>
      <ul className="grid grid-cols-1 gap-2.5 min-[480px]:grid-cols-2 lg:grid-cols-3">
        {FEATURED.map((a) => (
          <li key={a.mbid}>
            <button
              type="button"
              onClick={() => onPick(a.mbid, a.name)}
              aria-label={`${a.name}: ${a.blurb}`}
              className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition hover:-translate-y-0.5 hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span
                aria-hidden="true"
                className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent font-display text-2xl leading-none text-accent-foreground transition group-hover:bg-primary group-hover:text-primary-foreground"
              >
                {a.name.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-xl leading-tight">{a.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{a.blurb}</span>
              </span>
              <ArrowUpRight
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100"
              />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
