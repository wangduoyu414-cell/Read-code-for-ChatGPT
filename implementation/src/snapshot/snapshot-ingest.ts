/**
 * Snapshot Ingest — creates immutable manifest from a fixture directory.
 * DEV ONLY: only accepts fixture paths. Real repo ingest requires explicit authorization.
 */

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { computeFileHash, finalizeManifest, type ManifestFile, type SnapshotManifest } from "./manifest.js";
import { CONFIG } from "../config.js";
import { isSensitiveFileType } from "../security/secret-scanner.js";
import { validateFilePath } from "../security/path-guard.js";
import { generateAuditId } from "../audit/audit-id.js";

const BLOCKED_DIRECTORY_REASONS = new Map<string, string>([
  [".git", "directory block: .git"],
  [".ssh", "directory block: .ssh"],
  ["node_modules", "directory block: node_modules"],
  ["$recycle.bin", "system directory block: $RECYCLE.BIN"],
  ["system volume information", "system directory block: System Volume Information"],
  ["recovery", "system directory block: Recovery"],
  ["config.msi", "system directory block: Config.Msi"],
]);

const ALLOWED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".kt",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php", ".swift", ".scala",
  ".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".xml", ".csv",
  ".css", ".scss", ".less", ".html", ".htm", ".svg", ".graphql",
  ".vue", ".svelte", ".astro", ".prisma", ".proto", ".sql",
]);

const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MiB per file

function languageFromExt(ext: string): string {
  const map: Record<string, string> = {
    ".ts": "typescript", ".tsx": "tsx", ".js": "javascript", ".jsx": "jsx",
    ".py": "python", ".go": "go", ".rs": "rust", ".java": "java", ".kt": "kotlin",
    ".c": "c", ".cpp": "cpp", ".h": "c", ".cs": "csharp", ".rb": "ruby",
    ".swift": "swift", ".scala": "scala", ".vue": "vue", ".svelte": "svelte",
    ".css": "css", ".scss": "scss", ".html": "html", ".json": "json",
    ".yaml": "yaml", ".yml": "yaml", ".md": "markdown",
  };
  return map[ext] ?? "text";
}

function blockedDirectoryReason(name: string): string | undefined {
  return BLOCKED_DIRECTORY_REASONS.get(name.toLowerCase());
}

function fsErrorCode(err: unknown): string {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === "string" && code.length > 0) return code;
  }
  return "unknown";
}

export interface IngestResult {
  manifest: SnapshotManifest;
  warnings: string[];
}

export function ingestDirectory(rootDir: string, repo_id: string, snapshotIdParam?: string): IngestResult {
  const snapId = snapshotIdParam ?? `snap-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const files: ManifestFile[] = [];
  const excluded: Array<{ relative_path: string; reason: string }> = [];
  const warnings: string[] = [];
  const auditId = generateAuditId();

  function repoRelativePath(abs: string): string {
    const rel = relative(rootDir, abs).replace(/\\/g, "/");
    return rel.length > 0 ? rel : ".";
  }

  function exclude(relative_path: string, reason: string, warningKind?: string, warningSuffix = "") {
    excluded.push({ relative_path, reason });
    if (warningKind !== undefined) {
      warnings.push(`EXCLUDED(${warningKind}): ${relative_path}${warningSuffix}`);
    }
  }

  function walk(dir: string) {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      exclude(repoRelativePath(dir), `unreadable directory: ${fsErrorCode(err)}`, "unreadable");
      return;
    }

    for (const ent of entries) {
      const abs = join(dir, ent.name);
      const rel = repoRelativePath(abs);

      if (ent.isDirectory()) {
        const reason = blockedDirectoryReason(ent.name);
        if (reason !== undefined) {
          exclude(rel, reason);
          continue;
        }
        walk(abs);
        continue;
      }

      if (ent.isFile()) {
        let stat;
        try {
          stat = statSync(abs);
        } catch (err) {
          exclude(rel, `unreadable file metadata: ${fsErrorCode(err)}`, "unreadable");
          continue;
        }

        // Size limit
        if (stat.size > MAX_FILE_BYTES) {
          exclude(rel, `file too large: ${stat.size} > ${MAX_FILE_BYTES}`, "large", ` (${stat.size} bytes)`);
          continue;
        }

        const ext = extname(ent.name).toLowerCase();

        // Extension allowlist
        if (!ALLOWED_EXTENSIONS.has(ext)) {
          exclude(rel, `unsupported extension: ${ext}`);
          continue;
        }

        // Sensitive file type check
        if (isSensitiveFileType(ent.name)) {
          exclude(rel, "sensitive file type", "sensitive");
          continue;
        }

        // Path validation
        const pathCheck = validateFilePath(rel, repo_id, snapId, auditId);
        if (!pathCheck.allowed) {
          exclude(rel, `path rejected: ${pathCheck.error?.message}`);
          continue;
        }

        let content: string;
        try { content = readFileSync(abs, "utf-8"); }
        catch {
          exclude(rel, "unreadable file", "unreadable");
          continue;
        }
        const lines = content.split("\n");

        files.push({
          relative_path: rel,
          file_hash: computeFileHash(content),
          byte_count: stat.size,
          line_count: lines.length,
          language: languageFromExt(ext),
          extension: ext,
          sensitive_detected: false,
          index_admitted: true,
        });
      }
    }
  }

  const sourceRootHash = computeFileHash(rootDir + "|" + repo_id);

  walk(rootDir);

  const manifest = finalizeManifest({
    snapshot_id: snapId,
    repo_id,
    created_at: new Date().toISOString(),
    source_root_hash: sourceRootHash,
    files,
    excluded_files: excluded,
    index_version: 1,
    policy_version: CONFIG.policyVersion,
    expires_at: new Date(Date.now() + 24 * 3600_000).toISOString(),
  });

  return { manifest, warnings };
}
