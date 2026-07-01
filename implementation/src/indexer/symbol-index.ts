/**
 * Symbol index — extracts symbol definitions from admitted manifest files.
 * V1: definitions only (functions, classes, interfaces, methods).
 * No code execution. Regex-based extraction only.
 */

import type { SnapshotManifest } from "../snapshot/manifest.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface SymbolHit {
  name: string;
  kind: string;
  path: string;
  line: number;
  signature?: string;
  confidence: number;
}

const SYMBOL_PATTERNS: Array<{ pattern: RegExp; kind: string; extensions: string[] }> = [
  // TypeScript/JavaScript
  { pattern: /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/, kind: "function", extensions: [".ts", ".tsx", ".js", ".jsx"] },
  { pattern: /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/, kind: "class", extensions: [".ts", ".tsx", ".js", ".jsx"] },
  { pattern: /(?:export\s+)?interface\s+(\w+)/, kind: "interface", extensions: [".ts", ".tsx"] },
  { pattern: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)/, kind: "function", extensions: [".ts", ".tsx", ".js", ".jsx"] },
  { pattern: /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\(\w*\)\s*=>)/, kind: "function", extensions: [".ts", ".tsx", ".js", ".jsx"] },
  // Python
  { pattern: /def\s+(\w+)\s*\(([^)]*)\)/, kind: "function", extensions: [".py"] },
  { pattern: /class\s+(\w+)\s*(?:\(([^)]*)\))?:/, kind: "class", extensions: [".py"] },
  // Go
  { pattern: /func\s+(?:\([^)]+\)\s+)?(\w+)\s*\(([^)]*)\)/, kind: "function", extensions: [".go"] },
  { pattern: /type\s+(\w+)\s+struct/, kind: "struct", extensions: [".go"] },
  { pattern: /type\s+(\w+)\s+interface/, kind: "interface", extensions: [".go"] },
];

let symbolIndex = new Map<string, SymbolHit[]>();

export function buildSymbolIndex(manifest: SnapshotManifest, rootDir: string): Set<string> {
  const symbols: SymbolHit[] = [];
  const indexedPaths = new Set<string>();
  for (const file of manifest.files) {
    if (!file.index_admitted) continue;
    const ext = file.extension;
    try {
      const content = readFileSync(join(rootDir, file.relative_path), "utf-8");
      indexedPaths.add(file.relative_path);
      const lines = content.split("\n");
      const applicable = SYMBOL_PATTERNS.filter((p) => p.extensions.includes(ext));

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i]!;
        for (const { pattern, kind } of applicable) {
          const match = pattern.exec(line);
          if (match) {
            symbols.push({
              name: match[1]!,
              kind,
              path: file.relative_path,
              line: i + 1,
              signature: match[2]?.trim() || undefined,
              confidence: 0.9,
            });
          }
        }
      }
    } catch {
      // Skip unreadable files
    }
  }
  symbolIndex.set(manifest.snapshot_id, symbols);
  return indexedPaths;
}

export function searchSymbols(
  snapshot_id: string,
  query: string,
  language?: string,
  limit = 20,
): SymbolHit[] {
  const symbols = symbolIndex.get(snapshot_id);
  if (!symbols) return [];

  const qLower = query.toLowerCase();
  return symbols
    .filter((s) => {
      const nameMatch = s.name.toLowerCase().includes(qLower);
      if (language) return nameMatch && s.path.endsWith(`.${language}`);
      return nameMatch;
    })
    .slice(0, limit);
}

export function clearSymbolIndex(): void {
  symbolIndex.clear();
}

export function deleteSymbolIndex(snapshotId: string): void {
  symbolIndex.delete(snapshotId);
}
