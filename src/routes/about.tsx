import { createFileRoute } from "@tanstack/react-router";
import { AboutPage } from "@/components/pages/AboutPage";
import { originFromMatches, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/about")({
  head: ({ matches }) =>
    pageHead({
      title: "About Artist Links — find an artist's official links",
      description:
        "Artist Links finds every official link for a music artist from one link or a name, using open MusicBrainz data. Open source.",
      path: "/about",
      origin: originFromMatches(matches),
    }),
  component: AboutPage,
});
