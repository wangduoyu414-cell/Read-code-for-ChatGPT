/**
 * Snapshot Ingest — creates immutable manifest from a fixture directory.
 * DEV ONLY: only accepts fixture paths. Real repo ingest requires explicit authorization.
 */

import { readdirSync, statSync, readFileSync } from "node:fs";
import { join, relative, extname } from "node:path";
import { randomUUID } from "node:crypto";
import { computeFileHash, finalizeManifest, type ManifestFile, type SnapshotManifest } from "./manifest.js";
import { CONFIG } from "../config.js";
import { isSensitiveFileType, scanForSecrets } from "../security/secret-scanner.js";
import { validateFilePath } from "../security/path-guard.js";
import { generateAuditId } from "../audit/audit-id.js";

const BLOCKED_DIRECTORY_REASONS = new Map<string, string>([
  [".git", "directory block: .git"],
  [".ssh", "directory block: .ssh"],
  [".claude", "local agent directory block: .claude"],
  [".codex", "local agent directory block: .codex"],
  [".vscode", "editor directory block: .vscode"],
  [".idea", "editor directory block: .idea"],
  ["node_modules", "directory block: node_modules"],
  [".venv", "virtual environment directory block: .venv"],
  ["venv", "virtual environment directory block: venv"],
  ["env", "virtual environment directory block: env"],
  ["__pycache__", "cache directory block: __pycache__"],
  [".pytest_cache", "cache directory block: .pytest_cache"],
  [".mypy_cache", "cache directory block: .mypy_cache"],
  [".ruff_cache", "cache directory block: .ruff_cache"],
  [".tox", "test environment directory block: .tox"],
  [".nox", "test environment directory block: .nox"],
  [".uv-cache", "cache directory block: .uv-cache"],
  [".cache", "cache directory block: .cache"],
  [".turbo", "cache directory block: .turbo"],
  [".parcel-cache", "cache directory block: .parcel-cache"],
  [".next", "build output directory block: .next"],
  [".nuxt", "build output directory block: .nuxt"],
  [".svelte-kit", "build output directory block: .svelte-kit"],
  ["dist", "build output directory block: dist"],
  ["build", "build output directory block: build"],
  ["coverage", "test output directory block: coverage"],
  ["tmp", "temporary directory block: tmp"],
  ["temp", "temporary directory block: temp"],
  [".tmp", "temporary directory block: .tmp"],
  ["$recycle.bin", "system directory block: $RECYCLE.BIN"],
  ["system volume information", "system directory block: System Volume Information"],
  ["recovery", "system directory block: Recovery"],
  ["config.msi", "system directory block: Config.Msi"],
]);

const BLOCKED_DIRECTORY_PREFIX_REASONS: ReadonlyArray<[string, string]> = [
  [".tmp_", "temporary directory block: .tmp_*"],
  ["tmp_", "temporary directory block: tmp_*"],
];

const ROOT_FILE_PRIORITY = new Set([
  "package.json",
  "pyproject.toml",
  "tsconfig.json",
  "jsconfig.json",
  "go.mod",
  "cargo.toml",
  "pom.xml",
  "build.gradle",
  "settings.gradle",
  "requirements.txt",
  "uv.lock",
  "poetry.lock",
  "pnpm-lock.yaml",
  "yarn.lock",
  "package-lock.json",
  "readme.md",
  "readme",
  "license",
  "makefile",
  "dockerfile",
]);

const PRIORITY_DIRECTORY_ORDER = new Map<string, number>([
  ["src", 0],
  ["source", 1],
  ["lib", 2],
  ["app", 3],
  ["packages", 4],
  ["tests", 5],
  ["test", 6],
  ["spec", 7],
  ["tools", 8],
  ["scripts", 9],
  ["config", 10],
  [".github", 11],
  ["docs", 12],
]);

const DEFERRED_DIRECTORY_ORDER = new Map<string, number>([
  ["reports", 90],
  ["archive", 91],
  [".multica-import", 92],
  [".omx", 93],
]);

const ALLOWED_EXTENSIONS = new Set([
  ".ts", ".tsx", ".js", ".jsx", ".py", ".go", ".rs", ".java", ".kt",
  ".c", ".cpp", ".h", ".hpp", ".cs", ".rb", ".php", ".swift", ".scala",
  ".md", ".txt", ".json", ".yaml", ".yml", ".toml", ".xml", ".csv",
  ".css", ".scss", ".less", ".html", ".htm", ".svg", ".graphql",
  ".vue", ".svelte", ".astro", ".prisma", ".proto", ".sql",
]);

const KNOWN_TEXT_FILENAMES = new Set([
  ".dockerignore",
  ".editorconfig",
  ".eslintignore",
  ".eslintrc",
  ".gitattributes",
  ".gitignore",
  ".npmignore",
  ".nvmrc",
  ".prettierignore",
  ".prettierrc",
  ".stylelintrc",
  "dockerfile",
  "license",
  "makefile",
  "readme",
]);

const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MiB per file
const TEXT_SAMPLE_BYTES = 8192;

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
  const lower = name.toLowerCase();
  const exactReason = BLOCKED_DIRECTORY_REASONS.get(lower);
  if (exactReason !== undefined) return exactReason;

  for (const [prefix, reason] of BLOCKED_DIRECTORY_PREFIX_REASONS) {
    if (lower.startsWith(prefix)) return reason;
  }

  return undefined;
}

function isKnownTextFilename(name: string): boolean {
  return KNOWN_TEXT_FILENAMES.has(name.toLowerCase());
}

function directoryPriority(name: string): number {
  const lower = name.toLowerCase();
  const priority = PRIORITY_DIRECTORY_ORDER.get(lower);
  if (priority !== undefined) return priority;

  const deferred = DEFERRED_DIRECTORY_ORDER.get(lower);
  if (deferred !== undefined) return deferred;

  if (lower.startsWith(".tmp") || lower.startsWith("tmp_")) return 94;
  if (lower.includes("cache")) return 95;
  return 40;
}

function filePriority(name: string): number {
  const lower = name.toLowerCase();
  if (ROOT_FILE_PRIORITY.has(lower) || isKnownTextFilename(name)) return 0;
  return 30;
}

function entryPriority(entry: { name: string; isDirectory(): boolean; isFile(): boolean }): number {
  if (entry.isDirectory()) return directoryPriority(entry.name);
  if (entry.isFile()) return filePriority(entry.name);
  return 80;
}

function sortDirectoryEntries<T extends { name: string; isDirectory(): boolean; isFile(): boolean }>(entries: T[]): T[] {
  return [...entries].sort((a, b) => {
    const priorityOrder = entryPriority(a) - entryPriority(b);
    if (priorityOrder !== 0) return priorityOrder;

    if (a.isDirectory() !== b.isDirectory()) {
      return a.isDirectory() ? -1 : 1;
    }

    return a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true });
  });
}

function looksLikeText(content: Buffer): boolean {
  if (content.length === 0) return true;

  let suspiciousBytes = 0;
  for (const byte of content) {
    if (byte === 0) return false;
    const isCommonTextByte =
      byte === 9 ||
      byte === 10 ||
      byte === 13 ||
      (byte >= 32 && byte <= 126) ||
      byte >= 128;
    if (!isCommonTextByte) suspiciousBytes += 1;
  }

  return suspiciousBytes / content.length <= 0.05;
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

export interface IngestOptions {
  maxEntries?: number;
}

export function ingestDirectory(rootDir: string, repo_id: string, snapshotIdParam?: string, options: IngestOptions = {}): IngestResult {
  const snapId = snapshotIdParam ?? `snap-${Date.now()}-${randomUUID().slice(0, 8)}`;
  const files: ManifestFile[] = [];
  const excluded: Array<{ relative_path: string; reason: string }> = [];
  const warnings: string[] = [];
  const auditId = generateAuditId();
  const maxEntries = options.maxEntries !== undefined && Number.isFinite(options.maxEntries) && options.maxEntries > 0
    ? Math.floor(options.maxEntries)
    : undefined;
  let visitedEntries = 0;
  let traversalLimitReached = false;

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

  function shouldStopTraversal(relative_path: string): boolean {
    if (traversalLimitReached) return true;
    if (maxEntries === undefined) return false;
    visitedEntries += 1;
    if (visitedEntries <= maxEntries) return false;

    traversalLimitReached = true;
    exclude(relative_path, `snapshot traversal limit reached: ${visitedEntries} > ${maxEntries}`, "limit");
    return true;
  }

  function walk(dir: string) {
    if (traversalLimitReached) return;

    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch (err) {
      exclude(repoRelativePath(dir), `unreadable directory: ${fsErrorCode(err)}`, "unreadable");
      return;
    }

    for (const ent of sortDirectoryEntries(entries)) {
      const abs = join(dir, ent.name);
      const rel = repoRelativePath(abs);

      if (shouldStopTraversal(rel)) return;

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

        let raw: Buffer;
        try { raw = readFileSync(abs); }
        catch {
          exclude(rel, "unreadable file", "unreadable");
          continue;
        }

        const hasAllowedExtension = ALLOWED_EXTENSIONS.has(ext);
        const hasKnownTextName = isKnownTextFilename(ent.name);
        const hasUnknownExtension = ext.length === 0 || !hasAllowedExtension;
        if (hasUnknownExtension && !hasKnownTextName && !looksLikeText(raw.subarray(0, TEXT_SAMPLE_BYTES))) {
          exclude(rel, `unsupported binary or non-text file: ${ext || "(no extension)"}`);
          continue;
        }

        const content = raw.toString("utf-8");
        if (hasUnknownExtension || hasKnownTextName) {
          const scan = scanForSecrets(content, repo_id, snapId, auditId);
          if (!scan.passed) {
            exclude(rel, "sensitive content", "sensitive");
            continue;
          }
        }

        const lines = content.split("\n");

        files.push({
          relative_path: rel,
          file_hash: computeFileHash(content),
          byte_count: stat.size,
          line_count: lines.length,
          language: hasAllowedExtension ? languageFromExt(ext) : "text",
          extension: ext,
          sensitive_detected: false,
          fetchable: true,
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
