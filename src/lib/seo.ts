// Head tags shared by the static pages (About, How it works, Platforms, Artists, Privacy).
// Same shape as `artistHead` in routes/artist.$mbid.tsx: title, description, canonical, og tags.
// The root route already sets the default og:image, og:type and twitter:card, so they are not
// repeated here.

interface MatchLike {
  routeId: string;
  loaderData?: unknown;
}

/** The site origin the root loader exposes (SITE_URL, else the request origin). */
export function originFromMatches(matches: readonly MatchLike[]): string | null {
  const root = matches.find((m) => m.routeId === "__root__");
  const origin = (root?.loaderData as { origin?: string | null } | undefined)?.origin;
  return origin ?? null;
}

export interface PageHeadInput {
  title: string;
  description: string;
  /** Path with the query string that makes the URL unique, e.g. "/artists/b?page=2". */
  path: string;
  origin: string | null;
  /** schema.org objects, each rendered as one JSON-LD script. */
  jsonLd?: Record<string, unknown>[];
  /** Paths for <link rel="prev"> and <link rel="next"> on paginated pages. */
  prev?: string | null;
  next?: string | null;
}

export function pageHead({
  title,
  description,
  path,
  origin,
  jsonLd = [],
  prev,
  next,
}: PageHeadInput) {
  const url = origin ? `${origin}${path}` : null;
  const abs = (p: string) => `${origin}${p}`;
  const meta = [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    ...(url ? [{ property: "og:url", content: url }] : []),
    // `head` types its meta as <meta> attributes; JSON-LD is a TanStack extension it does accept.
    ...jsonLd.map((data) => ({ "script:ld+json": data }) as never),
  ];
  return {
    meta,
    links: [
      ...(url ? [{ rel: "canonical", href: url }] : []),
      ...(origin && prev ? [{ rel: "prev", href: abs(prev) }] : []),
      ...(origin && next ? [{ rel: "next", href: abs(next) }] : []),
    ],
  };
}
