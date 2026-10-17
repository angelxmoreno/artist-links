import type { Artist } from "./types";

export function shortUrl(u: string) {
  return u.replace(/^https?:\/\//, "").replace(/^www\./, "");
}

export function years(a: Artist) {
  const ls = a["life-span"];
  if (!ls?.begin) return "";
  return `${ls.begin.slice(0, 4)}–${ls.end ? ls.end.slice(0, 4) : ls.ended ? "?" : "present"}`;
}
