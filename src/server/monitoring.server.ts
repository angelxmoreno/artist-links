// Backend error reporting (Sentry SDK -> Bugsink). Only loaded via dynamic import
// from src/server.ts, and a no-op unless SENTRY_DSN is set.
import type * as SentryNode from "@sentry/node";
import { sentryEnvironment, sentryRelease } from "./config";

let sentry: typeof SentryNode | null | undefined;
let initPromise: Promise<typeof SentryNode | null> | undefined;

async function load(): Promise<typeof SentryNode | null> {
  const dsn = process.env["SENTRY_DSN"]?.trim();
  if (!dsn) return null;
  try {
    const Sentry = await import("@sentry/node");
    Sentry.init({
      dsn,
      tracesSampleRate: 0,
      dataCollection: {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
      },
      release: sentryRelease() ?? undefined,
      environment: sentryEnvironment(),
      initialScope: { tags: { runtime: "server" } },
    });
    registerShutdownFlush();
    return Sentry;
  } catch (error) {
    console.warn("[monitoring] Sentry init failed", error);
    return null;
  }
}

// Nitro's node-server runtime owns graceful shutdown and exits the process; we only
// give Sentry a chance to flush queued events alongside it (best effort).
function registerShutdownFlush(): void {
  if (typeof process === "undefined" || typeof process.once !== "function") return;
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    process.once(signal, () => void flushServerMonitoring());
  }
}

export function initServerMonitoring(): Promise<typeof SentryNode | null> {
  initPromise ??= load().then((s) => (sentry = s));
  return initPromise;
}

export async function captureServerException(error: unknown): Promise<void> {
  const Sentry = await initServerMonitoring();
  Sentry?.captureException(error);
}

export async function flushServerMonitoring(timeoutMs = 2000): Promise<void> {
  if (!sentry) return;
  try {
    await sentry.flush(timeoutMs);
  } catch {
    // best effort
  }
}
