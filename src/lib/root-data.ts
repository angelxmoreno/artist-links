import { createServerFn } from "@tanstack/react-start";

import type { PublicConfig } from "./api-types";

export interface RootData {
  config: PublicConfig;
  /** Absolute base URL for canonical/OG tags: SITE_URL, else the request origin. */
  origin: string | null;
}

// Lives outside src/server/ because TanStack's import protection denies that
// directory in the client graph; the handler body is stripped from the client bundle.
export const getRootData = createServerFn({ method: "GET" }).handler(
  async (): Promise<RootData> => {
    const { getPublicConfig } = await import("../server/config");
    const config = getPublicConfig();
    if (config.siteUrl) return { config, origin: config.siteUrl };
    const { getRequestUrl } = await import("@tanstack/react-start/server");
    const url = getRequestUrl({ xForwardedHost: true, xForwardedProto: true });
    return { config, origin: url.origin };
  },
);
