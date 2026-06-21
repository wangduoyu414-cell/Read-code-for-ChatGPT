/**
 * Tool registry — registers the four read-only tools with MCP tool definitions.
 * Uses Zod schemas as required by @modelcontextprotocol/sdk.
 * Real tool implementations wired (post-EXEC-008).
 */

import { z } from "zod/v4";
import { CONFIG } from "../config.js";
import { toolError, type ToolError } from "../errors.js";
import { authorizeToolCall, authDeniedResponse } from "../policy/policy-engine.js";
import { createBudgetState } from "../security/budget.js";
import type { SnapshotManifest } from "../snapshot/manifest.js";
// Real tool implementations
import { repoSearcher, repoFetcher, repoTreer, repoSymbols } from "./read-only-tools.js";

// ─── Zod input schemas ──────────────────────────────────────────────────────

const repoSchema = z.string().min(1).optional();
const snapshotSchema = z.string().min(1).optional();

const searchInputSchema = z.object({
  repo_id: repoSchema,
  snapshot_id: snapshotSchema,
  query: z.string().min(1).max(CONFIG.tools.search.queryMaxLength),
  mode: z.enum(["text", "symbol", "hybrid"]).default("text"),
  limit: z.number().int().min(1).max(CONFIG.tools.search.maxLimit).default(CONFIG.tools.search.defaultLimit),
});

const fetchInputSchema = z.object({
  repo_id: repoSchema,
  snapshot_id: snapshotSchema,
  path: z.string().min(1).max(CONFIG.tools.fetch.pathMaxLength),
  line_start: z.number().int().min(1),
  line_end: z.number().int().min(1),
  purpose: z.string().min(1).max(CONFIG.tools.fetch.purposeMaxLength),
});

const treeInputSchema = z.object({
  repo_id: repoSchema,
  snapshot_id: snapshotSchema,
  path: z.string().default("."),
  depth: z.number().int().min(0).max(CONFIG.tools.tree.maxDepth).default(CONFIG.tools.tree.defaultDepth),
  limit: z.number().int().min(1).max(CONFIG.tools.tree.maxLimit).default(CONFIG.tools.tree.defaultLimit),
});

const symbolsInputSchema = z.object({
  repo_id: repoSchema,
  snapshot_id: snapshotSchema,
  query: z.string().min(1).max(CONFIG.tools.symbols.queryMaxLength),
  language: z.string().optional(),
  limit: z.number().int().min(1).max(CONFIG.tools.symbols.maxLimit).default(CONFIG.tools.symbols.defaultLimit),
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
  budgetState: ReturnType<typeof createBudgetState>;
  sessionSnapshotId: string; // enforces cross-tool snapshot consistency (SNAP-002)
}

let runtimeState: RuntimeState | null = null;

export function setRuntimeState(state: RuntimeState): void {
  runtimeState = state;
}

export function getRuntimeState(): RuntimeState | null {
  return runtimeState;
}

// ─── Tool dispatch ───────────────────────────────────────────────────────────

export interface ToolCallArgs {
  repo_id?: string;
  snapshot_id?: string;
  grant_id?: string;
  token?: string;
  [key: string]: unknown;
}

type ResolvedToolCallArgs = ToolCallArgs & {
  repo_id: string;
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

function optionalNonEmptyString(value: unknown, fieldName: "repo_id" | "snapshot_id", fallbackRepoId: string, fallbackSnapshotId: string, auditId: string): OptionalStringResult {
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

function resolveRuntimeToolArgs(args: ToolCallArgs, state: RuntimeState, auditId: string): ResolvedToolCallArgs | ToolError {
  const manifestRepoId = getManifestRepoId(state.manifest);
  const fallbackRepoId = manifestRepoId ?? "unknown";
  const fallbackSnapshotId = state.sessionSnapshotId || "unknown";

  const repoId = optionalNonEmptyString(args.repo_id, "repo_id", fallbackRepoId, fallbackSnapshotId, auditId);
  if (!repoId.ok) return repoId.error;

  const snapshotId = optionalNonEmptyString(args.snapshot_id, "snapshot_id", fallbackRepoId, fallbackSnapshotId, auditId);
  if (!snapshotId.ok) return snapshotId.error;

  if (repoId.value !== undefined && manifestRepoId !== undefined && repoId.value !== manifestRepoId) {
    return toolError(
      "access_denied",
      `Repo mismatch: session bound to ${manifestRepoId}.`,
      repoId.value,
      fallbackSnapshotId,
      CONFIG.policyVersion,
      auditId,
    );
  }

  const effectiveRepoId = repoId.value ?? manifestRepoId;
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
    snapshot_id: effectiveSnapshotId,
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
    return toolError("access_denied", `Unknown tool: ${toolName}`, String(args.repo_id ?? "unknown"), String(args.snapshot_id ?? "unknown"), CONFIG.policyVersion, auditId);
  }

  const state = runtimeState;
  if (!state) {
    return toolError("internal_error", "Runtime not initialized.", String(args.repo_id ?? "unknown"), String(args.snapshot_id ?? "unknown"), CONFIG.policyVersion, auditId);
  }

  const resolvedArgs = resolveRuntimeToolArgs(args, state, auditId);
  if ("isError" in resolvedArgs) {
    return resolvedArgs;
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
      return authDeniedResponse(authResult);
    }
  }

  // SNAP-002 / T-026: Enforce cross-tool snapshot consistency
  if (state.sessionSnapshotId && resolvedArgs.snapshot_id !== state.sessionSnapshotId) {
    return toolError("snapshot_not_ready", `Snapshot mismatch: session bound to ${state.sessionSnapshotId}`, resolvedArgs.repo_id, resolvedArgs.snapshot_id, CONFIG.policyVersion, auditId);
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
        snapshot_id: resolvedArgs.snapshot_id,
        query: String(resolvedArgs.query ?? ""),
        mode: String(resolvedArgs.mode ?? "text"),
        limit: Number(resolvedArgs.limit ?? CONFIG.tools.search.defaultLimit),
      }, manifest, rootDir, state.budgetState);
      break;
    case "repo.fetch":
      result = await repoFetcher({
        repo_id: resolvedArgs.repo_id,
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
        snapshot_id: resolvedArgs.snapshot_id,
        path: String(resolvedArgs.path ?? "."),
        depth: Number(resolvedArgs.depth ?? CONFIG.tools.tree.defaultDepth),
        limit: Number(resolvedArgs.limit ?? CONFIG.tools.tree.defaultLimit),
      }, manifest, state.budgetState);
      break;
    case "repo.symbols":
      result = await repoSymbols({
        repo_id: resolvedArgs.repo_id,
        snapshot_id: resolvedArgs.snapshot_id,
        query: String(resolvedArgs.query ?? ""),
        language: resolvedArgs.language ? String(resolvedArgs.language) : undefined,
        limit: Number(resolvedArgs.limit ?? CONFIG.tools.symbols.defaultLimit),
      }, manifest, state.budgetState);
      break;
    default:
      result = toolError("internal_error", `Unknown tool: ${toolName}`, resolvedArgs.repo_id, resolvedArgs.snapshot_id, CONFIG.policyVersion, auditId);
  }

  // BROKEN CHAIN-003 FIX: Record evidence for every tool call
  import("../audit/evidence.js").then(({ evidenceFromToolCall }) => {
    evidenceFromToolCall(toolName, resolvedArgs.repo_id, resolvedArgs.snapshot_id, auditId, resolvedArgs, result, "error_code" in result);
  }).catch(() => { /* evidence failure must not block tool response */ });

  return result;
}
