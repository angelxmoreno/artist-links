import { BookOpen, Globe, Link2, Music2, Users } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { GROUPS, PLATFORM_LIST, type Group } from "@/lib/platforms";
import { platformIcon } from "@/lib/platform-icons";
import { Section, StaticPage } from "../StaticPage";

const GROUP_ICONS: Record<Group, typeof Music2> = {
  Streaming: Music2,
  Social: Users,
  Reference: BookOpen,
  "Official website": Globe,
  Other: Link2,
};

const GROUP_BLURBS: Record<Group, string> = {
  Streaming: "Places to listen to or buy an artist's music.",
  Social: "Social networks, video, fan-support and link-in-bio pages.",
  Reference: "Encyclopedias, databases and lyric or discography sites.",
  "Official website":
    "Whatever MusicBrainz lists as the artist's official homepage. It can be any domain, so there is no fixed list.",
  Other:
    "Concert and ticket sites. Any link we do not recognise is also shown here, under its domain name.",
};

export function PlatformsPage() {
  return (
    <StaticPage
      title="Supported platforms"
      lead={`Artist Links recognises ${PLATFORM_LIST.length} platforms by name. Each one gets its own label, an icon where one exists, and a place in the right group on the artist page.`}
    >
      <Section title="What recognised means">
        <p>
          Any link that MusicBrainz has stored for an artist is shown. Recognising a platform only
          decides how it is labelled and grouped. Below, each platform has an example of the kind of
          link it matches (parts in <code>&lt;angle brackets&gt;</code> are placeholders). You can
          paste an artist profile link from any of them to find the artist, see{" "}
          <Link to="/how-it-works">how it works</Link>.
        </p>
      </Section>

      {GROUPS.map((group) => {
        const platforms = PLATFORM_LIST.filter((p) => p.group === group);
        const GroupIcon = GROUP_ICONS[group];
        return (
          <section key={group} aria-labelledby={`group-${group}`}>
            <h2 id={`group-${group}`} className="font-display text-2xl sm:text-3xl tracking-tight">
              {group}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">{GROUP_BLURBS[group]}</p>
            {platforms.length > 0 && (
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {platforms.map((p) => {
                  const Brand = platformIcon(p.name);
                  const Icon = Brand ?? GroupIcon;
                  return (
                    <li
                      key={p.name}
                      className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
                    >
                      <span
                        aria-hidden="true"
                        className="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"
                      >
                        <Icon className="size-5" />
                      </span>
                      <div className="min-w-0">
                        <div className="text-sm font-medium">{p.name}</div>
                        <div className="break-all text-xs text-muted-foreground">{p.example}</div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </StaticPage>
  );
}
