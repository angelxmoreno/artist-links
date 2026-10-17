export type AnalyticsEvent =
  "lookup_url" | "lookup_name" | "artist_view" | "link_click" | "featured_click";

declare global {
  interface Window {
    umami?: { track: (event: string, data?: Record<string, string | number>) => void };
  }
}

/** Never pass the pasted URL as a prop. No-ops on the server or when Umami is not loaded. */
export function track(event: AnalyticsEvent, props?: Record<string, string | number>): void {
  if (typeof window === "undefined") return;
  try {
    window.umami?.track(event, props);
  } catch {
    // analytics must never break the app
  }
}
