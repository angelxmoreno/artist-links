// Common TLDs that make a bare "host.tld" (no path) count as a link. Without a
// path we need this guard so names like "St.Vincent" or "Mr.Brightside" are not
// mistaken for hosts. With a path, any TLD is accepted ("spoti.fi/abc").
const COMMON_TLDS =
  "com|net|org|io|co|fm|me|tv|app|dev|xyz|info|link|page|music|band|studio|bio|site|online|ly|to|be|us|uk|de|fr|es|it|nl|se|no|dk|fi|jp|br|ca|au|nz|ie|ch|at|pl|ru|mx|ar|cl|in|kr|cn";

const SCHEME = /^https?:\/\/\S+$/i;
const HOST = "(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+";
const WITH_PATH = new RegExp(`^${HOST}[a-z]{2,24}(?::\\d+)?[/?#]\\S*$`, "i");
const BARE_COMMON = new RegExp(`^${HOST}(?:${COMMON_TLDS})(?::\\d+)?$`, "i");

/** True when the input looks like a link (to look up) rather than an artist name. */
export function looksLikeUrl(input: string): boolean {
  const s = input.trim();
  if (!s || /\s/.test(s)) return false;
  if (SCHEME.test(s)) return true;
  return WITH_PATH.test(s) || BARE_COMMON.test(s);
}
