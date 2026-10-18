// The site's own pages, in one place so the header, the footer, the sitemap and the tests agree.

export const REPO_URL = "https://github.com/angelxmoreno/artist-links";

export const SITE_PAGES = [
  { to: "/about", label: "About" },
  { to: "/how-it-works", label: "How it works" },
  { to: "/platforms", label: "Platforms" },
  { to: "/artists", label: "Artists" },
  { to: "/privacy", label: "Privacy" },
] as const;

export type SitePath = (typeof SITE_PAGES)[number]["to"];

/** Shown in the header; every page is in the footer. */
export const HEADER_PAGES = SITE_PAGES.filter((p) => p.to !== "/privacy");
