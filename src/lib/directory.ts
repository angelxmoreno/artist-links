// Pure helpers for the /artists directory: letter grouping, sorting, pagination and the
// list of directory URLs for the sitemap. No server imports, so tests and routes can share them.

export interface DirectoryEntry {
  mbid: string;
  name: string;
}

/** Entries per directory page. Keeps the HTML small and the page fast. */
export const PAGE_SIZE = 100;

/** Path segment for names that do not start with A-Z (digits, symbols, other alphabets). */
export const OTHER_LETTER = "other";

export const LETTERS: string[] = [..."abcdefghijklmnopqrstuvwxyz"];
/** All valid values of the `$letter` route param. */
export const LETTER_KEYS: string[] = [...LETTERS, OTHER_LETTER];

/** "a".."z", or "other". Accents are ignored ("Édith Piaf" is under E). */
export function letterKey(name: string): string {
  const first = name.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").charAt(0).toLowerCase();
  return first >= "a" && first <= "z" ? first : OTHER_LETTER;
}

/** Heading text for a letter key. */
export function letterLabel(key: string): string {
  return key === OTHER_LETTER ? "#" : key.toUpperCase();
}

export function isLetterKey(value: string): boolean {
  return LETTER_KEYS.includes(value);
}

const collator = new Intl.Collator("en", { sensitivity: "base", numeric: true });

/** Sorted A-Z by name, names that do not start with A-Z last, one entry per mbid (ties by id). */
export function sortEntries(entries: DirectoryEntry[]): DirectoryEntry[] {
  const seen = new Set<string>();
  const unique = entries.filter((e) => !seen.has(e.mbid) && seen.add(e.mbid));
  const rank = (e: DirectoryEntry) => (letterKey(e.name) === OTHER_LETTER ? 1 : 0);
  return unique.sort(
    (a, b) => rank(a) - rank(b) || collator.compare(a.name, b.name) || a.mbid.localeCompare(b.mbid),
  );
}

export interface LetterCount {
  key: string;
  count: number;
}

/** Letters that have at least one artist, in A-Z order with "other" last. */
export function letterCounts(sorted: DirectoryEntry[]): LetterCount[] {
  const counts = new Map<string, number>();
  for (const e of sorted) counts.set(letterKey(e.name), (counts.get(letterKey(e.name)) ?? 0) + 1);
  return LETTER_KEYS.filter((k) => counts.has(k)).map((key) => ({ key, count: counts.get(key)! }));
}

export interface DirectoryPage {
  /** The letter being shown, or null for the whole A-Z list. */
  letter: string | null;
  page: number;
  pageCount: number;
  /** Number of artists under this letter (or in total). */
  total: number;
  items: DirectoryEntry[];
}

/**
 * One page of a sorted list. Returns null when the page is outside the range (page 1 of an empty
 * list is valid and gives an empty page, so a fresh install still renders).
 */
export function pageOf(
  sorted: DirectoryEntry[],
  letter: string | null,
  page: number,
  pageSize = PAGE_SIZE,
): DirectoryPage | null {
  const all = letter ? sorted.filter((e) => letterKey(e.name) === letter) : sorted;
  const pageCount = Math.max(1, Math.ceil(all.length / pageSize));
  if (!Number.isInteger(page) || page < 1 || page > pageCount) return null;
  const start = (page - 1) * pageSize;
  return { letter, page, pageCount, total: all.length, items: all.slice(start, start + pageSize) };
}

/** `?page=` as a search object: only a whole number above 1 is kept, so each page has one URL. */
export function parsePageParam(value: unknown): { page?: number } {
  const n = typeof value === "string" || typeof value === "number" ? Number(value) : NaN;
  return Number.isInteger(n) && n > 1 && n <= 100_000 ? { page: n } : {};
}

/** Path of a directory page. Page 1 has no query string, so each page has one URL. */
export function directoryPath(letter: string | null, page = 1): string {
  const base = letter ? `/artists/${letter}` : "/artists";
  return page > 1 ? `${base}?page=${page}` : base;
}

/** Every directory URL that has content, for the sitemap: the full list and each letter. */
export function directoryPaths(sorted: DirectoryEntry[], pageSize = PAGE_SIZE): string[] {
  if (sorted.length === 0) return ["/artists"];
  const paths: string[] = [];
  const add = (letter: string | null, total: number) => {
    const pages = Math.max(1, Math.ceil(total / pageSize));
    for (let p = 1; p <= pages; p++) paths.push(directoryPath(letter, p));
  };
  add(null, sorted.length);
  for (const { key, count } of letterCounts(sorted)) add(key, count);
  return paths;
}
