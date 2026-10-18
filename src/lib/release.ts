/**
 * Deployed version, shown by /healthz: APP_VERSION when set (an override; "unknown" counts as
 * unset), otherwise the package.json version as a tag ("0.0.6" becomes "v0.0.6"). `bun run
 * release` keeps package.json and the git tag in step, so nothing needs setting in Dokploy.
 */
export function resolveVersion(appVersion: string | undefined, packageVersion: string): string {
  const override = appVersion?.trim();
  if (override && override !== "unknown") return override;
  return `v${packageVersion}`;
}

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
