import * as Sentry from "@sentry/react";

let initialized = false;

/** Browser error reporting (Bugsink-compatible). No tracing, no replay, no PII. */
export function initClientMonitoring(
  dsn: string | null | undefined,
  environment?: string,
  release?: string | null,
): void {
  if (initialized || !dsn || typeof window === "undefined") return;
  initialized = true;
  Sentry.init({
    dsn,
    tracesSampleRate: 0,
    environment,
    ...(release ? { release } : {}),
    initialScope: { tags: { runtime: "browser" } },
    // Sentry 11 replaced sendDefaultPii with dataCollection. The pasted artist URL lives in
    // the ?url= query param, so query params are off along with all other PII sources.
    dataCollection: {
      userInfo: false,
      cookies: false,
      httpHeaders: false,
      httpBodies: [],
      urlQueryParams: false,
    },
    integrations: (defaults) =>
      defaults.filter((i) => !["BrowserTracing", "Replay", "BrowserProfiling"].includes(i.name)),
  });
}

export function captureClientException(error: unknown): void {
  if (!initialized) return;
  Sentry.captureException(error);
}
