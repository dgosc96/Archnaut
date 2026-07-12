import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { RuntimeHost, type RuntimeHost as RuntimeHostType } from "../../src/runtime-host.js";
import type { Store } from "../../src/store.js";

const tempDirs: string[] = [];

/** Track temp dirs created by {@link makeTempDir} for cleanup. */
export function getTempDirs(): string[] {
  return tempDirs;
}

/** Create a unique temp directory under the OS temp folder. */
export async function makeTempDir(prefix = "archnaut-host-"): Promise<string> {
  const dir = await mkdtemp(path.join(os.tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

/** Remove all temp dirs tracked by {@link makeTempDir}. */
export async function cleanupTempDirs(): Promise<void> {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
}

/**
 * Open a test host with in-memory DB on an ephemeral port.
 *
 * @param options - Optional project root and store seed callback.
 * @returns Listening {@link RuntimeHost} ready for HTTP requests.
 */
export async function openTestHost(options?: {
  projectRoot?: string;
  seed?: (store: Store) => void;
  /** When true, caller must invoke `host.serve()` after setup mutations. */
  deferServe?: boolean;
}): Promise<RuntimeHostType> {
  const dir = options?.projectRoot ?? (await makeTempDir());
  const host = await RuntimeHost.open({ projectRoot: dir, dbPath: ":memory:" });
  options?.seed?.(host.store);
  if (!options?.deferServe) {
    await host.serve({ port: 0 });
  }
  return host;
}
