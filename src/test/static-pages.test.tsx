import { cleanup, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { AboutPage } from "@/components/pages/AboutPage";
import { HowItWorksPage } from "@/components/pages/HowItWorksPage";
import { PlatformsPage } from "@/components/pages/PlatformsPage";
import { PrivacyPage } from "@/components/pages/PrivacyPage";
import { FAQ } from "@/lib/faq";
import { PLATFORM_LIST } from "@/lib/platforms";
import { Route as AboutRoute } from "@/routes/about";
import { Route as HowRoute } from "@/routes/how-it-works";
import { Route as PlatformsRoute } from "@/routes/platforms";
import { Route as PrivacyRoute } from "@/routes/privacy";
import { renderWithRouter } from "./render-with-router";

afterEach(cleanup);

const ORIGIN = "https://links.example";

type Meta = Record<string, unknown>;
type Head = { meta: Meta[]; links: { rel: string; href: string }[] };

function headOf(route: { options: { head?: unknown } }, origin: string | null = ORIGIN): Head {
  const head = route.options.head as (ctx: { matches: unknown[] }) => Head;
  return head({ matches: [{ routeId: "__root__", loaderData: { origin } }] });
}

const only = (meta: Meta[], key: "name" | "property", value: string) =>
  meta.filter((m) => m[key] === value);

const PAGES = [
  { name: "about", route: AboutRoute, path: "/about" },
  { name: "how it works", route: HowRoute, path: "/how-it-works" },
  { name: "platforms", route: PlatformsRoute, path: "/platforms" },
  { name: "privacy", route: PrivacyRoute, path: "/privacy" },
];

describe.each(PAGES)("$name page head", ({ route, path }) => {
  it("has one title, description, canonical and og tags built from the origin", () => {
    const { meta, links } = headOf(route);
    const titles = meta.filter((m) => typeof m["title"] === "string");
    expect(titles).toHaveLength(1);
    const title = titles[0]!["title"] as string;
    expect(title.length).toBeGreaterThan(5);
    expect(title.length).toBeLessThanOrEqual(80);

    const description = only(meta, "name", "description");
    expect(description).toHaveLength(1);
    const text = description[0]!["content"] as string;
    expect(text.length).toBeGreaterThan(50);
    expect(text.length).toBeLessThanOrEqual(200);

    expect(only(meta, "property", "og:title")).toEqual([{ property: "og:title", content: title }]);
    expect(only(meta, "property", "og:description")).toEqual([
      { property: "og:description", content: text },
    ]);
    expect(only(meta, "property", "og:url")).toEqual([
      { property: "og:url", content: `${ORIGIN}${path}` },
    ]);
    expect(links.filter((l) => l.rel === "canonical")).toEqual([
      { rel: "canonical", href: `${ORIGIN}${path}` },
    ]);
  });

  it("leaves out the url tags when the origin is unknown", () => {
    const { meta, links } = headOf(route, null);
    expect(only(meta, "property", "og:url")).toHaveLength(0);
    expect(links).toEqual([]);
  });
});

describe("page titles and descriptions", () => {
  it("are different on every page", () => {
    const heads = PAGES.map((p) => headOf(p.route).meta);
    const titles = heads.map((m) => m.find((x) => "title" in x)!["title"]);
    const descriptions = heads.map((m) => only(m, "name", "description")[0]!["content"]);
    expect(new Set(titles).size).toBe(PAGES.length);
    expect(new Set(descriptions).size).toBe(PAGES.length);
  });
});

describe("/how-it-works", () => {
  it("shows every FAQ question and describes the same ones in FAQPage JSON-LD", async () => {
    await renderWithRouter(<HowItWorksPage />);
    for (const item of FAQ) expect(screen.getByText(item.question)).toBeInTheDocument();

    const ld = headOf(HowRoute).meta.find((m) => "script:ld+json" in m)!["script:ld+json"] as {
      "@type": string;
      mainEntity: { name: string; acceptedAnswer: { text: string } }[];
    };
    expect(ld["@type"]).toBe("FAQPage");
    expect(ld.mainEntity.map((q) => q.name)).toEqual(FAQ.map((i) => i.question));
    for (const q of ld.mainEntity)
      expect(document.body.textContent).toContain(q.acceptedAnswer.text);
  });

  it("says that track and album links are not supported yet", async () => {
    await renderWithRouter(<HowItWorksPage />);
    expect(screen.getAllByText(/not supported yet/i).length).toBeGreaterThan(0);
  });

  it("is the only page with JSON-LD of its own", () => {
    for (const p of PAGES.filter((x) => x.path !== "/how-it-works"))
      expect(headOf(p.route).meta.some((m) => "script:ld+json" in m)).toBe(false);
  });
});

describe("/about", () => {
  it("credits MusicBrainz and links to the repo, with no owner named", async () => {
    await renderWithRouter(<AboutPage />);
    const main = screen.getByRole("article");
    expect(within(main).getByRole("link", { name: "MusicBrainz" })).toHaveAttribute(
      "href",
      "https://musicbrainz.org",
    );
    expect(
      within(main).getByRole("link", { name: /github\.com\/angelxmoreno\/artist-links/ }),
    ).toHaveAttribute("href", "https://github.com/angelxmoreno/artist-links");
    expect(within(main).getByText(/CC0/)).toBeInTheDocument();
    expect(within(main).getByRole("link", { name: "Wikimedia Commons" })).toBeInTheDocument();
    const prose = (main.textContent ?? "").replace("github.com/angelxmoreno/artist-links", "");
    expect(prose).not.toMatch(/Angel|Moreno|created by|built by|owner/i);
  });
});

describe("/platforms", () => {
  it("lists every platform in the table, with its example link", async () => {
    await renderWithRouter(<PlatformsPage />);
    expect(PLATFORM_LIST.length).toBeGreaterThan(40);
    for (const p of PLATFORM_LIST) {
      expect(screen.getByText(p.name, { selector: "div" })).toBeInTheDocument();
      expect(screen.getByText(p.example)).toBeInTheDocument();
    }
  });

  it("groups platforms under the same headings as the artist page", async () => {
    await renderWithRouter(<PlatformsPage />);
    for (const group of ["Streaming", "Social", "Reference", "Official website", "Other"])
      expect(screen.getByRole("heading", { level: 2, name: group })).toBeInTheDocument();
    const streaming = screen
      .getByRole("heading", { level: 2, name: "Streaming" })
      .closest("section")!;
    expect(within(streaming).getByText("Spotify", { selector: "div" })).toBeInTheDocument();
    expect(within(streaming).queryByText("Instagram", { selector: "div" })).not.toBeInTheDocument();
  });

  it("states how many platforms there are from the table", async () => {
    await renderWithRouter(<PlatformsPage />);
    expect(
      screen.getByText(new RegExp(`recognises ${PLATFORM_LIST.length} platforms`)),
    ).toBeInTheDocument();
  });
});

describe("/privacy", () => {
  it("names each analytics event the app sends", async () => {
    await renderWithRouter(<PrivacyPage />);
    for (const event of [
      "lookup_url",
      "lookup_name",
      "artist_view",
      "link_click",
      "featured_click",
    ])
      expect(screen.getByText(event)).toBeInTheDocument();
  });

  it("covers the server cache, the browser list, errors, images and Cloudflare", async () => {
    await renderWithRouter(<PrivacyPage />);
    const text = screen.getByRole("article").textContent ?? "";
    for (const needle of [
      "artist-links:recent",
      "Bugsink",
      "Wikimedia",
      "Cloudflare",
      "24 hours",
      "does not set cookies",
    ])
      expect(text).toContain(needle);
  });

  it("makes no legal promises and lists no contact details", async () => {
    await renderWithRouter(<PrivacyPage />);
    const text = screen.getByRole("article").textContent ?? "";
    expect(text).not.toMatch(/GDPR|CCPA|compliant|we never|@[a-z0-9-]+\.[a-z]/i);
    expect(text).toMatch(/not legal advice/i);
  });
});
