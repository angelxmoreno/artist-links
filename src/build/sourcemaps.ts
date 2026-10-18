// Build-time only (imported by vite.config.ts, never by app code).
// After the production build: inject debug IDs and upload the browser source maps to
// Bugsink with sentry-cli, then delete every .map so none ships in the image.
// Bugsink resolves stack traces by debug ID, so no release/URL matching is involved.
import { execFile } from "node:child_process";
import { readdir, rm } from "node:fs/promises";
import { createRequire } from "node:module";
import { join } from "node:path";
import { promisify } from "node:util";

export const DEFAULT_SENTRY_URL = "https://bugsink.2719.fyi";
// Bugsink has no organizations (docs use this placeholder) and ignores --project, but
// sentry-cli insists on both flags.
export const DEFAULT_SENTRY_ORG = "bugsinkhasnoorgs";
export const DEFAULT_SENTRY_PROJECT = "artist-links";

export interface SourcemapOptions {
  /** Directory served to browsers, e.g. .output/public. */
  dir: string;
  /** Bugsink auth token; upload is skipped when empty. */
  token?: string | undefined;
  url?: string | undefined;
  org?: string | undefined;
  project?: string | undefined;
  /** Release name, used only for the log line (Bugsink matches by debug ID). */
  release?: string | null | undefined;
  log?: (message: string) => void;
  /** Runs sentry-cli with the given args; the token is passed in env, never argv. */
  run?: (args: string[], env: NodeJS.ProcessEnv) => Promise<void>;
}

export interface SourcemapResult {
  uploaded: boolean;
  deleted: number;
}

export async function findMaps(dir: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true, recursive: true });
  } catch {
    return [];
  }
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".map"))
    .map((e) => join(e.parentPath, e.name));
}

const execFileAsync = promisify(execFile);

async function runSentryCli(args: string[], env: NodeJS.ProcessEnv): Promise<void> {
  const cli = createRequire(import.meta.url)("@sentry/cli") as { getPath(): string };
  const { stdout, stderr } = await execFileAsync(cli.getPath(), args, {
    env,
    maxBuffer: 16 * 1024 * 1024,
  });
  for (const out of [stdout, stderr]) if (out.trim()) console.log(out.trimEnd());
}

export async function processSourcemaps(options: SourcemapOptions): Promise<SourcemapResult> {
  const { dir, token } = options;
  const log = options.log ?? ((m: string) => console.log(m));
  const run = options.run ?? runSentryCli;
  const maps = await findMaps(dir);
  let uploaded = false;
  try {
    if (maps.length === 0) {
      log("[sourcemaps] no .map files found, nothing to upload");
    } else if (!token) {
      log(
        `[sourcemaps] SENTRY_AUTH_TOKEN not set: skipping upload of ${maps.length} source maps (errors will show minified stack traces)`,
      );
    } else {
      const url = options.url || DEFAULT_SENTRY_URL;
      const env = { ...process.env, SENTRY_AUTH_TOKEN: token };
      log(
        `[sourcemaps] uploading ${maps.length} source maps to ${url}` +
          (options.release ? ` (release ${options.release})` : ""),
      );
      await run(["sourcemaps", "inject", dir], env);
      await run(
        [
          "--url",
          url,
          "sourcemaps",
          "upload",
          "--org",
          options.org || DEFAULT_SENTRY_ORG,
          "--project",
          options.project || DEFAULT_SENTRY_PROJECT,
          dir,
        ],
        env,
      );
      uploaded = true;
      log("[sourcemaps] upload done");
    }
  } catch (error) {
    // A Bugsink outage or bad token must not block a deploy; stack traces just stay minified.
    log(
      `[sourcemaps] upload failed, continuing without readable stack traces: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  } finally {
    // Whatever happened, maps must not end up in the runtime image.
    await Promise.all(maps.map((file) => rm(file, { force: true })));
    if (maps.length > 0) log(`[sourcemaps] removed ${maps.length} .map files from ${dir}`);
  }
  return { uploaded, deleted: maps.length };
}
