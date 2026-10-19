import { Link } from "@tanstack/react-router";
import { REPO_URL } from "@/lib/nav";
import { Section, StaticPage } from "../StaticPage";

export function AboutPage() {
  return (
    <StaticPage
      title="About Artist Links"
      lead="Paste one link to a music artist, or search by name, and get every other official link we can find for them in one place."
    >
      <Section title="What it does">
        <p>
          Artists are spread over a dozen sites: a streaming profile here, an Instagram account
          there, a Bandcamp page, a website. Artist Links starts from any one of them (a Spotify,
          Instagram or Bandcamp profile, an official website) or from the artist's name, works out
          which artist it is, and lists the rest.
        </p>
        <p>
          The links are grouped into Streaming, Social, Reference, Official website and Other. Each
          one has an open button and a copy button, and there is a button that copies them all.
          Every artist has a page of their own at an address you can share.
        </p>
        <p>
          See <Link to="/how-it-works">how it works</Link> for the details and{" "}
          <Link to="/platforms">the platforms we recognise</Link>..
        </p>
      </Section>

      <Section title="Where the data comes from">
        <p>
          All artist names and links come from{" "}
          <a href="https://musicbrainz.org" target="_blank" rel="noreferrer">
            MusicBrainz
          </a>
          , the open music encyclopedia that anyone can edit. MusicBrainz's core data is released
          under the CC0 public domain dedication, which is what lets a site like this one exist.
          Thank you to everyone who curates it.
        </p>
        <p>
          We do not collect links ourselves and we do not guess. If a link is missing or wrong, the
          fix belongs on MusicBrainz, and it will show up here within about a day.
        </p>
        <p>
          Artist photos come from{" "}
          <a href="https://commons.wikimedia.org" target="_blank" rel="noreferrer">
            Wikimedia Commons
          </a>
          . When MusicBrainz links an artist to Wikidata, we use the picture Wikidata lists for
          them. Each photo is captioned and links to its Commons page, which shows the author and
          the license.
        </p>
      </Section>

      <Section title="Open source">
        <p>
          The code is public:{" "}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            github.com/angelxmoreno/artist-links
          </a>
          . Bug reports, ideas and pull requests are welcome there.
        </p>
      </Section>

      <Section title="What it will not do">
        <ul>
          <li>
            It does not play, host or download music. It only points you to where the music is.
          </li>
          <li>
            It does not replace MusicBrainz. It shows a small part of what MusicBrainz has, and it
            never edits MusicBrainz.
          </li>
          <li>
            It does not make up links. An artist with no links on MusicBrainz shows no links here.
          </li>
          <li>
            It does not understand track, album or playlist links yet. Paste the artist's profile
            link instead.
          </li>
          <li>It has no accounts and no sign-in.</li>
        </ul>
        <p>
          What is collected when you use the site is described on the{" "}
          <Link to="/privacy">privacy page</Link>.
        </p>
      </Section>
    </StaticPage>
  );
}
