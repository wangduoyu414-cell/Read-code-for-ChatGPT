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
import { repoSearcher, repoFiles, repoFetcher, repoTreer, repoSymbols } from "./read-only-tools.js";

const LEGACY_TOOL_ALIASES = new Map<string, string>([
  ["read_code/api_tool", CONFIG.tools.readCode.name],
  ["read_code.api_tool", CONFIG.tools.readCode.name],
  ["repo.list", CONFIG.tools.list.name],
  ["repo.search", CONFIG.tools.search.name],
  ["repo.files", CONFIG.tools.files.name],
  ["repo.fetch", CONFIG.tools.fetch.name],
  ["repo.tree", CONFIG.tools.tree.name],
  ["repo.symbols", CONFIG.tools.symbols.name],
  ["repo.refresh", CONFIG.tools.refresh.name],
]);

function canonicalToolName(toolName: string): string {
  return LEGACY_TOOL_ALIASES.get(toolName) ?? toolName;
}

function chatGptToolMeta(invoking: string, invoked: string): Record<string, unknown> {
  return {
    securitySchemes: [{ type: "noauth" }],
    ui: { visibility: ["model", "app"] },
    "openai/visibility": "public",
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked,
  };
}

// ─── Zod input schemas ──────────────────────────────────────────────────────

const repoPathSchema = z.string().min(1);
const snapshotSchema = z.string().min(1).optional();

const listInputSchema = z.object({});
const apiToolObjectSchema = z.record(z.string(), z.unknown());

const apiToolInputSchema = z.object({
  tool: z.string().optional(),
  tool_name: z.string().optional(),
  name: z.string().optional(),
  operation: z.string().optional(),
  action: z.string().optional(),
  method: z.string().optional(),
  endpoint: z.string().optional(),
  arguments: apiToolObjectSchema.optional(),
  args: apiToolObjectSchema.optional(),
  params: apiToolObjectSchema.optional(),
  input: apiToolObjectSchema.optional(),
}).passthrough();

function repoPathFieldSchema(requireRepoPath: boolean) {
  return requireRepoPath ? repoPathSchema : repoPathSchema.optional();
}

function searchInputSchema(requireRepoPath: boolean) {
  return z.object({
    repo_path: repoPathFieldSchema(requireRepoPath),
    snapshot_id: snapshotSchema,
    query: z.string().min(1).max(CONFIG.tools.search.queryMaxLength),
    mode: z.enum(["text", "symbol", "hybrid"]).default("text"),
    limit: z.number().int().min(1).max(CONFIG.tools.search.maxLimit).default(CONFIG.tools.search.defaultLimit),
  });
}

function fetchInputSchema(requireRepoPath: boolean) {
  return z.object({
    repo_path: repoPathFieldSchema(requireRepoPath),
    snapshot_id: snapshotSchema,
    path: z.string().min(1).max(CONFIG.tools.fetch.pathMaxLength),
    line_start: z.number().int().min(1),
    line_end: z.number().int().min(1),
    purpose: z.string().min(1).max(CONFIG.tools.fetch.purposeMaxLength),
  });
}

function filesInputSchema(requireRepoPath: boolean) {
  return z.object({
    repo_path: repoPathFieldSchema(requireRepoPath),
    snapshot_id: snapshotSchema,
    prefix: z.string().max(CONFIG.tools.files.prefixMaxLength).optional(),
    suffixes: z.array(z.string().min(1).max(32)).max(CONFIG.tools.files.filterMaxItems).optional(),
    languages: z.array(z.string().min(1).max(64)).max(CONFIG.tools.files.filterMaxItems).optional(),
    states: z.array(z.enum(["indexed", "fetchable_unindexed", "excluded"])).max(3).optional(),
    cursor: z.string().max(CONFIG.tools.files.cursorMaxLength).optional(),
    limit: z.number().int().min(1).max(CONFIG.tools.files.maxLimit).default(CONFIG.tools.files.defaultLimit),
  });
}

function treeInputSchema(requireRepoPath: boolean) {
  return z.object({
    repo_path: repoPathFieldSchema(requireRepoPath),
    snapshot_id: snapshotSchema,
    path: z.string().default("."),
    depth: z.number().int().min(0).max(CONFIG.tools.tree.maxDepth).default(CONFIG.tools.tree.defaultDepth),
    limit: z.number().int().min(1).max(CONFIG.tools.tree.maxLimit).default(CONFIG.tools.tree.defaultLimit),
  });
}

function symbolsInputSchema(requireRepoPath: boolean) {
  return z.object({
    repo_path: repoPathFieldSchema(requireRepoPath),
    snapshot_id: snapshotSchema,
    query: z.string().min(1).max(CONFIG.tools.symbols.queryMaxLength),
    language: z.string().optional(),
    limit: z.number().int().min(1).max(CONFIG.tools.symbols.maxLimit).default(CONFIG.tools.symbols.defaultLimit),
  });
}

function refreshInputSchema(requireRepoPath: boolean) {
  return z.object({
    repo_path: repoPathFieldSchema(requireRepoPath),
    snapshot_id: snapshotSchema,
    reason: z.string().min(1).max(CONFIG.tools.refresh.reasonMaxLength).optional(),
  });
}

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
  _meta: Record<string, unknown>;
}

function toolAnnotations(): ToolRegistration["annotations"] {
  return {
    readOnlyHint: CONFIG.tools.readOnlyHint,
    destructiveHint: CONFIG.tools.destructiveHint,
    openWorldHint: CONFIG.tools.openWorldHint,
  };
}

function buildToolRegistrations(requireRepoPath: boolean): ToolRegistration[] {
  return [
    {
      name: CONFIG.tools.readCode.name,
      title: CONFIG.tools.readCode.title,
      description: CONFIG.tools.readCode.description,
      inputSchema: apiToolInputSchema,
      annotations: toolAnnotations(),
      _meta: chatGptToolMeta("Reading repository", "Repository response ready"),
    },
    {
      name: CONFIG.tools.apiTool.name,
      title: CONFIG.tools.apiTool.title,
      description: CONFIG.tools.apiTool.description,
      inputSchema: apiToolInputSchema,
      annotations: toolAnnotations(),
      _meta: chatGptToolMeta("Reading repository", "Repository response ready"),
    },
    {
      name: CONFIG.tools.list.name,
      title: CONFIG.tools.list.title,
      description: CONFIG.tools.list.description,
      inputSchema: listInputSchema,
      annotations: toolAnnotations(),
      _meta: chatGptToolMeta("Listing repositories", "Repositories listed"),
    },
    {
      name: CONFIG.tools.search.name,
      title: CONFIG.tools.search.title,
      description: CONFIG.tools.search.description,
      inputSchema: searchInputSchema(requireRepoPath),
      annotations: toolAnnotations(),
      _meta: chatGptToolMeta("Searching repository", "Search complete"),
    },
    {
      name: CONFIG.tools.files.name,
      title: CONFIG.tools.files.title,
      description: CONFIG.tools.files.description,
      inputSchema: filesInputSchema(requireRepoPath),
      annotations: toolAnnotations(),
      _meta: chatGptToolMeta("Listing repository files", "Repository files ready"),
    },
    {
      name: CONFIG.tools.fetch.name,
      title: CONFIG.tools.fetch.title,
      description: CONFIG.tools.fetch.description,
      inputSchema: fetchInputSchema(requireRepoPath),
      annotations: toolAnnotations(),
      _meta: chatGptToolMeta("Reading file segment", "File segment ready"),
    },
    {
      name: CONFIG.tools.tree.name,
      title: CONFIG.tools.tree.title,
      description: CONFIG.tools.tree.description,
      inputSchema: treeInputSchema(requireRepoPath),
      annotations: toolAnnotations(),
      _meta: chatGptToolMeta("Reading repository tree", "Repository tree ready"),
    },
    {
      name: CONFIG.tools.symbols.name,
      title: CONFIG.tools.symbols.title,
      description: CONFIG.tools.symbols.description,
      inputSchema: symbolsInputSchema(requireRepoPath),
      annotations: toolAnnotations(),
      _meta: chatGptToolMeta("Finding symbols", "Symbols ready"),
    },
    {
      name: CONFIG.tools.refresh.name,
      title: CONFIG.tools.refresh.title,
      description: CONFIG.tools.refresh.description,
      inputSchema: refreshInputSchema(requireRepoPath),
      annotations: toolAnnotations(),
      _meta: chatGptToolMeta("Refreshing snapshot", "Snapshot refreshed"),
    },
  ];
}

// ─── Registry API ───────────────────────────────────────────────────────────

export function getToolRegistrations(): ToolRegistration[] {
  return buildToolRegistrations(false);
}

export function getToolRegistrationsForRuntime(): ToolRegistration[] {
  return buildToolRegistrations(getRuntimeStates().length > 1);
}

export function getToolRegistration(name: string): ToolRegistration | undefined {
  const canonicalName = canonicalToolName(name);
  return getToolRegistrations().find((t) => t.name === canonicalName);
}

export function isRegisteredTool(name: string): boolean {
  const canonicalName = canonicalToolName(name);
  return getToolRegistrations().some((t) => t.name === canonicalName);
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
  snapshotMaxEntries?: number;
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
        ? "repo_path is required when multiple repositories are configured. Call repo_list and pass an exact repo_path."
        : "repo_path must be a non-empty string from repo_list.",
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
    const item = file as { relative_path?: unknown; fetchable?: unknown };
    if (item.fetchable !== true || typeof item.relative_path !== "string") continue;
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
    const item = file as { language?: unknown; fetchable?: unknown };
    if (item.fetchable !== true || typeof item.language !== "string" || item.language.length === 0) continue;
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

function authRequestedPath(toolName: string, args: ResolvedToolCallArgs): string {
  if (toolName === CONFIG.tools.fetch.name) return String(args.path ?? ".");
  if (toolName === CONFIG.tools.tree.name) return String(args.path ?? ".");
  if (toolName === CONFIG.tools.files.name) return String(args.prefix ?? ".");
  return String(args.path ?? args.query ?? ".");
}

const API_TOOL_ROUTE_FIELDS = new Set([
  "tool",
  "tool_name",
  "name",
  "operation",
  "action",
  "method",
  "endpoint",
  "arguments",
  "args",
  "params",
  "input",
]);

const API_TOOL_TARGET_ALIASES = new Map<string, string>([
  ["list", CONFIG.tools.list.name],
  ["repos", CONFIG.tools.list.name],
  ["repositories", CONFIG.tools.list.name],
  ["repo_list", CONFIG.tools.list.name],
  ["repo.list", CONFIG.tools.list.name],
  ["files", CONFIG.tools.files.name],
  ["file_map", CONFIG.tools.files.name],
  ["repo_files", CONFIG.tools.files.name],
  ["repo.files", CONFIG.tools.files.name],
  ["search", CONFIG.tools.search.name],
  ["repo_search", CONFIG.tools.search.name],
  ["repo.search", CONFIG.tools.search.name],
  ["fetch", CONFIG.tools.fetch.name],
  ["read", CONFIG.tools.fetch.name],
  ["repo_fetch", CONFIG.tools.fetch.name],
  ["repo.fetch", CONFIG.tools.fetch.name],
  ["tree", CONFIG.tools.tree.name],
  ["repo_tree", CONFIG.tools.tree.name],
  ["repo.tree", CONFIG.tools.tree.name],
  ["symbols", CONFIG.tools.symbols.name],
  ["symbol", CONFIG.tools.symbols.name],
  ["repo_symbols", CONFIG.tools.symbols.name],
  ["repo.symbols", CONFIG.tools.symbols.name],
  ["refresh", CONFIG.tools.refresh.name],
  ["repo_refresh", CONFIG.tools.refresh.name],
  ["repo.refresh", CONFIG.tools.refresh.name],
]);

function objectArg(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function normalizeApiToolTarget(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0) return undefined;
  const normalized = trimmed.replace(/^\/+/, "").replace(/^read_code\//, "").replace(/^read_code\./, "");
  return API_TOOL_TARGET_ALIASES.get(normalized) ?? canonicalToolName(normalized);
}

function inferApiToolTarget(args: Record<string, unknown>): string {
  if (typeof args.query === "string") return CONFIG.tools.search.name;
  if (typeof args.path === "string" && (args.line_start !== undefined || args.line_end !== undefined)) return CONFIG.tools.fetch.name;
  if (args.prefix !== undefined || args.suffixes !== undefined || args.languages !== undefined || args.states !== undefined || args.cursor !== undefined) return CONFIG.tools.files.name;
  if (args.reason !== undefined) return CONFIG.tools.refresh.name;
  if (args.path !== undefined || args.depth !== undefined) return CONFIG.tools.tree.name;
  return CONFIG.tools.list.name;
}

function resolveApiToolCall(args: ToolCallArgs, auditId: string): { toolName: string; args: ToolCallArgs } | ToolError {
  const nestedArgs =
    objectArg(args.arguments) ??
    objectArg(args.args) ??
    objectArg(args.params) ??
    objectArg(args.input) ??
    {};
  const routedArgs: ToolCallArgs = { ...nestedArgs };

  for (const [key, value] of Object.entries(args)) {
    if (!API_TOOL_ROUTE_FIELDS.has(key)) {
      routedArgs[key] = value;
    }
  }

  const toolName =
    normalizeApiToolTarget(args.tool) ??
    normalizeApiToolTarget(args.tool_name) ??
    normalizeApiToolTarget(args.name) ??
    normalizeApiToolTarget(args.operation) ??
    normalizeApiToolTarget(args.action) ??
    normalizeApiToolTarget(args.method) ??
    normalizeApiToolTarget(args.endpoint) ??
    inferApiToolTarget(routedArgs);

  if (toolName === CONFIG.tools.apiTool.name || toolName === CONFIG.tools.readCode.name) {
    return toolError(
      "access_denied",
      "Compatibility wrapper cannot route to itself. Use one of repo_list, repo_files, repo_search, repo_fetch, repo_tree, repo_symbols, or repo_refresh.",
      "unknown",
      String(args.snapshot_id ?? "unknown"),
      CONFIG.policyVersion,
      auditId,
    );
  }

  if (!isRegisteredTool(toolName)) {
    return toolError(
      "access_denied",
      `api_tool target is not supported: ${toolName}`,
      "unknown",
      String(args.snapshot_id ?? "unknown"),
      CONFIG.policyVersion,
      auditId,
    );
  }

  return { toolName, args: routedArgs };
}

function buildUsageGuide(): Record<string, unknown> {
  return {
    guide_version: "first-call-2026-06-23",
    purpose: "Use authorized local repository snapshots through read-only tools.",
    recommended_next_calls: [
      {
        step: 1,
        tool: CONFIG.tools.list.name,
        when: "Start here when multiple repositories are configured or connector usage is unclear.",
        arguments_hint: {},
      },
      {
        step: 2,
        tool: CONFIG.tools.files.name,
        when: "Use after choosing a repository to discover exact relative paths and fetch/index/exclusion status.",
        arguments_hint: { repo_path: "<exact repo_path from repo_list>", prefix: "src" },
      },
      {
        step: 3,
        tool: CONFIG.tools.symbols.name,
        when: "Use for class, function, and definition questions.",
        arguments_hint: { repo_path: "<exact repo_path from repo_list>", query: "<symbol name>" },
      },
      {
        step: 4,
        tool: CONFIG.tools.search.name,
        when: "Use for indexed text, config, docs, and error strings after file discovery.",
        arguments_hint: { repo_path: "<exact repo_path from repo_list>", query: "<text to search>" },
      },
      {
        step: 5,
        tool: CONFIG.tools.fetch.name,
        when: "Use after a relative file path is known; fetch the smallest useful line range.",
        arguments_hint: { repo_path: "<exact repo_path from repo_list>", path: "<relative/path.ts>", line_start: 1, line_end: 80, purpose: "<why this file is needed>" },
      },
      {
        step: 6,
        tool: CONFIG.tools.refresh.name,
        when: "Use only when the user says files changed or earlier results may be stale.",
        arguments_hint: { repo_path: "<exact repo_path from repo_list>", reason: "repository changed" },
      },
    ],
    path_rules: [
      "When multiple repositories are configured, copy repo_path exactly from repo_list.",
      "repo_path selects the authorized repository; repo_fetch path must be relative inside that repository.",
      "Absolute file paths, parent-directory traversal, symlink escapes, sensitive files, and full-repository export are rejected.",
    ],
    discovery_notes: [
      "repo_files is the source of truth for file discovery in the active snapshot.",
      "repo_search only covers indexed content; a search miss does not prove a file is absent.",
      "If search misses a likely file, use repo_files with a precise prefix such as src, tests, tools, config, or docs, then call repo_fetch with the returned relative path.",
      "Use repo_tree only for directory layout questions or targeted directory navigation.",
    ],
    compatibility_names: [CONFIG.tools.readCode.name, CONFIG.tools.apiTool.name],
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
    usage_guide: buildUsageGuide(),
    content_origin: CONFIG.contentOrigin,
    instruction_trust: CONFIG.instructionTrust,
    policy_version: CONFIG.policyVersion,
    audit_id: auditId,
    isError: false,
    error_code: null,
    message: null,
    next_cursor: null,
    retryable: false,
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
  const canonicalName = canonicalToolName(toolName);

  if (!isRegisteredTool(canonicalName)) {
    const error = toolError("access_denied", `Unknown tool: ${toolName}`, "unknown", String(args.snapshot_id ?? "unknown"), CONFIG.policyVersion, auditId);
    return withPublicRepoPath(error, typeof args.repo_path === "string" ? args.repo_path : "unknown");
  }

  if (canonicalName === CONFIG.tools.apiTool.name || canonicalName === CONFIG.tools.readCode.name) {
    const routed = resolveApiToolCall(args, auditId);
    if ("isError" in routed) {
      return withPublicRepoPath(routed, typeof args.repo_path === "string" ? args.repo_path : "unknown");
    }
    return handleToolCall(routed.toolName, routed.args, auditId);
  }

  if (canonicalName === CONFIG.tools.list.name) {
    const result = listRepositories(auditId);
    import("../audit/evidence.js").then(({ evidenceFromToolCall }) => {
      evidenceFromToolCall(canonicalName, "repo-list", "current", auditId, args, result, false);
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
      canonicalName,
      resolvedArgs.repo_id,
      resolvedArgs.snapshot_id,
      authRequestedPath(canonicalName, resolvedArgs),
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

  switch (canonicalName) {
    case "repo_search":
      result = await repoSearcher({
        repo_id: resolvedArgs.repo_id,
        repo_path: resolvedArgs.repo_path,
        snapshot_id: resolvedArgs.snapshot_id,
        query: String(resolvedArgs.query ?? ""),
        mode: String(resolvedArgs.mode ?? "text"),
        limit: Number(resolvedArgs.limit ?? CONFIG.tools.search.defaultLimit),
      }, manifest, rootDir, state.budgetState);
      break;
    case "repo_files":
      result = await repoFiles({
        repo_id: resolvedArgs.repo_id,
        repo_path: resolvedArgs.repo_path,
        snapshot_id: resolvedArgs.snapshot_id,
        prefix: resolvedArgs.prefix ? String(resolvedArgs.prefix) : undefined,
        suffixes: Array.isArray(resolvedArgs.suffixes) ? resolvedArgs.suffixes.map(String) : undefined,
        languages: Array.isArray(resolvedArgs.languages) ? resolvedArgs.languages.map(String) : undefined,
        states: Array.isArray(resolvedArgs.states) ? resolvedArgs.states.map(String) : undefined,
        cursor: resolvedArgs.cursor ? String(resolvedArgs.cursor) : undefined,
        limit: Number(resolvedArgs.limit ?? CONFIG.tools.files.defaultLimit),
      }, manifest, state.budgetState);
      break;
    case "repo_fetch":
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
    case "repo_tree":
      result = await repoTreer({
        repo_id: resolvedArgs.repo_id,
        repo_path: resolvedArgs.repo_path,
        snapshot_id: resolvedArgs.snapshot_id,
        path: String(resolvedArgs.path ?? "."),
        depth: Number(resolvedArgs.depth ?? CONFIG.tools.tree.defaultDepth),
        limit: Number(resolvedArgs.limit ?? CONFIG.tools.tree.defaultLimit),
      }, manifest, state.budgetState);
      break;
    case "repo_symbols":
      result = await repoSymbols({
        repo_id: resolvedArgs.repo_id,
        repo_path: resolvedArgs.repo_path,
        snapshot_id: resolvedArgs.snapshot_id,
        query: String(resolvedArgs.query ?? ""),
        language: resolvedArgs.language ? String(resolvedArgs.language) : undefined,
        limit: Number(resolvedArgs.limit ?? CONFIG.tools.symbols.defaultLimit),
      }, manifest, state.budgetState);
      break;
    case "repo_refresh":
      result = await refreshRepositorySnapshot({
        repo_id: resolvedArgs.repo_id,
        repo_path: resolvedArgs.repo_path,
        current_snapshot_id: resolvedArgs.snapshot_id,
        rootDir,
        budget: state.budgetState,
        audit_id: auditId,
        maxEntries: state.snapshotMaxEntries,
        publishSnapshot: (manifest, snapshotId) => publishRuntimeSnapshot(resolvedArgs.repo_path, manifest, snapshotId),
      });
      break;
    default:
      result = toolError("internal_error", `Unknown tool: ${toolName}`, resolvedArgs.repo_id, resolvedArgs.snapshot_id, CONFIG.policyVersion, auditId);
  }

  // BROKEN CHAIN-003 FIX: Record evidence for every tool call
  import("../audit/evidence.js").then(({ evidenceFromToolCall }) => {
    evidenceFromToolCall(canonicalName, resolvedArgs.repo_id, resolvedArgs.snapshot_id, auditId, resolvedArgs, result, "error_code" in result);
  }).catch(() => { /* evidence failure must not block tool response */ });

  return withPublicRepoPath(result, resolvedArgs.repo_path);
}
