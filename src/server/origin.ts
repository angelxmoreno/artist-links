import { getPublicConfig } from "./config";

/** SITE_URL if set, else the origin the client used (honors reverse-proxy headers). */
export function originFromRequest(request: Request): string {
  const siteUrl = getPublicConfig().siteUrl;
  if (siteUrl) return siteUrl.replace(/\/+$/, "");
  const url = new URL(request.url);
  const host = request.headers.get("x-forwarded-host") ?? url.host;
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  return `${proto}://${host}`;
}
