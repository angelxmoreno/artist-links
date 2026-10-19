import { Link } from "@tanstack/react-router";
import { REPO_URL } from "@/lib/nav";
import { Section, StaticPage } from "../StaticPage";

export const PRIVACY_UPDATED = "2026-10-18";

/**
 * Plain-language description of what the app does with data. Every statement here was checked
 * against the code (see the pull request); if the code changes, change this page with it.
 */
export function PrivacyPage() {
  return (
    <StaticPage
      title="Privacy"
      lead="Artist Links has no accounts and asks you for nothing. This page lists what is still recorded when you use it, by whom, and why."
    >
      <p className="-mt-6 text-sm text-muted-foreground">Last updated {PRIVACY_UPDATED}</p>

      <Section title="What you send when you search">
        <p>
          When you paste a link or type a name, that text is sent to our server. The server asks{" "}
          <a href="https://musicbrainz.org" target="_blank" rel="noreferrer">
            MusicBrainz
          </a>{" "}
          for the matching artist, and the pasted link or typed name is part of that request. The
          request to MusicBrainz identifies Artist Links (with a contact address for the project),
          not you. See the{" "}
          <a href="https://metabrainz.org/privacy" target="_blank" rel="noreferrer">
            MetaBrainz privacy policy
          </a>{" "}
          for what MusicBrainz does with requests.
        </p>
      </Section>

      <Section title="What the server keeps">
        <ul>
          <li>
            <strong>A cache of answers.</strong> MusicBrainz's answers are kept so the next visitor
            gets them faster: for 24 hours (1 hour when nothing was found). The cache is indexed by
            the request, so a pasted link or a searched name is stored in it for that time. Nothing
            that identifies you is stored with it. Which photo an artist has is cached too (by the
            artist's Wikidata ID), for up to 7 days.
          </li>
          <li>
            <strong>A list of viewed artists.</strong> When an artist page that has at least one
            link is opened, the artist's MusicBrainz ID and name are remembered, so the artist can
            appear in the sitemap. Entries expire after a year without a view. This list holds no
            information about who viewed what.
          </li>
          <li>
            <strong>A request counter.</strong> To keep one visitor from overloading MusicBrainz,
            the server counts, in memory only, how many lookups each visitor's address has caused in
            the last minute. The address comes from the headers added by the proxies in front of the
            app. The counts are never written to disk and are lost on restart.
          </li>
          <li>
            <strong>Logs.</strong> The app logs server errors and warnings, not visitors' requests.
            The hosting setup in front of it may keep ordinary access logs of its own.
          </li>
        </ul>
      </Section>

      <Section title="What stays in your browser">
        <p>
          The "Recently viewed" list on the home page is stored in your browser's local storage (the
          key is <code>artist-links:recent</code>): up to 12 artists with their ID, name, a short
          subtitle (type and country) and the time you viewed them. It is never sent to our server
          by the app. The Clear button empties it, and so does clearing your browser's site data.
        </p>
      </Section>

      <Section title="Analytics">
        <p>
          If the site is set up with it, it uses{" "}
          <a href="https://umami.is" target="_blank" rel="noreferrer">
            Umami
          </a>{" "}
          to count visits. Umami's script is loaded from the address the site operator configured
          and records page views the way Umami normally does; see Umami's own documentation for the
          details. On top of that, the site sends these events:
        </p>
        <ul>
          <li>
            <code>lookup_url</code>, <code>lookup_name</code>, <code>artist_view</code> and{" "}
            <code>featured_click</code>: that the action happened, with no details.
          </li>
          <li>
            <code>link_click</code>: that someone opened a link on an artist page, with the artist's
            name and MusicBrainz ID and the platform and group of the link (for example Spotify,
            Streaming). This tells us which links are useful.
          </li>
        </ul>
        <p>These events never include the link you pasted or the name you searched for.</p>
      </Section>

      <Section title="Error reports">
        <p>
          When something breaks, the app can send an error report to Bugsink, an error tracker run
          by the site operator (through the Sentry software libraries, which Bugsink understands).
          Reports describe the error: its message, where in the code it happened and which version
          of the app was running. The setup turns off performance tracing, session replay and
          profiling, and does not collect user details, cookies, request headers, request bodies or
          the query string of the page address.
        </p>
      </Section>

      <Section title="Cookies">
        <p>
          The Artist Links app does not set cookies. It has no sessions or sign-in. The site is
          served through Cloudflare, which can set its own cookies for security and performance;
          those are outside the app's control. See{" "}
          <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noreferrer">
            Cloudflare's privacy policy
          </a>
          .
        </p>
      </Section>

      <Section title="Other sites">
        <ul>
          <li>
            <strong>Cloudflare.</strong> Requests to the site pass through Cloudflare, which sees
            them (including your IP address) as any proxy does.
          </li>
          <li>
            <strong>Wikimedia.</strong> Artist photos are loaded by your browser straight from
            Wikimedia Commons, so Wikimedia receives your request for the picture. Our server also
            asks Wikidata and Commons which photo an artist has; those requests carry the artist's
            Wikidata ID, not anything about you. See the{" "}
            <a
              href="https://foundation.wikimedia.org/wiki/Policy:Privacy_policy"
              target="_blank"
              rel="noreferrer"
            >
              Wikimedia privacy policy
            </a>
            .
          </li>
          <li>
            <strong>The links we show.</strong> When you open one, you leave Artist Links and that
            site's own privacy rules apply.
          </li>
        </ul>
      </Section>

      <Section title="Questions">
        <p>
          The code is open, so you can check all of this yourself:{" "}
          <a href={REPO_URL} target="_blank" rel="noreferrer">
            github.com/angelxmoreno/artist-links
          </a>
          . Questions and corrections are welcome as issues there. This page describes how the
          software works; it is not legal advice.
        </p>
      </Section>
    </StaticPage>
  );
}
