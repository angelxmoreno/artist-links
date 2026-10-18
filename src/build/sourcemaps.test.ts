import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { findMaps, processSourcemaps } from "./sourcemaps";

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "sourcemaps-"));
  await mkdir(join(dir, "assets"));
  await writeFile(join(dir, "assets", "index-abc.js"), "console.log(1)");
  await writeFile(join(dir, "assets", "index-abc.js.map"), "{}");
  await writeFile(join(dir, "assets", "other-def.js.map"), "{}");
  await writeFile(join(dir, "favicon.svg"), "<svg/>");
});

afterEach(() => rm(dir, { recursive: true, force: true }));

describe("processSourcemaps", () => {
  it("skips upload without a token, says so, and still deletes the maps", async () => {
    const run = vi.fn();
    const log = vi.fn();
    const result = await processSourcemaps({ dir, run, log });
    expect(result).toEqual({ uploaded: false, deleted: 2 });
    expect(run).not.toHaveBeenCalled();
    expect(log.mock.calls.flat().join("\n")).toMatch(/SENTRY_AUTH_TOKEN not set: skipping upload/);
    expect(await findMaps(dir)).toEqual([]);
    expect((await readdir(join(dir, "assets"))).sort()).toEqual(["index-abc.js"]);
  });

  it("injects then uploads with a token passed via env only, then deletes the maps", async () => {
    const run = vi.fn().mockResolvedValue(undefined);
    const result = await processSourcemaps({
      dir,
      token: "secret-token",
      url: "https://bugsink.example",
      release: "v0.0.6",
      run,
      log: () => {},
    });
    expect(result).toEqual({ uploaded: true, deleted: 2 });
    expect(run).toHaveBeenCalledTimes(2);
    expect(run.mock.calls[0]![0]).toEqual(["sourcemaps", "inject", dir]);
    expect(run.mock.calls[1]![0]).toEqual([
      "--url",
      "https://bugsink.example",
      "sourcemaps",
      "upload",
      "--org",
      "bugsinkhasnoorgs",
      "--project",
      "artist-links",
      dir,
    ]);
    for (const [args, env] of run.mock.calls) {
      expect(args.join(" ")).not.toContain("secret-token");
      expect(env.SENTRY_AUTH_TOKEN).toBe("secret-token");
    }
    expect(await findMaps(dir)).toEqual([]);
  });

  it("deletes the maps and only logs a warning when the upload fails", async () => {
    const run = vi.fn().mockRejectedValue(new Error("boom"));
    const log = vi.fn();
    const result = await processSourcemaps({ dir, token: "t", run, log });
    expect(result.uploaded).toBe(false);
    expect(log).toHaveBeenCalledWith(expect.stringContaining("upload failed"));
    expect(log).toHaveBeenCalledWith(expect.stringContaining("boom"));
    expect(await findMaps(dir)).toEqual([]);
  });

  it("does nothing when the directory has no maps or does not exist", async () => {
    const run = vi.fn();
    await processSourcemaps({ dir, run, log: () => {} });
    const result = await processSourcemaps({
      dir: join(dir, "missing"),
      token: "t",
      run,
      log: () => {},
    });
    expect(result).toEqual({ uploaded: false, deleted: 0 });
    expect(run).not.toHaveBeenCalled();
  });
});
