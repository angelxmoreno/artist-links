import { platformIcon } from "@/lib/platform-icons";

const STEPS = [
  { title: "Paste or search", body: "Any Spotify, Apple Music or YouTube link, or just a name." },
  { title: "We match the artist", body: "Looked up on MusicBrainz, the open music database." },
  {
    title: "Get every link",
    body: "Streaming, socials and references in one place, copy in a click.",
  },
];

const PLATFORMS = [
  "Spotify",
  "Apple Music",
  "YouTube Music",
  "Bandcamp",
  "SoundCloud",
  "Tidal",
  "Deezer",
  "Instagram",
  "TikTok",
  "Wikipedia",
  "Discogs",
  "Genius",
];

export function Hero() {
  return (
    <section aria-labelledby="how-heading" className="space-y-8">
      <div>
        <h2
          id="how-heading"
          className="mb-4 text-xs font-semibold uppercase tracking-widest text-muted-foreground"
        >
          How it works
        </h2>
        <ol className="grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="flex gap-4 bg-card p-4 sm:block">
              <span
                aria-hidden="true"
                className="font-display text-4xl leading-none text-primary sm:mb-3 sm:block"
              >
                {i + 1}
              </span>
              <div>
                <h3 className="font-medium">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div>
        <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          Finds links on
        </p>
        <ul className="flex flex-wrap gap-2">
          {PLATFORMS.map((p) => {
            const Icon = platformIcon(p);
            if (!Icon) return null;
            return (
              <li
                key={p}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm text-muted-foreground"
              >
                <span aria-hidden="true" className="contents">
                  <Icon className="size-4" />
                </span>
                {p}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
