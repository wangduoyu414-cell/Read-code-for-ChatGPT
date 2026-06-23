/**
 * Read-only tool implementations.
 * Each tool receives the shared BudgetState from the runtime for cumulative enforcement.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CONFIG } from "../config.js";
import { toolError, type ToolError } from "../errors.js";
import { generateAuditId } from "../audit/audit-id.js";
import { validateFilePath } from "../security/path-guard.js";
import { checkResponseBytes, checkSessionBudget, checkGrantBudget, checkCallCount, checkThrottle, checkTreeDepth, checkSearchHitLimit, checkSymbolHitLimit, checkLineWindow, type BudgetState } from "../security/budget.js";
import { sanitizeContent, wrapRepositoryContent } from "../security/redaction.js";
import { scanForSecrets } from "../security/secret-scanner.js";
import { searchText } from "../indexer/text-index.js";
import { searchSymbols } from "../indexer/symbol-index.js";
import type { ManifestFile, SnapshotManifest } from "../snapshot/manifest.js";
import { rejectIfNotReady } from "../snapshot/snapshot-registry.js";

function makeCtx(repo_id: string, snapshot_id: string) {
  return { repo_id, snapshot_id, audit_id: generateAuditId() };
}

function normalizeTreePrefix(
  path: string | undefined,
  repo_id: string,
  snapshot_id: string,
  audit_id: string,
): string | ToolError {
  if (path === undefined || path === "" || path === "." || path === "./") {
    return "";
  }

  const pathCheck = validateFilePath(path, repo_id, snapshot_id, audit_id);
  if (!pathCheck.allowed) return pathCheck.error!;
  return pathCheck.normalized === "." ? "" : pathCheck.normalized ?? "";
}

function normalizeOptionalPrefix(
  path: string | undefined,
  repo_id: string,
  snapshot_id: string,
  audit_id: string,
): string | ToolError | undefined {
  if (path === undefined || path === "" || path === "." || path === "./") {
    return undefined;
  }

  const pathCheck = validateFilePath(path, repo_id, snapshot_id, audit_id);
  if (!pathCheck.allowed) return pathCheck.error!;
  return pathCheck.normalized === "." ? undefined : pathCheck.normalized;
}

function encodeFilesCursor(payload: Record<string, unknown>): string {
  return Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
}

function decodeFilesCursor(cursor: string): Record<string, unknown> | null {
  try {
    const decoded = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed = JSON.parse(decoded);
    return typeof parsed === "object" && parsed !== null && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}

function stableStringArray(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean))).sort();
}

function filesFilterKey(args: {
  repo_path: string;
  snapshot_id: string;
  prefix?: string;
  suffixes?: string[];
  languages?: string[];
  states?: string[];
  limit: number;
}): Record<string, unknown> {
  return {
    repo_path: args.repo_path,
    snapshot_id: args.snapshot_id,
    prefix: args.prefix ?? "",
    suffixes: stableStringArray(args.suffixes),
    languages: stableStringArray(args.languages),
    states: stableStringArray(args.states),
    limit: args.limit,
    order: "path:asc:v1",
  };
}

function fileState(file: ManifestFile): "indexed" | "fetchable_unindexed" | "excluded" {
  if (file.index_admitted) return "indexed";
  if (file.fetchable) return "fetchable_unindexed";
  return "excluded";
}

function reasonKey(reason: string): string {
  const value = reason.toLowerCase();
  if (value.includes("traversal limit")) return "excluded_by_file_limit";
  if (value.includes("too large")) return "excluded_by_size";
  if (value.includes("binary") || value.includes("non-text")) return "unsupported_binary";
  if (value.includes("sensitive")) return "secret_blocked";
  if (value.includes("unreadable")) return "permission_denied";
  if (value.includes("directory block")) return "excluded_by_scope";
  if (value.includes("path rejected")) return "excluded_by_scope";
  return "excluded_by_scope";
}

interface FileMapItem {
  path: string;
  type: "file";
  language: string | null;
  size_bytes: number | null;
  line_count: number | null;
  fetchable: boolean;
  indexed: boolean;
  state: "indexed" | "fetchable_unindexed" | "excluded";
  exclusion_reason: string | null;
}

function normalizeStateFilters(states: string[] | undefined): Array<"indexed" | "fetchable_unindexed" | "excluded"> {
  const allowed = new Set(["indexed", "fetchable_unindexed", "excluded"]);
  return stableStringArray(states)
    .filter((state): state is "indexed" | "fetchable_unindexed" | "excluded" => allowed.has(state));
}

function manifestFileMapItem(file: ManifestFile): FileMapItem {
  const state = fileState(file);
  return {
    path: file.relative_path,
    type: "file",
    language: file.language,
    size_bytes: file.byte_count,
    line_count: file.line_count,
    fetchable: file.fetchable,
    indexed: file.index_admitted,
    state,
    exclusion_reason: state === "indexed" ? null : (file.fetch_reject_reason ?? file.index_reject_reason ?? "not_fetchable"),
  };
}

function excludedFileMapItem(file: { relative_path: string; reason: string }): FileMapItem {
  return {
    path: file.relative_path,
    type: "file",
    language: null,
    size_bytes: null,
    line_count: null,
    fetchable: false,
    indexed: false,
    state: "excluded",
    exclusion_reason: reasonKey(file.reason),
  };
}

// ─── repo_search ─────────────────────────────────────────────────────────────

export async function repoSearcher(
  args: { repo_id: string; repo_path: string; snapshot_id: string; query: string; mode?: string; limit?: number },
  _manifest: SnapshotManifest,
  _rootDir: string,
  budget: BudgetState,
) {
  const ctx = makeCtx(args.repo_id, args.snapshot_id);

  const notReady = rejectIfNotReady(ctx.snapshot_id);
  if (notReady) return toolError(notReady, `Snapshot ${ctx.snapshot_id} is ${notReady}.`, ctx.repo_id, ctx.snapshot_id, CONFIG.policyVersion, ctx.audit_id);

  // Budget: throttle + call count + grant budget
  const throttle = checkThrottle(budget, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!throttle.allowed) return throttle.error!;
  const cc = checkCallCount(budget, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!cc.allowed) return cc.error!;

  const limit = Math.min(args.limit ?? CONFIG.tools.search.defaultLimit, CONFIG.tools.search.maxLimit);
  const hits = searchText(ctx.snapshot_id, args.query, limit);

  const hitCheck = checkSearchHitLimit(hits.length, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!hitCheck.allowed) return hitCheck.error!;

  const truncated = hits.length >= limit;
  const response = wrapRepositoryContent({
    repo_path: args.repo_path,
    snapshot_id: ctx.snapshot_id,
    hits: hits.map((h) => {
      const sanitized = sanitizeContent(h.snippet, CONFIG.budget.singleResponseMaxBytes);
      return { ...h, snippet: sanitized.redacted };
    }),
    truncated,
  }, ctx.audit_id);

  // Budget: response bytes (session + grant cumulative)
  const respBytes = Buffer.byteLength(JSON.stringify(response), "utf-8");
  const rb = checkResponseBytes(respBytes, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!rb.allowed) return rb.error!;
  const sb = checkSessionBudget(respBytes, budget, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!sb.allowed) return sb.error!;
  const gb = checkGrantBudget(respBytes, budget, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!gb.allowed) return gb.error!;

  return response;
}

// ─── repo_files ──────────────────────────────────────────────────────────────

export async function repoFiles(
  args: {
    repo_id: string;
    repo_path: string;
    snapshot_id: string;
    prefix?: string;
    suffixes?: string[];
    languages?: string[];
    states?: string[];
    cursor?: string;
    limit?: number;
  },
  manifest: SnapshotManifest,
  budget: BudgetState,
) {
  const ctx = makeCtx(args.repo_id, args.snapshot_id);

  const notReady = rejectIfNotReady(ctx.snapshot_id);
  if (notReady) return toolError(notReady, `Snapshot ${ctx.snapshot_id} is ${notReady}.`, ctx.repo_id, ctx.snapshot_id, CONFIG.policyVersion, ctx.audit_id);

  const throttle = checkThrottle(budget, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!throttle.allowed) return throttle.error!;
  const cc = checkCallCount(budget, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!cc.allowed) return cc.error!;

  const prefix = normalizeOptionalPrefix(args.prefix, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (typeof prefix !== "string" && prefix !== undefined) return prefix;

  const limit = Math.min(args.limit ?? CONFIG.tools.files.defaultLimit, CONFIG.tools.files.maxLimit);
  const suffixes = stableStringArray(args.suffixes).map((suffix) => suffix.toLowerCase());
  const languages = stableStringArray(args.languages).map((language) => language.toLowerCase());
  const states = normalizeStateFilters(args.states);
  const filterKey = filesFilterKey({ ...args, prefix, limit });

  let offset = 0;
  if (args.cursor) {
    const decoded = decodeFilesCursor(args.cursor);
    if (!decoded || JSON.stringify(decoded.filter) !== JSON.stringify(filterKey) || !Number.isInteger(decoded.offset) || Number(decoded.offset) < 0) {
      return toolError("access_denied", "Invalid or stale repo_files cursor.", ctx.repo_id, ctx.snapshot_id, CONFIG.policyVersion, ctx.audit_id);
    }
    offset = Number(decoded.offset);
  }

  const exclusionReasonSummary = new Map<string, number>();
  for (const excluded of manifest.excluded_files) {
    exclusionReasonSummary.set(reasonKey(excluded.reason), (exclusionReasonSummary.get(reasonKey(excluded.reason)) ?? 0) + 1);
  }

  const indexedItems = manifest.files.map(manifestFileMapItem);
  const excludedItems = states.includes("excluded")
    ? manifest.excluded_files.map(excludedFileMapItem)
    : [];
  const matching = [...indexedItems, ...excludedItems]
    .filter((item) => {
      if (prefix && item.path !== prefix && !item.path.startsWith(prefix + "/")) return false;
      if (suffixes.length > 0 && !suffixes.some((suffix) => item.path.toLowerCase().endsWith(suffix))) return false;
      if (languages.length > 0 && (item.language === null || !languages.includes(item.language.toLowerCase()))) return false;
      if (states.length > 0 && !states.includes(item.state)) return false;
      return true;
    })
    .sort((a, b) => a.path.localeCompare(b.path));

  const page = matching.slice(offset, offset + limit);
  const hasMore = offset + limit < matching.length;
  const nextCursor = hasMore ? encodeFilesCursor({ filter: filterKey, offset: offset + limit }) : null;

  const counts = {
    discovered_total: manifest.files.length + manifest.excluded_files.length,
    matching_total: matching.length,
    fetchable_total: manifest.files.filter((file) => file.fetchable).length,
    indexed_total: manifest.files.filter((file) => file.index_admitted).length,
    excluded_total: manifest.excluded_files.length + manifest.files.filter((file) => !file.fetchable).length,
    returned: page.length,
    exclusion_reasons: Object.fromEntries(Array.from(exclusionReasonSummary.entries()).sort((a, b) => a[0].localeCompare(b[0]))),
  };

  const response = wrapRepositoryContent({
    repo_path: args.repo_path,
    snapshot_id: ctx.snapshot_id,
    manifest_hash: manifest.manifest_hash,
    counts,
    items: page,
    has_more: hasMore,
    next_cursor: nextCursor,
  }, ctx.audit_id);

  const respBytes = Buffer.byteLength(JSON.stringify(response), "utf-8");
  const rb = checkResponseBytes(respBytes, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!rb.allowed) return rb.error!;
  const sb = checkSessionBudget(respBytes, budget, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!sb.allowed) return sb.error!;
  const gb = checkGrantBudget(respBytes, budget, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!gb.allowed) return gb.error!;

  return response;
}

// ─── repo_fetch ──────────────────────────────────────────────────────────────

export async function repoFetcher(
  args: { repo_id: string; repo_path: string; snapshot_id: string; path: string; line_start: number; line_end: number; purpose: string },
  manifest: SnapshotManifest,
  rootDir: string,
  budget: BudgetState,
) {
  const ctx = makeCtx(args.repo_id, args.snapshot_id);

  const notReady = rejectIfNotReady(ctx.snapshot_id);
  if (notReady) return toolError(notReady, `Snapshot ${ctx.snapshot_id} is ${notReady}.`, ctx.repo_id, ctx.snapshot_id, CONFIG.policyVersion, ctx.audit_id);

  // Path guard
  const pathCheck = validateFilePath(args.path, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!pathCheck.allowed) return pathCheck.error!;

  const throttle = checkThrottle(budget, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!throttle.allowed) return throttle.error!;
  const cc = checkCallCount(budget, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!cc.allowed) return cc.error!;

  const lw = checkLineWindow(args.line_start, args.line_end, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!lw.allowed) return lw.error!;

  const mf = manifest.files.find((f) => f.relative_path === pathCheck.normalized);
  if (!mf) return toolError("access_denied", "File not in manifest.", ctx.repo_id, ctx.snapshot_id, CONFIG.policyVersion, ctx.audit_id);
  if (!mf.fetchable) return toolError("access_denied", mf.fetch_reject_reason ?? "File is not fetchable.", ctx.repo_id, ctx.snapshot_id, CONFIG.policyVersion, ctx.audit_id);
  if (mf.sensitive_detected) return toolError("secret_detected", "File flagged as sensitive.", ctx.repo_id, ctx.snapshot_id, CONFIG.policyVersion, ctx.audit_id);

  let raw: string;
  try { raw = readFileSync(join(rootDir, pathCheck.normalized!), "utf-8"); }
  catch { return toolError("internal_error", "Failed to read file.", ctx.repo_id, ctx.snapshot_id, CONFIG.policyVersion, ctx.audit_id); }

  const lines = raw.split("\n");
  const lineStart = Math.min(args.line_start, lines.length);
  const lineEnd = Math.min(args.line_end, lines.length);
  const content = lines.slice(lineStart - 1, lineEnd).join("\n");

  const scan = scanForSecrets(content, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!scan.passed) return scan.error!;

  const sanitized = sanitizeContent(content, CONFIG.budget.singleResponseMaxBytes);
  const byteCount = Buffer.byteLength(sanitized.redacted, "utf-8");

  const rb = checkResponseBytes(byteCount, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!rb.allowed) return rb.error!;
  const sb = checkSessionBudget(byteCount, budget, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!sb.allowed) return sb.error!;
  const gb = checkGrantBudget(byteCount, budget, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!gb.allowed) return gb.error!;

  return wrapRepositoryContent({
    repo_path: args.repo_path,
    snapshot_id: ctx.snapshot_id,
    path: pathCheck.normalized,
    line_range: { start: lineStart, end: lineEnd },
    content: sanitized.redacted,
    byte_count: byteCount,
    truncated: sanitized.truncated,
  }, ctx.audit_id);
}

// ─── repo_tree ───────────────────────────────────────────────────────────────

export async function repoTreer(
  args: { repo_id: string; repo_path: string; snapshot_id: string; path?: string; depth?: number; limit?: number },
  manifest: SnapshotManifest,
  _budget: BudgetState,
) {
  const ctx = makeCtx(args.repo_id, args.snapshot_id);

  const notReady = rejectIfNotReady(ctx.snapshot_id);
  if (notReady) return toolError(notReady, `Snapshot ${ctx.snapshot_id} is ${notReady}.`, ctx.repo_id, ctx.snapshot_id, CONFIG.policyVersion, ctx.audit_id);

  const depth = Math.min(args.depth ?? CONFIG.tools.tree.defaultDepth, CONFIG.tools.tree.maxDepth);
  const td = checkTreeDepth(depth, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!td.allowed) return td.error!;

  const limit = Math.min(args.limit ?? CONFIG.tools.tree.defaultLimit, CONFIG.tools.tree.maxLimit);
  const prefix = normalizeTreePrefix(args.path, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (typeof prefix !== "string") return prefix;

  const entriesByPath = new Map<string, {
    path: string;
    type: "directory" | "file";
    language?: string;
    truncated: boolean;
  }>();

  for (const file of manifest.files) {
    if (!file.index_admitted) continue;
    if (prefix && !file.relative_path.startsWith(prefix + "/") && file.relative_path !== prefix) continue;

    const remainder = prefix && file.relative_path.startsWith(prefix + "/")
      ? file.relative_path.slice(prefix.length + 1)
      : prefix === file.relative_path
        ? file.relative_path.split("/").pop() ?? file.relative_path
        : file.relative_path;
    const parts = remainder.split("/").filter(Boolean);
    if (parts.length === 0) continue;

    const directoryDepth = Math.min(depth, Math.max(0, parts.length - 1));
    for (let i = 1; i <= directoryDepth; i++) {
      const dirPath = prefix ? `${prefix}/${parts.slice(0, i).join("/")}` : parts.slice(0, i).join("/");
      entriesByPath.set(dirPath, { path: dirPath, type: "directory", truncated: false });
    }

    if (parts.length <= depth) {
      entriesByPath.set(file.relative_path, {
        path: file.relative_path,
        type: "file",
        language: file.language,
        truncated: false,
      });
    }
  }

  const allEntries = Array.from(entriesByPath.values()).sort((a, b) => {
    const pathOrder = a.path.localeCompare(b.path);
    if (pathOrder !== 0) return pathOrder;
    return a.type.localeCompare(b.type);
  });
  const entries = allEntries.slice(0, limit);
  const truncated = allEntries.length > limit;

  return wrapRepositoryContent({
    repo_path: args.repo_path,
    snapshot_id: ctx.snapshot_id,
    entries,
    truncated,
  }, ctx.audit_id);
}

// ─── repo_symbols ────────────────────────────────────────────────────────────

export async function repoSymbols(
  args: { repo_id: string; repo_path: string; snapshot_id: string; query: string; language?: string; limit?: number },
  _manifest: SnapshotManifest,
  _budget: BudgetState,
) {
  const ctx = makeCtx(args.repo_id, args.snapshot_id);

  const notReady = rejectIfNotReady(ctx.snapshot_id);
  if (notReady) return toolError(notReady, `Snapshot ${ctx.snapshot_id} is ${notReady}.`, ctx.repo_id, ctx.snapshot_id, CONFIG.policyVersion, ctx.audit_id);

  const limit = Math.min(args.limit ?? CONFIG.tools.symbols.defaultLimit, CONFIG.tools.symbols.maxLimit);
  const symbols = searchSymbols(ctx.snapshot_id, args.query, args.language, limit);

  const sc = checkSymbolHitLimit(symbols.length, ctx.repo_id, ctx.snapshot_id, ctx.audit_id);
  if (!sc.allowed) return sc.error!;

  const truncated = symbols.length >= limit;

  return wrapRepositoryContent({
    repo_path: args.repo_path,
    snapshot_id: ctx.snapshot_id,
    symbols,
    truncated,
  }, ctx.audit_id);
}
