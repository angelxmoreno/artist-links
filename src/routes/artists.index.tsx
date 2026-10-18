import { createFileRoute, notFound } from "@tanstack/react-router";
import { ArtistDirectory } from "@/components/pages/ArtistDirectory";
import { fetchDirectory } from "@/lib/directory-api";
import { directoryHead } from "@/lib/directory-head";
import { parsePageParam } from "@/lib/directory";
import { originFromMatches } from "@/lib/seo";

export const Route = createFileRoute("/artists/")({
  validateSearch: (s: Record<string, unknown>): { page?: number } => parsePageParam(s["page"]),
  // Unlike validateSearch, this sees the raw value for keys the validator dropped (?page=abc).
  loaderDeps: ({ search }) => ({ page: parsePageParam(search.page).page ?? 1 }),
  loader: async ({ deps }) => {
    const data = await fetchDirectory({ data: { page: deps.page } });
    if (!data.page) throw notFound();
    return data;
  },
  head: ({ loaderData, matches }) =>
    loaderData ? directoryHead(loaderData, null, originFromMatches(matches)) : {},
  component: ArtistsIndex,
});

function ArtistsIndex() {
  return <ArtistDirectory data={Route.useLoaderData()} letter={null} />;
}
