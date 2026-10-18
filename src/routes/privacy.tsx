import { createFileRoute } from "@tanstack/react-router";
import { PrivacyPage } from "@/components/pages/PrivacyPage";
import { originFromMatches, pageHead } from "@/lib/seo";

export const Route = createFileRoute("/privacy")({
  head: ({ matches }) =>
    pageHead({
      title: "Privacy | Artist Links",
      description:
        "What Artist Links collects when you use it, in plain language: analytics events, error reports, the server cache and your browser's Recently viewed list.",
      path: "/privacy",
      origin: originFromMatches(matches),
    }),
  component: PrivacyPage,
});
