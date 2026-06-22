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
import type { SnapshotManifest } from "../snapshot/manifest.js";
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

// ─── repo.search ─────────────────────────────────────────────────────────────

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

// ─── repo.fetch ──────────────────────────────────────────────────────────────

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

// ─── repo.tree ───────────────────────────────────────────────────────────────

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

  const entries = manifest.files
    .filter((f) => {
      if (!f.index_admitted) return false;
      if (prefix && !f.relative_path.startsWith(prefix + "/") && f.relative_path !== prefix) return false;
      const depthOk = f.relative_path.replace(prefix, "").split("/").filter(Boolean).length <= depth;
      return depthOk;
    })
    .slice(0, limit)
    .map((f) => ({
      path: f.relative_path,
      type: "file" as const,
      language: f.language,
      truncated: false,
    }));

  const truncated = entries.length >= limit;

  return wrapRepositoryContent({
    repo_path: args.repo_path,
    snapshot_id: ctx.snapshot_id,
    entries,
    truncated,
  }, ctx.audit_id);
}

// ─── repo.symbols ────────────────────────────────────────────────────────────

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
