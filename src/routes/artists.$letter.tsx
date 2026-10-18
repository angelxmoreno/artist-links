import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArtistDirectory } from "@/components/pages/ArtistDirectory";
import { SiteShell } from "@/components/SiteShell";
import { fetchDirectory } from "@/lib/directory-api";
import { directoryHead } from "@/lib/directory-head";
import { parsePageParam } from "@/lib/directory";
import { originFromMatches } from "@/lib/seo";

export const Route = createFileRoute("/artists/$letter")({
  validateSearch: (s: Record<string, unknown>): { page?: number } => parsePageParam(s["page"]),
  // Unlike validateSearch, this sees the raw value for keys the validator dropped (?page=abc).
  loaderDeps: ({ search }) => ({ page: parsePageParam(search.page).page ?? 1 }),
  loader: async ({ params, deps }) => {
    const data = await fetchDirectory({ data: { letter: params.letter, page: deps.page } });
    if (!data.page) throw notFound();
    return data;
  },
  head: ({ loaderData, params, matches }) =>
    loaderData ? directoryHead(loaderData, params.letter, originFromMatches(matches)) : {},
  notFoundComponent: LetterNotFound,
  component: ArtistsLetter,
});

function ArtistsLetter() {
  const { letter } = Route.useParams();
  return <ArtistDirectory data={Route.useLoaderData()} letter={letter} />;
}

function LetterNotFound() {
  return (
    <SiteShell>
      <div className="text-center">
        <h1 className="font-display text-3xl tracking-tight">No artists here</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          There is no such page in the artist directory.
        </p>
        <Link
          to="/artists"
          className="mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Browse all artists
        </Link>
      </div>
    </SiteShell>
  );
}
