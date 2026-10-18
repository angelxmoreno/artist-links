/** Deployed version (git tag) baked in at image build via APP_VERSION; "unknown" if unset. */
export function getVersion(): string {
  return process.env["APP_VERSION"]?.trim() || "unknown";
}
