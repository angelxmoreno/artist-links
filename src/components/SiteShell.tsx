import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import { HEADER_PAGES, REPO_URL, SITE_PAGES } from "@/lib/nav";

const NAV_LINK =
  "rounded-md px-1 py-0.5 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const ACTIVE = "text-foreground underline underline-offset-4";

function PageLinks({
  pages,
}: {
  pages: readonly { to: (typeof SITE_PAGES)[number]["to"]; label: string }[];
}) {
  return (
    <>
      {pages.map((p) => (
        <li key={p.to}>
          <Link
            to={p.to}
            className={NAV_LINK}
            activeProps={{ className: `${NAV_LINK} ${ACTIVE}`, "aria-current": "page" }}
          >
            {p.label}
          </Link>
        </li>
      ))}
    </>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full max-w-7xl mx-auto px-5 sm:px-8 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
          <Link to="/" className="inline-flex items-center gap-2 hover:opacity-80">
            <img src="/favicon.svg" alt="" width={28} height={28} className="size-7" />
            <span className="font-display text-xl tracking-tight">Artist Links</span>
          </Link>
          <nav aria-label="Main">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <PageLinks pages={HEADER_PAGES} />
            </ul>
          </nav>
        </div>
      </header>
      <main className="flex-1 w-full max-w-7xl mx-auto px-5 sm:px-8 pt-10 pb-16">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
      <footer className="border-t border-border py-8 text-sm text-muted-foreground">
        <div className="w-full max-w-7xl mx-auto px-5 sm:px-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <nav aria-label="Footer">
            <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <li>
                <Link
                  to="/"
                  className={NAV_LINK}
                  activeProps={{ className: `${NAV_LINK} ${ACTIVE}`, "aria-current": "page" }}
                  activeOptions={{ exact: true }}
                >
                  Home
                </Link>
              </li>
              <PageLinks pages={SITE_PAGES} />
            </ul>
          </nav>
          <p>
            Data from{" "}
            <a
              className="underline hover:text-foreground"
              href="https://musicbrainz.org"
              target="_blank"
              rel="noreferrer"
            >
              MusicBrainz
            </a>{" "}
            (CC0) ·{" "}
            <a
              className="underline hover:text-foreground"
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
            >
              Open source on GitHub
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
