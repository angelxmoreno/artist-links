import { Link } from "@tanstack/react-router";
import { FAQ } from "@/lib/faq";
import { Section, StaticPage } from "../StaticPage";

export function HowItWorksPage() {
  return (
    <StaticPage
      title="How Artist Links works"
      lead="There are two ways in: paste a link, or type a name. Either way you end up on a page with all of the artist's links."
    >
      <Section title="Two ways to search">
        <ol className="list-decimal space-y-3 pl-5">
          <li>
            <strong>Paste a link.</strong> Paste the artist's profile on Spotify, Apple Music,
            Instagram, Bandcamp, YouTube, their own website, or any other site. The link is tidied
            up (https, no <code>www.</code> or <code>m.</code>, no query string or fragment), then
            matched against the links stored on MusicBrainz. If an artist has that link, you are
            taken to their page.
          </li>
          <li>
            <strong>Search by name.</strong> Start typing and up to five matching artists are
            suggested, with a short description, country and years to help tell namesakes apart.
            Pick one to open their page.
          </li>
        </ol>
        <p>
          The artist page lists every link MusicBrainz has for them, grouped and labelled, with
          buttons to open or copy each one. Its address is <code>/artist/&lt;id&gt;</code>, so you
          can share it or bookmark it.
        </p>
      </Section>

      <Section title="What is recognised">
        <p>
          Artist profile links work from any site, as long as MusicBrainz has that link attached to
          the artist. The <Link to="/platforms">platforms page</Link> lists the sites we label with
          a name and an icon; anything else is still shown, under its domain name.
        </p>
        <p>
          Track and album links are not supported yet. A link to a song, album, playlist, episode,
          podcast show, Instagram post or reel, YouTube video or playlist, or a SoundCloud set is
          turned away with a note asking for the artist's profile link instead.
        </p>
      </Section>

      <Section title="What is cached">
        <p>
          MusicBrainz asks apps to send at most one request per second, so Artist Links queues its
          requests and keeps what it learns. This is why a popular artist's page opens quickly and a
          brand new one can take a moment.
        </p>
        <ul>
          <li>MusicBrainz answers are kept for 24 hours; "not found" answers for 1 hour.</li>
          <li>A photo lookup is kept for 7 days; "this artist has no photo" for 1 day.</li>
          <li>
            Artists whose page was opened (and who have at least one link) are remembered, with
            their name, so they can be listed in the <Link to="/artists">artist directory</Link> and
            the sitemap. An artist nobody opens for a year drops out.
          </li>
          <li>
            Your recently viewed artists are kept in your own browser, not on our server. See the{" "}
            <Link to="/privacy">privacy page</Link>.
          </li>
        </ul>
      </Section>

      <Section id="faq" title="Questions and answers">
        <dl className="space-y-6">
          {FAQ.map((item) => (
            <div key={item.question}>
              <dt className="font-medium">{item.question}</dt>
              <dd className="mt-1 text-foreground/90">
                {item.answer}
                {item.more && (
                  <>
                    {" "}
                    <Link to={item.more.to}>{item.more.label}</Link>.
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    </StaticPage>
  );
}
