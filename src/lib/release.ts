/**
 * Release name reported to Bugsink: SENTRY_RELEASE if set, else the deployed tag (APP_VERSION),
 * else none. "unknown" is the APP_VERSION placeholder, not a real release.
 */
export function resolveRelease(
  sentryRelease: string | undefined,
  appVersion: string | undefined,
): string | null {
  const explicit = sentryRelease?.trim();
  if (explicit) return explicit;
  const version = appVersion?.trim();
  return version && version !== "unknown" ? version : null;
}
