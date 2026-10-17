export class UnsupportedUrl extends Error {}

export function normalizeUrl(input: string): URL {
  let s = input.trim();
  if (!/^https?:\/\//i.test(s)) s = "https://" + s;
  const u = new URL(s);
  u.protocol = "https:";
  u.hostname = u.hostname.toLowerCase().replace(/^(www\.|m\.)/, "");
  u.search = "";
  u.hash = "";
  let path = u.pathname;
  if (u.hostname === "open.spotify.com") path = path.replace(/^\/intl-[a-z-]+\//i, "/");
  u.pathname = path;
  const p = path.toLowerCase();
  const bad =
    /\/(track|album|playlist|episode|show)\//.test(p) ||
    /\/(watch|playlist)$/.test(p) ||
    (u.hostname.endsWith("bandcamp.com") && /\/(track|album)\//.test(p)) ||
    (u.hostname === "soundcloud.com" && /\/sets\//.test(p)) ||
    (u.hostname.endsWith("music.apple.com") && /\/(album|song|playlist)\//.test(p)) ||
    (u.hostname === "instagram.com" && /^\/(p|reel)\//.test(p));
  if (bad) throw new UnsupportedUrl("Paste an artist profile link instead.");
  return u;
}

export function urlVariants(u: URL): string[] {
  const host = u.hostname.replace(/^www\./, "");
  const path = u.pathname.replace(/\/+$/, "");
  const hosts = [host, "www." + host];
  const out: string[] = [];
  for (const h of hosts) for (const p of [path, path + "/"]) out.push(`https://${h}${p || "/"}`);
  return [...new Set(out)];
}
