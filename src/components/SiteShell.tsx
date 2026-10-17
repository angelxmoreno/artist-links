import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="w-full max-w-7xl mx-auto px-5 sm:px-8 pt-6">
        <Link to="/" className="inline-flex items-center gap-2 hover:opacity-80">
          <img src="/favicon.svg" alt="" width={28} height={28} className="size-7" />
          <span className="font-display text-xl tracking-tight">Artist Links</span>
        </Link>
      </header>
      <main className="flex-1 w-full max-w-7xl mx-auto px-5 sm:px-8 pt-10 pb-16">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
      <footer className="py-8 text-center text-sm text-muted-foreground">
        Data from{" "}
        <a
          className="underline hover:text-foreground"
          href="https://musicbrainz.org"
          target="_blank"
          rel="noreferrer"
        >
          MusicBrainz
        </a>{" "}
        (CC0)
      </footer>
    </div>
  );
}
