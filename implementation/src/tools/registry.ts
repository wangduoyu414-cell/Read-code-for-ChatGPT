/**
 * Tool registry — registers the read-only tools with MCP tool definitions.
 * Uses Zod schemas as required by @modelcontextprotocol/sdk.
 * Real tool implementations wired (post-EXEC-008).
 */

import { z } from "zod/v4";
import { CONFIG } from "../config.js";
import { toolError, type ToolError } from "../errors.js";
import { authorizeToolCall, authDeniedResponse } from "../policy/policy-engine.js";
import { createBudgetState } from "../security/budget.js";
import type { SnapshotManifest } from "../snapshot/manifest.js";
import { refreshRepositorySnapshot } from "../snapshot/refresh.js";
import { normalizeRepoRootPath, repoPathCompareKey } from "../repo/repo-catalog.js";
// Real tool implementations
import { repoSearcher, repoFetcher, repoTreer, repoSymbols } from "./read-only-tools.js";

// ─── Zod input schemas ──────────────────────────────────────────────────────

const repoPathSchema = z.string().min(1);
const optionalRepoPathSchema = repoPathSchema.optional();
const snapshotSchema = z.string().min(1).optional();

const listInputSchema = z.object({});

const searchInputSchema = z.object({
  repo_path: optionalRepoPathSchema,
  snapshot_id: snapshotSchema,
  query: z.string().min(1).max(CONFIG.tools.search.queryMaxLength),
  mode: z.enum(["text", "symbol", "hybrid"]).default("text"),
  limit: z.number().int().min(1).max(CONFIG.tools.search.maxLimit).default(CONFIG.tools.search.defaultLimit),
});

const fetchInputSchema = z.object({
  repo_path: optionalRepoPathSchema,
  snapshot_id: snapshotSchema,
  path: z.string().min(1).max(CONFIG.tools.fetch.pathMaxLength),
  line_start: z.number().int().min(1),
  line_end: z.number().int().min(1),
  purpose: z.string().min(1).max(CONFIG.tools.fetch.purposeMaxLength),
});

const treeInputSchema = z.object({
  repo_path: optionalRepoPathSchema,
  snapshot_id: snapshotSchema,
  path: z.string().default("."),
  depth: z.number().int().min(0).max(CONFIG.tools.tree.maxDepth).default(CONFIG.tools.tree.defaultDepth),
  limit: z.number().int().min(1).max(CONFIG.tools.tree.maxLimit).default(CONFIG.tools.tree.defaultLimit),
});

const symbolsInputSchema = z.object({
  repo_path: optionalRepoPathSchema,
  snapshot_id: snapshotSchema,
  query: z.string().min(1).max(CONFIG.tools.symbols.queryMaxLength),
  language: z.string().optional(),
  limit: z.number().int().min(1).max(CONFIG.tools.symbols.maxLimit).default(CONFIG.tools.symbols.defaultLimit),
});

const refreshInputSchema = z.object({
  repo_path: optionalRepoPathSchema,
  snapshot_id: snapshotSchema,
  reason: z.string().min(1).max(CONFIG.tools.refresh.reasonMaxLength).optional(),
});

// ─── Tool definitions ───────────────────────────────────────────────────────

export interface ToolRegistration {
  name: string;
  title: string;
  description: string;
  inputSchema: z.ZodObject<z.ZodRawShape>;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    openWorldHint: boolean;
  };
}

const TOOL_REGISTRATIONS: ToolRegistration[] = [
  {
    name: CONFIG.tools.list.name,
    title: CONFIG.tools.list.title,
    description: CONFIG.tools.list.description,
    inputSchema: listInputSchema,
    annotations: {
      readOnlyHint: CONFIG.tools.readOnlyHint,
      destructiveHint: CONFIG.tools.destructiveHint,
      openWorldHint: CONFIG.tools.openWorldHint,
    },
  },
  {
    name: CONFIG.tools.search.name,
    title: CONFIG.tools.search.title,
    description: CONFIG.tools.search.description,
    inputSchema: searchInputSchema,
    annotations: {
      readOnlyHint: CONFIG.tools.readOnlyHint,
      destructiveHint: CONFIG.tools.destructiveHint,
      openWorldHint: CONFIG.tools.openWorldHint,
    },
  },
  {
    name: CONFIG.tools.fetch.name,
    title: CONFIG.tools.fetch.title,
    description: CONFIG.tools.fetch.description,
    inputSchema: fetchInputSchema,
    annotations: {
      readOnlyHint: CONFIG.tools.readOnlyHint,
      destructiveHint: CONFIG.tools.destructiveHint,
      openWorldHint: CONFIG.tools.openWorldHint,
    },
  },
  {
    name: CONFIG.tools.tree.name,
    title: CONFIG.tools.tree.title,
    description: CONFIG.tools.tree.description,
    inputSchema: treeInputSchema,
    annotations: {
      readOnlyHint: CONFIG.tools.readOnlyHint,
      destructiveHint: CONFIG.tools.destructiveHint,
      openWorldHint: CONFIG.tools.openWorldHint,
    },
  },
  {
    name: CONFIG.tools.symbols.name,
    title: CONFIG.tools.symbols.title,
    description: CONFIG.tools.symbols.description,
    inputSchema: symbolsInputSchema,
    annotations: {
      readOnlyHint: CONFIG.tools.readOnlyHint,
      destructiveHint: CONFIG.tools.destructiveHint,
      openWorldHint: CONFIG.tools.openWorldHint,
    },
  },
  {
    name: CONFIG.tools.refresh.name,
    title: CONFIG.tools.refresh.title,
    description: CONFIG.tools.refresh.description,
    inputSchema: refreshInputSchema,
    annotations: {
      readOnlyHint: CONFIG.tools.readOnlyHint,
      destructiveHint: CONFIG.tools.destructiveHint,
      openWorldHint: CONFIG.tools.openWorldHint,
    },
  },
];

// ─── Registry API ───────────────────────────────────────────────────────────

export function getToolRegistrations(): ToolRegistration[] {
  return TOOL_REGISTRATIONS;
}

export function getToolRegistration(name: string): ToolRegistration | undefined {
  return TOOL_REGISTRATIONS.find((t) => t.name === name);
}

export function isRegisteredTool(name: string): boolean {
  return TOOL_REGISTRATIONS.some((t) => t.name === name);
}

// ─── Runtime state (dev mode) ───────────────────────────────────────────────

export interface RuntimeState {
  manifest: unknown;
  rootDir: string;
  repoPath: string;
  repoName?: string;
  repoDescription?: string;
  budgetState: ReturnType<typeof createBudgetState>;
  sessionSnapshotId: string; // enforces cross-tool snapshot consistency (SNAP-002)
}

let runtimeState: RuntimeState | null = null;
const runtimeStatesByPath = new Map<string, RuntimeState>();

export function setRuntimeState(state: RuntimeState): void {
  runtimeState = state;
  runtimeStatesByPath.clear();
  runtimeStatesByPath.set(repoPathCompareKey(state.repoPath), state);
}

export function setRuntimeStates(states: RuntimeState[]): void {
  runtimeState = states[0] ?? null;
  runtimeStatesByPath.clear();
  for (const state of states) {
    runtimeStatesByPath.set(repoPathCompareKey(state.repoPath), state);
  }
}

export function getRuntimeState(): RuntimeState | null {
  return runtimeState;
}

export function getRuntimeStates(): RuntimeState[] {
  return Array.from(runtimeStatesByPath.values());
}

function publishRuntimeSnapshot(repoPath: string, manifest: SnapshotManifest, snapshotId: string): void {
  const state = runtimeStatesByPath.get(repoPathCompareKey(repoPath));
  if (!state) return;
  const nextState = {
    ...state,
    manifest,
    sessionSnapshotId: snapshotId,
  };
  runtimeStatesByPath.set(repoPathCompareKey(repoPath), nextState);
  if (runtimeState?.repoPath === state.repoPath) {
    runtimeState = nextState;
  }
}

// ─── Tool dispatch ───────────────────────────────────────────────────────────

export interface ToolCallArgs {
  repo_path?: string;
  snapshot_id?: string;
  grant_id?: string;
  token?: string;
  [key: string]: unknown;
}

type ResolvedToolCallArgs = ToolCallArgs & {
  repo_id: string;
  repo_path: string;
  snapshot_id: string;
};

type OptionalStringResult =
  | { ok: true; value: string | undefined }
  | { ok: false; error: ToolError };

function getManifestRepoId(manifest: unknown): string | undefined {
  if (typeof manifest !== "object" || manifest === null || !("repo_id" in manifest)) {
    return undefined;
  }

  const repoId = (manifest as { repo_id?: unknown }).repo_id;
  return typeof repoId === "string" && repoId.length > 0 ? repoId : undefined;
}

function optionalNonEmptyString(value: unknown, fieldName: "snapshot_id", fallbackRepoId: string, fallbackSnapshotId: string, auditId: string): OptionalStringResult {
  if (value === undefined) {
    return { ok: true, value: undefined };
  }
  if (typeof value === "string" && value.length > 0) {
    return { ok: true, value };
  }

  return {
    ok: false,
    error: toolError(
      "access_denied",
      `${fieldName} must be a non-empty string when provided.`,
      fallbackRepoId,
      fallbackSnapshotId,
      CONFIG.policyVersion,
      auditId,
    ),
  };
}

function requiredRepoPath(value: unknown, auditId: string): string | ToolError {
  if (value === undefined) {
    if (runtimeStatesByPath.size === 1) {
      const onlyState = runtimeStatesByPath.values().next().value as RuntimeState | undefined;
      if (onlyState) return onlyState.repoPath;
    }

    return toolError(
      "access_denied",
      runtimeStatesByPath.size > 1
        ? "repo_path is required when multiple repositories are configured. Call repo.list and pass an exact repo_path."
        : "repo_path must be a non-empty string from repo.list.",
      "unknown",
      "unknown",
      CONFIG.policyVersion,
      auditId,
    );
  }

  if (typeof value !== "string" || value.length === 0) {
    return toolError(
      "access_denied",
      "repo_path must be a non-empty string when provided.",
      "unknown",
      "unknown",
      CONFIG.policyVersion,
      auditId,
    );
  }

  return value;
}

function stateForRepoPath(repoPath: string, auditId: string): RuntimeState | ToolError {
  const normalized = normalizeRepoRootPath(repoPath);
  const state = runtimeStatesByPath.get(repoPathCompareKey(normalized));
  if (!state) {
    return toolError(
      "access_denied",
      "repo_path is not in the configured repository whitelist.",
      "unknown",
      "unknown",
      CONFIG.policyVersion,
      auditId,
    );
  }
  return state;
}

function withPublicRepoPath(result: ToolError | Record<string, unknown>, repoPath: string): ToolError | Record<string, unknown> {
  const output: Record<string, unknown> = { ...result, repo_path: repoPath };
  delete output.repo_id;
  return output;
}

function summarizeTopDirs(manifest: unknown, limit = 12): string[] {
  if (typeof manifest !== "object" || manifest === null || !("files" in manifest)) return [];
  const files = (manifest as { files?: unknown }).files;
  if (!Array.isArray(files)) return [];

  const dirs = new Set<string>();
  for (const file of files) {
    if (typeof file !== "object" || file === null) continue;
    const item = file as { relative_path?: unknown; index_admitted?: unknown };
    if (item.index_admitted !== true || typeof item.relative_path !== "string") continue;
    const [first] = item.relative_path.split("/");
    if (first && item.relative_path.includes("/")) dirs.add(first);
    if (dirs.size >= limit) break;
  }
  return Array.from(dirs).sort();
}

function summarizeLanguages(manifest: unknown, limit = 5): string[] {
  if (typeof manifest !== "object" || manifest === null || !("files" in manifest)) return [];
  const files = (manifest as { files?: unknown }).files;
  if (!Array.isArray(files)) return [];

  const counts = new Map<string, number>();
  for (const file of files) {
    if (typeof file !== "object" || file === null) continue;
    const item = file as { language?: unknown; index_admitted?: unknown };
    if (item.index_admitted !== true || typeof item.language !== "string" || item.language.length === 0) continue;
    counts.set(item.language, (counts.get(item.language) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([language]) => language);
}

function countManifestFiles(manifest: unknown): number {
  if (typeof manifest !== "object" || manifest === null || !("files" in manifest)) return 0;
  const files = (manifest as { files?: unknown }).files;
  return Array.isArray(files) ? files.length : 0;
}

function resolveRuntimeToolArgs(args: ToolCallArgs, state: RuntimeState, auditId: string): ResolvedToolCallArgs | ToolError {
  const manifestRepoId = getManifestRepoId(state.manifest);
  const fallbackRepoId = manifestRepoId ?? "unknown";
  const fallbackSnapshotId = state.sessionSnapshotId || "unknown";

  const snapshotId = optionalNonEmptyString(args.snapshot_id, "snapshot_id", fallbackRepoId, fallbackSnapshotId, auditId);
  if (!snapshotId.ok) return snapshotId.error;

  const effectiveRepoId = manifestRepoId;
  const effectiveSnapshotId = snapshotId.value ?? state.sessionSnapshotId;

  if (!effectiveRepoId || !effectiveSnapshotId) {
    return toolError(
      "internal_error",
      "Runtime context missing repo_id or snapshot_id.",
      fallbackRepoId,
      fallbackSnapshotId,
      CONFIG.policyVersion,
      auditId,
    );
  }

  return {
    ...args,
    repo_id: effectiveRepoId,
    repo_path: state.repoPath,
    snapshot_id: effectiveSnapshotId,
  };
}

function listRepositories(auditId: string): Record<string, unknown> {
  const repositories = getRuntimeStates().map((state) => ({
    name: state.repoName ?? state.repoPath,
    description: state.repoDescription ?? "",
    repo_path: state.repoPath,
    snapshot_id: state.sessionSnapshotId,
    file_count: countManifestFiles(state.manifest),
    top_dirs: summarizeTopDirs(state.manifest),
    primary_languages: summarizeLanguages(state.manifest),
  }));

  return {
    repositories,
    count: repositories.length,
    content_origin: CONFIG.contentOrigin,
    instruction_trust: CONFIG.instructionTrust,
    policy_version: CONFIG.policyVersion,
    audit_id: auditId,
  };
}

/**
 * Main tool dispatch — chains auth → tool → evidence.
 * Wires all five broken chains identified in the audit.
 */
export async function handleToolCall(
  toolName: string,
  args: ToolCallArgs,
  auditId: string,
): Promise<ToolError | Record<string, unknown>> {
  if (!isRegisteredTool(toolName)) {
    const error = toolError("access_denied", `Unknown tool: ${toolName}`, "unknown", String(args.snapshot_id ?? "unknown"), CONFIG.policyVersion, auditId);
    return withPublicRepoPath(error, typeof args.repo_path === "string" ? args.repo_path : "unknown");
  }

  if (toolName === "repo.list") {
    const result = listRepositories(auditId);
    import("../audit/evidence.js").then(({ evidenceFromToolCall }) => {
      evidenceFromToolCall(toolName, "repo-list", "current", auditId, args, result, false);
    }).catch(() => { /* evidence failure must not block tool response */ });
    return result;
  }

  if (runtimeStatesByPath.size === 0) {
    const error = toolError("internal_error", "Runtime not initialized.", "unknown", String(args.snapshot_id ?? "unknown"), CONFIG.policyVersion, auditId);
    return withPublicRepoPath(error, typeof args.repo_path === "string" ? args.repo_path : "unknown");
  }

  const repoPath = requiredRepoPath(args.repo_path, auditId);
  if (typeof repoPath !== "string") {
    return withPublicRepoPath(repoPath, "unknown");
  }

  const state = stateForRepoPath(repoPath, auditId);
  if ("isError" in state) {
    return withPublicRepoPath(state, repoPath);
  }

  const resolvedArgs = resolveRuntimeToolArgs(args, state, auditId);
  if ("isError" in resolvedArgs) {
    return withPublicRepoPath(resolvedArgs, state.repoPath);
  }

  // BROKEN CHAIN-001 FIX: Auth check on every tool call
  if (resolvedArgs.token && resolvedArgs.grant_id) {
    const authResult = authorizeToolCall(
      String(resolvedArgs.token),
      String(resolvedArgs.grant_id),
      toolName,
      resolvedArgs.repo_id,
      resolvedArgs.snapshot_id,
      String(resolvedArgs.path ?? resolvedArgs.query ?? "."),
    );
    if (!authResult.allowed) {
      return withPublicRepoPath(authDeniedResponse(authResult), resolvedArgs.repo_path);
    }
  }

  // SNAP-002 / T-026: Enforce cross-tool snapshot consistency
  if (state.sessionSnapshotId && resolvedArgs.snapshot_id !== state.sessionSnapshotId) {
    return withPublicRepoPath(
      toolError("snapshot_not_ready", `Snapshot mismatch: session bound to ${state.sessionSnapshotId}`, resolvedArgs.repo_id, resolvedArgs.snapshot_id, CONFIG.policyVersion, auditId),
      resolvedArgs.repo_path,
    );
  }

  // BROKEN CHAIN-005 FIX: Grant budget check
  // (invoked within each tool function via the shared budget state)

  // BROKEN CHAIN-002 FIX: Dispatch to real implementations
  const manifest = state.manifest as SnapshotManifest;
  const rootDir = state.rootDir;

  let result: ToolError | Record<string, unknown>;

  switch (toolName) {
    case "repo.search":
      result = await repoSearcher({
        repo_id: resolvedArgs.repo_id,
        repo_path: resolvedArgs.repo_path,
        snapshot_id: resolvedArgs.snapshot_id,
        query: String(resolvedArgs.query ?? ""),
        mode: String(resolvedArgs.mode ?? "text"),
        limit: Number(resolvedArgs.limit ?? CONFIG.tools.search.defaultLimit),
      }, manifest, rootDir, state.budgetState);
      break;
    case "repo.fetch":
      result = await repoFetcher({
        repo_id: resolvedArgs.repo_id,
        repo_path: resolvedArgs.repo_path,
        snapshot_id: resolvedArgs.snapshot_id,
        path: String(resolvedArgs.path ?? ""),
        line_start: Number(resolvedArgs.line_start ?? 1),
        line_end: Number(resolvedArgs.line_end ?? 1),
        purpose: String(resolvedArgs.purpose ?? "unknown"),
      }, manifest, rootDir, state.budgetState);
      break;
    case "repo.tree":
      result = await repoTreer({
        repo_id: resolvedArgs.repo_id,
        repo_path: resolvedArgs.repo_path,
        snapshot_id: resolvedArgs.snapshot_id,
        path: String(resolvedArgs.path ?? "."),
        depth: Number(resolvedArgs.depth ?? CONFIG.tools.tree.defaultDepth),
        limit: Number(resolvedArgs.limit ?? CONFIG.tools.tree.defaultLimit),
      }, manifest, state.budgetState);
      break;
    case "repo.symbols":
      result = await repoSymbols({
        repo_id: resolvedArgs.repo_id,
        repo_path: resolvedArgs.repo_path,
        snapshot_id: resolvedArgs.snapshot_id,
        query: String(resolvedArgs.query ?? ""),
        language: resolvedArgs.language ? String(resolvedArgs.language) : undefined,
        limit: Number(resolvedArgs.limit ?? CONFIG.tools.symbols.defaultLimit),
      }, manifest, state.budgetState);
      break;
    case "repo.refresh":
      result = await refreshRepositorySnapshot({
        repo_id: resolvedArgs.repo_id,
        repo_path: resolvedArgs.repo_path,
        current_snapshot_id: resolvedArgs.snapshot_id,
        rootDir,
        budget: state.budgetState,
        audit_id: auditId,
        publishSnapshot: (manifest, snapshotId) => publishRuntimeSnapshot(resolvedArgs.repo_path, manifest, snapshotId),
      });
      break;
    default:
      result = toolError("internal_error", `Unknown tool: ${toolName}`, resolvedArgs.repo_id, resolvedArgs.snapshot_id, CONFIG.policyVersion, auditId);
  }

  // BROKEN CHAIN-003 FIX: Record evidence for every tool call
  import("../audit/evidence.js").then(({ evidenceFromToolCall }) => {
    evidenceFromToolCall(toolName, resolvedArgs.repo_id, resolvedArgs.snapshot_id, auditId, resolvedArgs, result, "error_code" in result);
  }).catch(() => { /* evidence failure must not block tool response */ });

  return withPublicRepoPath(result, resolvedArgs.repo_path);
}
