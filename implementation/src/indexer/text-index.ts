/**
 * Text index — builds and queries a full-text search index over admitted manifest files.
 * No code execution. No network access. Read-only over snapshot content.
 */

import type { SnapshotManifest, ManifestFile } from "../snapshot/manifest.js";
import { isCoreRepositoryPath, isDeferredRepositoryPath } from "./index-policy.js";
import { readSnapshotFile } from "../snapshot/snapshot-file.js";

export interface TextHit {
  path: string;
  line_range: { start: number; end: number };
  snippet: string;
  score: number;
  symbol?: string;
  snapshot_id: string;
  truncated: boolean;
  source: "text" | "symbol" | "on_demand";
}

interface IndexEntry {
  file: ManifestFile;
  lines: string[];
}

let textIndex = new Map<string, IndexEntry[]>();

export function buildTextIndex(manifest: SnapshotManifest, rootDir: string): Set<string> {
  const entries: IndexEntry[] = [];
  const indexedPaths = new Set<string>();
  for (const file of manifest.files) {
    if (!file.index_admitted) continue;
    try {
      const read = readSnapshotFile(rootDir, file);
      if (!read.ok) continue;
      entries.push({ file, lines: read.content.split("\n") });
      indexedPaths.add(file.relative_path);
    } catch {
      // Skip unreadable files
    }
  }
  textIndex.set(manifest.snapshot_id, entries);
  return indexedPaths;
}

export function searchText(
  snapshot_id: string,
  query: string,
  limit: number,
): TextHit[] {
  const entries = textIndex.get(snapshot_id);
  if (!entries) return [];

  const qLower = query.toLowerCase();
  const hits: TextHit[] = [];

  for (const entry of entries) {
    for (let i = 0; i < entry.lines.length; i++) {
      const line = entry.lines[i]!;
      if (line.toLowerCase().includes(qLower)) {
        const start = Math.max(1, i - 1 + 1); // 1-based with 1 context line before
        const end = Math.min(entry.lines.length, i + 2); // 1 line after
        const snippetLines = entry.lines.slice(start - 1, end);
        hits.push({
          path: entry.file.relative_path,
          line_range: { start, end },
          snippet: snippetLines.join("\n"),
          score: scoreTextHit(entry.file, line, query),
          snapshot_id,
          truncated: snippetLines.length < end - start + 1,
          source: "text",
        });
      }
      if (hits.length >= limit) break;
    }
    if (hits.length >= limit) break;
  }

  return hits
    .sort(compareTextHits)
    .slice(0, limit);
}

function scoreTextHit(file: ManifestFile, line: string, query: string): number {
  const lowerQuery = query.toLowerCase();
  const lowerLine = line.toLowerCase();
  const filename = file.relative_path.split("/").pop()?.toLowerCase() ?? "";
  const filenameHit = filename.includes(lowerQuery) ? 3 : 0;
  const exact = lowerLine.trim() === lowerQuery ? 2 : lowerLine.includes(lowerQuery) ? 1 : 0;
  const core = isCoreRepositoryPath(file.relative_path) ? 1 : 0;
  const deferred = isDeferredRepositoryPath(file.relative_path) ? -1 : 0;
  return filenameHit + exact + core + deferred;
}

function compareTextHits(left: TextHit, right: TextHit): number {
  return right.score - left.score || left.path.localeCompare(right.path) || left.line_range.start - right.line_range.start;
}

export function scanManifestPrefix(
  manifest: SnapshotManifest,
  rootDir: string,
  prefix: string,
  query: string,
  limit: number,
  maxFiles = 200,
): { hits: TextHit[]; scanned_files: number; matching_files: number; limited: boolean } {
  const qLower = query.toLowerCase();
  const candidates = manifest.files
    .filter((file) => file.fetchable && file.relative_path.startsWith(prefix === "" ? "" : `${prefix}/`))
    .slice(0, maxFiles);
  const hits: TextHit[] = [];

  for (const file of candidates) {
    const read = readSnapshotFile(rootDir, file);
    if (!read.ok) continue;
    const lines = read.content.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index]!;
      if (!line.toLowerCase().includes(qLower)) continue;
      const start = Math.max(1, index);
      const end = Math.min(lines.length, index + 2);
      const snippetLines = lines.slice(start - 1, end);
      hits.push({
        path: file.relative_path,
        line_range: { start, end },
        snippet: snippetLines.join("\n"),
        score: scoreTextHit(file, line, query) - 0.25,
        snapshot_id: manifest.snapshot_id,
        truncated: snippetLines.length < end - start + 1,
        source: "on_demand",
      });
      if (hits.length >= limit) break;
    }
    if (hits.length >= limit) break;
  }

  return {
    hits: hits.sort(compareTextHits).slice(0, limit),
    scanned_files: candidates.length,
    matching_files: manifest.files.filter((file) => file.fetchable && file.relative_path.startsWith(prefix === "" ? "" : `${prefix}/`)).length,
    limited: manifest.files.filter((file) => file.fetchable && file.relative_path.startsWith(prefix === "" ? "" : `${prefix}/`)).length > candidates.length,
  };
}

export function clearTextIndex(): void {
  textIndex.clear();
}

export function deleteTextIndex(snapshotId: string): void {
  textIndex.delete(snapshotId);
}
