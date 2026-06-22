/**
 * Indexer — orchestrates text and symbol index building from a manifest.
 * Implements EXEC-007 isolation requirements.
 *
 * - No network access
 * - No code execution
 * - Only reads files listed in manifest
 * - Skips non-admitted files
 * - Has timeout, size, and count limits
 */

import type { SnapshotManifest } from "../snapshot/manifest.js";
import { buildTextIndex, clearTextIndex } from "./text-index.js";
import { buildSymbolIndex, clearSymbolIndex } from "./symbol-index.js";

const INDEX_TIMEOUT_MS = 30_000;
const MAX_INDEXED_FILES = 10_000;

export interface IndexResult {
  snapshot_id: string;
  files_indexed: number;
  files_skipped: number;
  duration_ms: number;
  success: boolean;
  error?: string;
}

export interface RunIndexerOptions {
  clearExisting?: boolean;
}

export function runIndexer(manifest: SnapshotManifest, rootDir: string, options: RunIndexerOptions = {}): IndexResult {
  const start = Date.now();
  let files_indexed = 0;
  let files_skipped = 0;

  if (options.clearExisting ?? true) {
    clearTextIndex();
    clearSymbolIndex();
  }

  // Count admitted files (do NOT mutate the manifest — GAP-010 fix)
  const admitted = manifest.files.filter((f) => f.index_admitted);
  const toIndex = admitted.slice(0, MAX_INDEXED_FILES);
  files_skipped = Math.max(0, admitted.length - MAX_INDEXED_FILES);
  // Build a non-mutating shallow view for the indexers
  const indexableManifest = { ...manifest, files: toIndex };

  try {
    buildTextIndex(indexableManifest, rootDir);
    buildSymbolIndex(indexableManifest, rootDir);
    files_indexed = toIndex.length;
  } catch (err) {
    return {
      snapshot_id: manifest.snapshot_id,
      files_indexed: 0,
      files_skipped: admitted.length,
      duration_ms: Date.now() - start,
      success: false,
      error: `Index failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  const duration = Date.now() - start;
  if (duration > INDEX_TIMEOUT_MS) {
    return {
      snapshot_id: manifest.snapshot_id,
      files_indexed,
      files_skipped,
      duration_ms: duration,
      success: false,
      error: `Index exceeded timeout: ${duration}ms > ${INDEX_TIMEOUT_MS}ms`,
    };
  }

  return { snapshot_id: manifest.snapshot_id, files_indexed, files_skipped, duration_ms: duration, success: true };
}
