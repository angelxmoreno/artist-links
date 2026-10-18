import { Link } from "@tanstack/react-router";
import type { DirectoryData } from "@/lib/directory-api";
import { letterKey, letterLabel, LETTER_KEYS, type DirectoryPage } from "@/lib/directory";
import { StaticPage } from "../StaticPage";

const CHIP =
  "inline-flex h-9 min-w-9 items-center justify-center rounded-lg border px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const CHIP_LINK = `${CHIP} border-border bg-card hover:bg-accent`;
const CHIP_ACTIVE = `${CHIP} border-primary bg-primary text-primary-foreground`;
const CHIP_OFF = `${CHIP} border-transparent text-muted-foreground/50`;

const pageSearch = (page: number) => (page > 1 ? { page } : {});

function LetterNav({ data, current }: { data: DirectoryData; current: string | null }) {
  const present = new Map(data.letters.map((l) => [l.key, l.count]));
  return (
    <nav aria-label="Browse by letter" className="mt-8">
      <ul className="flex flex-wrap gap-1.5">
        <li>
          <Link
            to="/artists"
            className={current === null ? CHIP_ACTIVE : CHIP_LINK}
            aria-current={current === null ? "page" : undefined}
          >
            All
          </Link>
        </li>
        {LETTER_KEYS.map((key) => {
          const count = present.get(key);
          return (
            <li key={key}>
              {count ? (
                <Link
                  to="/artists/$letter"
                  params={{ letter: key }}
                  className={current === key ? CHIP_ACTIVE : CHIP_LINK}
                  aria-current={current === key ? "page" : undefined}
                  aria-label={`${letterLabel(key)}, ${count} ${count === 1 ? "artist" : "artists"}`}
                >
                  {letterLabel(key)}
                </Link>
              ) : (
                <span className={CHIP_OFF} aria-hidden="true">
                  {letterLabel(key)}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function Pagination({ page }: { page: DirectoryPage }) {
  if (page.pageCount <= 1) return null;
  const to = (n: number) =>
    page.letter ? (
      <Link
        to="/artists/$letter"
        params={{ letter: page.letter }}
        search={pageSearch(n)}
        rel={n < page.page ? "prev" : "next"}
        className={CHIP_LINK}
      >
        {n < page.page ? "Previous" : "Next"}
      </Link>
    ) : (
      <Link
        to="/artists"
        search={pageSearch(n)}
        rel={n < page.page ? "prev" : "next"}
        className={CHIP_LINK}
      >
        {n < page.page ? "Previous" : "Next"}
      </Link>
    );
  return (
    <nav aria-label="Pagination" className="mt-8 flex items-center justify-between gap-4">
      <div className="min-w-20">{page.page > 1 && to(page.page - 1)}</div>
      <p className="text-sm text-muted-foreground">
        Page {page.page} of {page.pageCount}
      </p>
      <div className="flex min-w-20 justify-end">
        {page.page < page.pageCount && to(page.page + 1)}
      </div>
    </nav>
  );
}

/** The items of one page, under a heading per starting letter. */
function groupByLetter(items: DirectoryPage["items"]) {
  const groups: { key: string; items: DirectoryPage["items"] }[] = [];
  for (const item of items) {
    const key = letterKey(item.name);
    const last = groups.at(-1);
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, items: [item] });
  }
  return groups;
}

export function ArtistDirectory({ data, letter }: { data: DirectoryData; letter: string | null }) {
  const page = data.page;
  const title = letter ? `Artists starting with ${letterLabel(letter)}` : "Artist directory";
  return (
    <StaticPage
      title={title}
      lead={
        letter
          ? `${page?.total ?? 0} ${page?.total === 1 ? "artist" : "artists"} in the directory.`
          : "Artists with links on Artist Links, from A to Z. Pick one to see all of their links."
      }
    >
      <div className="-mt-6">
        <LetterNav data={data} current={letter} />
      </div>

      {!page || page.items.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-6 text-center">
          <p className="font-medium">No artists here yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Artists appear in the directory once someone looks them up. Paste a link or search by
            name on the{" "}
            <Link to="/" className="underline">
              home page
            </Link>{" "}
            to add the first.
          </p>
        </div>
      ) : (
        <>
          {groupByLetter(page.items).map((group) => (
            <section key={group.key} aria-labelledby={`letter-${group.key}`}>
              <h2
                id={`letter-${group.key}`}
                className="font-display text-3xl tracking-tight text-primary"
              >
                {letterLabel(group.key)}
              </h2>
              <ul className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                {group.items.map((a) => (
                  <li key={a.mbid}>
                    <Link
                      to="/artist/$mbid"
                      params={{ mbid: a.mbid }}
                      className="block rounded-md px-2 py-1.5 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {a.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <Pagination page={page} />
        </>
      )}
    </StaticPage>
  );
}
