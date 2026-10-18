import { createFileRoute } from "@tanstack/react-router";
import { HowItWorksPage } from "@/components/pages/HowItWorksPage";
import { faqJsonLd } from "@/lib/faq";
import { originFromMatches, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/how-it-works")({
  head: ({ matches }) =>
    pageHead({
      title: "How Artist Links works — paste a link or search by name",
      description:
        "Paste an artist's Spotify, Instagram or Bandcamp link, or search by name, and see how Artist Links finds their other links, what it recognises and what it caches.",
      path: "/how-it-works",
      origin: originFromMatches(matches),
      jsonLd: [faqJsonLd()],
    }),
  component: HowItWorksPage,
});
