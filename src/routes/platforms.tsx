import { createFileRoute } from "@tanstack/react-router";
import { PlatformsPage } from "@/components/pages/PlatformsPage";
import { PLATFORM_LIST } from "@/lib/platforms";
import { originFromMatches, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/platforms")({
  head: ({ matches }) =>
    pageHead({
      title: "Supported platforms | Artist Links",
      description: `The ${PLATFORM_LIST.length} streaming, social, reference and ticketing sites Artist Links recognises, with an example link for each.`,
      path: "/platforms",
      origin: originFromMatches(matches),
    }),
  component: PlatformsPage,
});
