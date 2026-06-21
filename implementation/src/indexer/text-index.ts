/**
 * Text index — builds and queries a full-text search index over admitted manifest files.
 * No code execution. No network access. Read-only over snapshot content.
 */

import type { SnapshotManifest, ManifestFile } from "../snapshot/manifest.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface TextHit {
  path: string;
  line_range: { start: number; end: number };
  snippet: string;
  score: number;
  symbol?: string;
  snapshot_id: string;
  truncated: boolean;
}

interface IndexEntry {
  file: ManifestFile;
  lines: string[];
}

let textIndex = new Map<string, IndexEntry[]>();

export function buildTextIndex(manifest: SnapshotManifest, rootDir: string): void {
  const entries: IndexEntry[] = [];
  for (const file of manifest.files) {
    if (!file.index_admitted) continue;
    try {
      const content = readFileSync(join(rootDir, file.relative_path), "utf-8");
      entries.push({ file, lines: content.split("\n") });
    } catch {
      // Skip unreadable files
    }
  }
  textIndex.set(manifest.snapshot_id, entries);
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
          score: line.toLowerCase() === qLower ? 1.0 : 0.7,
          snapshot_id,
          truncated: snippetLines.length < end - start + 1,
        });
      }
      if (hits.length >= limit) break;
    }
    if (hits.length >= limit) break;
  }

  return hits.slice(0, limit);
}

export function clearTextIndex(): void {
  textIndex.clear();
}
