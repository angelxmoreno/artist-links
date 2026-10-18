// The questions shown on /how-it-works. The same list renders the page and builds the FAQPage
// JSON-LD, so structured data only ever describes questions that are visible on the page.

export interface FaqItem {
  question: string;
  /** Plain text (it is also used verbatim in the JSON-LD). */
  answer: string;
  /** Optional link shown after the answer. */
  more?: { to: "/privacy" | "/platforms"; label: string };
}

export const FAQ: FaqItem[] = [
  {
    question: "Why does it say it could not find an artist for my link?",
    answer:
      "Artist Links only knows what MusicBrainz knows. If nobody has attached that link to the artist on MusicBrainz yet, there is nothing to find. Try searching by the artist's name instead, or add the link on MusicBrainz so it works for everyone.",
  },
  {
    question: "Can I paste a link to a song, album or playlist?",
    answer:
      "Not yet. Track, album, playlist, episode and similar links are not supported; paste the artist's profile link instead, or search by name.",
  },
  {
    question: "A link on an artist page is missing or wrong. How do I fix it?",
    answer:
      "Fix it on MusicBrainz, where anyone can edit. Artist Links keeps each MusicBrainz answer for up to 24 hours, so the change shows up here within about a day.",
  },
  {
    question: "Do I need an account?",
    answer: "No. There is no sign-up or login.",
  },
  {
    question: "What happens to the link I paste?",
    answer:
      "It is sent to our server, which asks MusicBrainz which artist the link belongs to. The answer is cached for a short time together with the lookup, without anything that identifies you.",
    more: { to: "/privacy", label: "Read the privacy page" },
  },
];

export function faqJsonLd(items: FaqItem[] = FAQ): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((i) => ({
      "@type": "Question",
      name: i.question,
      acceptedAnswer: { "@type": "Answer", text: i.answer },
    })),
  };
}
