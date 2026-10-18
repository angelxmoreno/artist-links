import { useEffect, useRef, useState } from "react";
import { Check, Copy, ExternalLink, Music2, Users, BookOpen, Globe, Link2 } from "lucide-react";
import { toast } from "sonner";
import { artistLinks, GROUPS, type Group, type LinkItem } from "@/lib/platforms";
import { shortUrl } from "@/lib/format";
import { platformIcon } from "@/lib/platform-icons";
import type { ArtistPhoto } from "@/lib/api-types";
import type { Artist } from "@/lib/types";
import { Notice } from "./Notice";
import { track } from "@/lib/analytics";

const ICONS: Record<Group, typeof Music2> = {
  Streaming: Music2,
  Social: Users,
  Reference: BookOpen,
  "Official website": Globe,
  Other: Link2,
};

function copy(text: string, what = "Copied") {
  navigator.clipboard.writeText(text).then(() => toast.success(what));
}

export function ArtistView({
  artist,
  photo,
}: {
  artist: Artist;
  photo?: ArtistPhoto | null | undefined;
}) {
  const links = artistLinks(artist);
  const [copied, setCopied] = useState(false);
  // If the photo can't be loaded, photo and caption both go, so the header looks like it does
  // for an artist without a photo.
  const [photoBroken, setPhotoBroken] = useState(false);
  const photoRef = useRef<HTMLImageElement>(null);
  // A load error that fired before hydration never reached onError; catch it here.
  useEffect(() => {
    const el = photoRef.current;
    if (el?.complete && el.naturalWidth === 0) setPhotoBroken(true);
  }, [photo]);
  const shownPhoto = photo && !photoBroken ? photo : null;
  // Artist name/id + platform, never the pasted URL. Umami can break platforms down per artist.
  const trackLink = (l: LinkItem) =>
    track("link_click", {
      artist: artist.name,
      mbid: artist.id,
      platform: l.platform,
      group: l.group,
    });
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {shownPhoto && (
            <img
              ref={photoRef}
              src={shownPhoto.thumbUrl}
              alt={artist.name}
              width={80}
              height={80}
              onError={() => setPhotoBroken(true)}
              className="size-20 shrink-0 rounded-xl bg-accent object-cover"
            />
          )}
          <div className="min-w-0">
            <h2 className="font-display text-3xl tracking-tight">{artist.name}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {[artist.type, artist.country, artist.disambiguation].filter(Boolean).join(" · ")}
            </p>
            {shownPhoto && (
              <p className="mt-1 text-xs text-muted-foreground">
                <a
                  href={shownPhoto.pageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-foreground"
                >
                  Photo via Wikimedia Commons
                </a>
              </p>
            )}
          </div>
        </div>
        {links.length > 0 && (
          <button
            onClick={() => {
              copy(links.map((l) => l.url).join("\n"), "All links copied");
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="h-10 px-4 rounded-lg border border-border bg-card text-sm inline-flex items-center gap-2 hover:bg-accent"
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />} Copy all links
          </button>
        )}
      </div>

      {links.length === 0 && (
        <div className="mt-6">
          <Notice>No links on MusicBrainz yet.</Notice>
        </div>
      )}

      {GROUPS.map((g) => {
        const items = links.filter((l) => l.group === g);
        if (!items.length) return null;
        const Icon = ICONS[g];
        return (
          <div key={g} className="mt-8">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
              {g}
            </h3>
            <ul className="grid gap-2 sm:grid-cols-2">
              {items.map((l) => {
                const Brand = platformIcon(l.platform);
                return (
                  <li
                    key={l.url}
                    className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                  >
                    <span className="grid place-items-center size-10 shrink-0 rounded-lg bg-accent text-accent-foreground">
                      {Brand ? <Brand className="size-5" /> : <Icon className="size-5" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm">{l.platform}</div>
                      <div className="truncate text-xs text-muted-foreground" title={l.url}>
                        {shortUrl(l.url)}
                      </div>
                    </div>
                    <a
                      href={l.url}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => trackLink(l)}
                      onAuxClick={() => trackLink(l)}
                      aria-label={`Open ${l.platform}`}
                      className="size-9 grid place-items-center rounded-lg hover:bg-accent"
                    >
                      <ExternalLink className="size-4" />
                    </a>
                    <button
                      onClick={() => copy(l.url)}
                      aria-label={`Copy ${l.platform} link`}
                      className="size-9 grid place-items-center rounded-lg hover:bg-accent"
                    >
                      <Copy className="size-4" />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}

      <p className="mt-10 text-sm text-center">
        <a
          href={`https://musicbrainz.org/artist/${artist.id}`}
          target="_blank"
          rel="noreferrer"
          className="underline text-muted-foreground hover:text-foreground"
        >
          Missing a link? Add it on MusicBrainz
        </a>
      </p>
    </div>
  );
}
