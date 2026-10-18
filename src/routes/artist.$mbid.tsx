import {
  createFileRoute,
  Link,
  notFound,
  useRouter,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { fetchArtist, fetchArtistPhoto } from "@/lib/api";
import type { ArtistPhoto } from "@/lib/api-types";
import { artistLinks } from "@/lib/platforms";
import type { Artist } from "@/lib/types";
import { ArtistView } from "@/components/ArtistView";
import { Notice } from "@/components/Notice";
import { ResultSkeleton } from "@/components/ResultSkeleton";
import { SiteShell } from "@/components/SiteShell";
import { useRecent } from "@/hooks/use-recent";
import { track } from "@/lib/analytics";

const MAX_DESCRIPTION = 160;

function truncate(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;
}

export function artistTitle(artist: Artist): string {
  return `${artist.name} — all links | Artist Links`;
}

export function artistDescription(artist: Artist): string {
  const detail = [artist.type, artist.country].filter(Boolean).join(", ");
  const base = `Streaming, social and official links for ${artist.name}`;
  return truncate(detail ? `${base} (${detail}).` : `${base}.`, MAX_DESCRIPTION);
}

/** schema.org structured data; `sameAs` lists the artist's own profile links. */
export function artistJsonLd(
  artist: Artist,
  url: string | null,
  photo?: ArtistPhoto | null,
): Record<string, unknown> {
  const sameAs = artistLinks(artist)
    .map((l) => l.url)
    .filter((u) => /^https?:\/\//i.test(u));
  return {
    "@context": "https://schema.org",
    "@type": artist.type === "Person" ? "Person" : "MusicGroup",
    name: artist.name,
    ...(url ? { url } : {}),
    ...(photo ? { image: photo.ogUrl } : {}),
    ...(artist.disambiguation ? { description: artist.disambiguation } : {}),
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function artistHead(
  artist: Artist,
  origin: string | null,
  pathname: string,
  photo?: ArtistPhoto | null,
) {
  const title = artistTitle(artist);
  const description = artistDescription(artist);
  const url = origin ? `${origin}${pathname}` : null;
  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      ...(url ? [{ property: "og:url", content: url }] : []),
      // The root route sets default og:image/twitter:image (and a 1200x630 size). TanStack keeps
      // the deepest route's tag per name/property, so these replace the defaults. The size is
      // always sent with the image so the default 1200x630 never describes the wrong picture.
      ...(photo
        ? [
            { property: "og:image", content: photo.ogUrl },
            { property: "og:image:width", content: String(photo.ogWidth) },
            { property: "og:image:height", content: String(photo.ogHeight) },
            { property: "og:image:alt", content: `Photo of ${artist.name}` },
            { name: "twitter:image", content: photo.ogUrl },
          ]
        : []),
      { "script:ld+json": artistJsonLd(artist, url, photo) },
    ],
    links: url ? [{ rel: "canonical", href: url }] : [],
  };
}

export const Route = createFileRoute("/artist/$mbid")({
  loader: async ({ params }) => {
    const artist = await fetchArtist({ data: { mbid: params.mbid } });
    if (!artist) throw notFound();
    // Only artists with a Wikidata link can have a photo; the lookup can't fail the page.
    const hasWikidata = artist.relations?.some((r) => r.type === "wikidata") ?? false;
    const photo = hasWikidata
      ? await fetchArtistPhoto({ data: { mbid: params.mbid } }).catch(() => null)
      : null;
    return { artist, photo };
  },
  head: ({ loaderData, match, matches }) => {
    if (!loaderData) return {};
    // Root loader exposes the site origin (SITE_URL or the request origin).
    const root = matches.find((m) => (m.routeId as string) === "__root__");
    const rootData = root?.loaderData as { origin?: string | null } | undefined;
    return artistHead(
      loaderData.artist,
      rootData?.origin ?? null,
      match.pathname,
      loaderData.photo,
    );
  },
  pendingComponent: () => (
    <SiteShell>
      <ResultSkeleton label="Loading links…" />
    </SiteShell>
  ),
  notFoundComponent: ArtistNotFound,
  errorComponent: ArtistError,
  component: ArtistPage,
});

function ArtistPage() {
  const { artist, photo } = Route.useLoaderData();
  const { add } = useRecent();
  useEffect(() => {
    const subtitle = [artist.type, artist.country].filter(Boolean).join(" · ");
    add({ mbid: artist.id, name: artist.name, ...(subtitle && { subtitle }) });
    track("artist_view");
  }, [artist, add]);
  return (
    <SiteShell>
      <ArtistView artist={artist} photo={photo} />
    </SiteShell>
  );
}

function ArtistNotFound() {
  return (
    <SiteShell>
      <div className="text-center">
        <h1 className="font-display text-3xl tracking-tight">Artist not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          We couldn't find an artist with that ID on MusicBrainz.
        </p>
        <Link
          to="/"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Search for an artist
        </Link>
      </div>
    </SiteShell>
  );
}

function ArtistError({ error, reset }: ErrorComponentProps) {
  const router = useRouter();
  return (
    <SiteShell>
      <Notice tone="error">
        {error instanceof Error && error.message
          ? error.message
          : "Something went wrong loading this artist."}
      </Notice>
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => {
            reset();
            void router.invalidate();
          }}
          className="h-10 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Try again
        </button>
        <Link
          to="/"
          className="inline-flex h-10 items-center rounded-lg border border-border px-4 text-sm hover:bg-accent"
        >
          Go home
        </Link>
      </div>
    </SiteShell>
  );
}
