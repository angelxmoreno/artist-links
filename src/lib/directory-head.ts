// Head tags for the /artists directory pages (index and per-letter), shared by both routes.
import { directoryPath, letterLabel, PAGE_SIZE } from "./directory";
import type { DirectoryData } from "./directory-api";
import { pageHead } from "./seo";

export function directoryTitle(letter: string | null, page: number): string {
  const base = letter ? `Artists starting with ${letterLabel(letter)}` : "Artist directory A-Z";
  return `${base}${page > 1 ? ` (page ${page})` : ""} | Artist Links`;
}

export function directoryDescription(letter: string | null, total: number): string {
  const count = `${total} ${total === 1 ? "artist" : "artists"}`;
  return letter
    ? `${count} whose name starts with ${letterLabel(letter)}. Open one to see all of their streaming, social and official links.`
    : `Browse ${count} from A to Z. Open one to see all of their streaming, social and official links.`;
}

export function directoryHead(data: DirectoryData, letter: string | null, origin: string | null) {
  const page = data.page;
  if (!page) return {};
  const path = directoryPath(letter, page.page);
  const title = directoryTitle(letter, page.page);
  return pageHead({
    title,
    description: directoryDescription(letter, page.total),
    path,
    origin,
    prev: page.page > 1 ? directoryPath(letter, page.page - 1) : null,
    next: page.page < page.pageCount ? directoryPath(letter, page.page + 1) : null,
    jsonLd: origin
      ? [
          {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: title,
            url: `${origin}${path}`,
            mainEntity: {
              "@type": "ItemList",
              numberOfItems: page.total,
              itemListElement: page.items.map((a, i) => ({
                "@type": "ListItem",
                position: (page.page - 1) * PAGE_SIZE + i + 1,
                name: a.name,
                url: `${origin}/artist/${a.mbid}`,
              })),
            },
          },
        ]
      : [],
  });
}
