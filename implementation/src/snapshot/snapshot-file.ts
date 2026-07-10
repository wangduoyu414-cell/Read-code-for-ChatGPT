/**
 * Snapshot file reader — one checked filesystem boundary for indexers and tools.
 * A manifest entry remains readable only while it resolves inside the authorized
 * root, stays a regular file, and still has the manifest's content hash.
 */

import { lstatSync, readFileSync, realpathSync, statSync } from "node:fs";
import { isAbsolute, join, relative, sep } from "node:path";
import { computeFileHash, type ManifestFile } from "./manifest.js";

export type SnapshotFileReadResult =
  | { ok: true; content: string; byte_count: number }
  | { ok: false; reason: "not_regular_file" | "symlink_escape" | "unreadable" | "hash_mismatch" };

function resolvesInsideRoot(rootRealPath: string, targetRealPath: string): boolean {
  const relativePath = relative(rootRealPath, targetRealPath);
  return relativePath === "" || (!relativePath.startsWith(`..${sep}`) && relativePath !== ".." && !isAbsolute(relativePath));
}

export function readSnapshotFile(rootDir: string, file: Pick<ManifestFile, "relative_path" | "file_hash">): SnapshotFileReadResult {
  const candidate = join(rootDir, file.relative_path);

  try {
    const rootRealPath = realpathSync(rootDir);
    const candidateRealPath = realpathSync(candidate);
    if (!resolvesInsideRoot(rootRealPath, candidateRealPath)) {
      return { ok: false, reason: "symlink_escape" };
    }

    const linkStatus = lstatSync(candidate);
    if (linkStatus.isSymbolicLink()) {
      return { ok: false, reason: "symlink_escape" };
    }

    if (!statSync(candidateRealPath).isFile()) {
      return { ok: false, reason: "not_regular_file" };
    }

    const raw = readFileSync(candidateRealPath);
    if (computeFileHash(raw) !== file.file_hash) {
      return { ok: false, reason: "hash_mismatch" };
    }

    return { ok: true, content: raw.toString("utf-8"), byte_count: raw.byteLength };
  } catch {
    return { ok: false, reason: "unreadable" };
  }
}
