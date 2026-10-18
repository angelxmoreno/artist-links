import { version as packageVersion } from "../../package.json";
import { resolveVersion } from "../lib/release";

/** Deployed version: APP_VERSION override, else the package.json version as a tag (see resolveVersion). */
export function getVersion(): string {
  return resolveVersion(process.env["APP_VERSION"], packageVersion);
}
