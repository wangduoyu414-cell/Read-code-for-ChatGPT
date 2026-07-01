/**
 * Server smoke tests — verify tool registration, annotations, and scaffold.
 * Updated for post-audit wiring.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getToolRegistrations, isRegisteredTool, handleToolCall, setRuntimeState, setRuntimeStates } from "../src/tools/registry.js";
import { isToolError } from "../src/errors.js";
import { CONFIG } from "../src/config.js";
import { createBudgetState } from "../src/security/budget.js";
import { startServer } from "../src/server.js";
import { requestSnapshot, transitionState, attachManifest, clearRegistry } from "../src/snapshot/snapshot-registry.js";
import { registerRepo, bindRepo, clearCatalog, normalizeRepoRootPath } from "../src/repo/repo-catalog.js";

let runtimeRepoPath: string;
let runtimeManifest: Parameters<typeof attachManifest>[1];

beforeEach(() => {
  clearCatalog();
  clearRegistry();
  const repoPath = normalizeRepoRootPath("C:\\Example\\Repo");
  runtimeRepoPath = repoPath;
  const repo = registerRepo(repoPath, { name: "example-repo" });
  bindRepo(repo.repo_id);
  const manifest = {
    snapshot_id: "snap-test",
    repo_id: repo.repo_id,
    files: [
      { relative_path: "src/index.ts", file_hash: "h1", byte_count: 10, line_count: 1, language: "typescript", extension: ".ts", sensitive_detected: false, fetchable: true, index_admitted: true },
      { relative_path: "src/ui/Button.tsx", file_hash: "h2", byte_count: 10, line_count: 1, language: "typescript", extension: ".tsx", sensitive_detected: false, fetchable: true, index_admitted: true },
      { relative_path: "README.md", file_hash: "h3", byte_count: 10, line_count: 1, language: "markdown", extension: ".md", sensitive_detected: false, fetchable: true, index_admitted: true },
    ],
    excluded_files: [],
    policy_version: CONFIG.policyVersion,
  } as unknown as Parameters<typeof attachManifest>[1];
  runtimeManifest = manifest;
  requestSnapshot("snap-test", repo.repo_id);
  transitionState("snap-test", "manifest_building");
  transitionState("snap-test", "filtering");
  attachManifest("snap-test", manifest);
  setRuntimeState({
    manifest,
    rootDir: ".",
    repoPath,
    repoName: "example-repo",
    repoDescription: "Example repository for tests.",
    budgetState: createBudgetState(),
    sessionSnapshotId: "snap-test",
  } as Parameters<typeof setRuntimeState>[0]);
});

await describe("Tool Registry", async () => {
  const tools = getToolRegistrations();
  await it("registers exactly nine tools", () => assert.equal(tools.length, 9));
  await it("exposes only ChatGPT-compatible public tool names", () => {
    assert.deepEqual(tools.map((tool) => tool.name), [
      "read_code",
      "api_tool",
      "repo_list",
      "repo_search",
      "repo_files",
      "repo_fetch",
      "repo_tree",
      "repo_symbols",
      "repo_refresh",
    ]);
    assert.equal(tools.some((tool) => tool.name.includes(".")), false);
  });
  await it("registers read_code compatibility wrapper", () => assert.equal(isRegisteredTool("read_code"), true));
  await it("registers api_tool compatibility wrapper", () => assert.equal(isRegisteredTool("api_tool"), true));
  await it("registers repo_list", () => assert.equal(isRegisteredTool("repo_list"), true));
  await it("registers repo_search", () => assert.equal(isRegisteredTool("repo_search"), true));
  await it("registers repo_files", () => assert.equal(isRegisteredTool("repo_files"), true));
  await it("registers repo_fetch", () => assert.equal(isRegisteredTool("repo_fetch"), true));
  await it("registers repo_tree", () => assert.equal(isRegisteredTool("repo_tree"), true));
  await it("registers repo_symbols", () => assert.equal(isRegisteredTool("repo_symbols"), true));
  await it("registers repo_refresh", () => assert.equal(isRegisteredTool("repo_refresh"), true));
  await it("keeps legacy dotted names as server-side aliases", () => {
    assert.equal(isRegisteredTool("read_code/api_tool"), true);
    assert.equal(isRegisteredTool("repo.list"), true);
    assert.equal(isRegisteredTool("repo.search"), true);
    assert.equal(isRegisteredTool("repo.files"), true);
    assert.equal(isRegisteredTool("repo.fetch"), true);
    assert.equal(isRegisteredTool("repo.tree"), true);
    assert.equal(isRegisteredTool("repo.symbols"), true);
    assert.equal(isRegisteredTool("repo.refresh"), true);
  });
  await it("does not register unknown tools", () => {
    assert.equal(isRegisteredTool("repo.write"), false);
    assert.equal(isRegisteredTool("shell.exec"), false);
  });
});

await describe("Tool Annotations", async () => {
  for (const tool of getToolRegistrations()) {
    await it(`${tool.name} is read-only`, () => assert.equal(tool.annotations?.readOnlyHint, true));
    await it(`${tool.name} is non-destructive`, () => assert.equal(tool.annotations?.destructiveHint, false));
    await it(`${tool.name} does not access external world`, () => assert.equal(tool.annotations?.openWorldHint, false));
    await it(`${tool.name} has Zod inputSchema`, () => assert.ok(tool.inputSchema));
    await it(`${tool.name} exposes model-visible ChatGPT metadata`, () => {
      assert.deepEqual((tool._meta.ui as { visibility?: unknown }).visibility, ["model", "app"]);
      assert.equal(tool._meta["openai/visibility"], "public");
      assert.equal(typeof tool._meta["openai/toolInvocation/invoking"], "string");
      assert.equal(typeof tool._meta["openai/toolInvocation/invoked"], "string");
      assert.deepEqual(tool._meta.securitySchemes, [{ type: "noauth" }]);
    });
  }
});

await describe("Tool Dispatch (with runtime)", async () => {
  await it("rejects unknown tool", async () => {
    const r = await handleToolCall("repo.write", { repo_path: "C:\\Example\\Repo", snapshot_id: "snap-test" }, "audit-005");
    assert.equal(isToolError(r), true);
    if (isToolError(r)) assert.equal(r.error_code, "access_denied");
  });

  await it("lists configured repositories with exact repo_path values", async () => {
    const r = await handleToolCall("repo_list", {}, "audit-list");
    assert.equal(isToolError(r), false);
    const data = r as {
      repositories: Array<{ name: string; description: string; repo_path: string; snapshot_id: string; file_count: number; top_dirs: string[]; primary_languages: string[] }>;
      usage_guide: { recommended_next_calls: Array<{ tool: string }>; discovery_notes: string[] };
      isError: boolean;
      error_code: string | null;
      message: string | null;
      next_cursor: string | null;
      retryable: boolean;
    };
    assert.equal(data.repositories.length, 1);
    assert.equal(data.repositories[0]?.name, "example-repo");
    assert.equal(data.repositories[0]?.description, "Example repository for tests.");
    assert.equal(data.repositories[0]?.repo_path, normalizeRepoRootPath("C:\\Example\\Repo"));
    assert.equal(data.repositories[0]?.snapshot_id, "snap-test");
    assert.equal(data.repositories[0]?.file_count, 3);
    assert.deepEqual(data.repositories[0]?.top_dirs, ["src"]);
    assert.ok(data.repositories[0]?.primary_languages.includes("typescript"));
    assert.deepEqual(data.usage_guide.recommended_next_calls.map((call) => call.tool), [
      "repo_list",
      "repo_files",
      "repo_symbols",
      "repo_search",
      "repo_fetch",
      "repo_refresh",
    ]);
    assert.ok(data.usage_guide.discovery_notes.some((note) => note.includes("repo_files")));
    assert.equal(data.isError, false);
    assert.equal(data.error_code, null);
    assert.equal(data.message, null);
    assert.equal(data.next_cursor, null);
    assert.equal(data.retryable, false);
  });

  await it("accepts legacy dotted list calls through the dispatcher", async () => {
    const r = await handleToolCall("repo.list", {}, "audit-legacy-list");
    assert.equal(isToolError(r), false);
    const data = r as { repositories: Array<{ repo_path: string }> };
    assert.equal(data.repositories[0]?.repo_path, normalizeRepoRootPath("C:\\Example\\Repo"));
  });

  await it("accepts legacy read_code api_tool list calls through the dispatcher", async () => {
    const r = await handleToolCall("read_code/api_tool", { operation: "repo_list" }, "audit-legacy-api-list");
    assert.equal(isToolError(r), false);
    const data = r as { repositories: Array<{ repo_path: string }> };
    assert.equal(data.repositories[0]?.repo_path, normalizeRepoRootPath("C:\\Example\\Repo"));
  });

  await it("accepts read_code wrapper list calls through the dispatcher", async () => {
    const r = await handleToolCall("read_code", { operation: "repo_list" }, "audit-read-code-list");
    assert.equal(isToolError(r), false);
    const data = r as { repositories: Array<{ repo_path: string }> };
    assert.equal(data.repositories[0]?.repo_path, normalizeRepoRootPath("C:\\Example\\Repo"));
  });

  await it("returns the first-use guide when read_code is called without arguments", async () => {
    const r = await handleToolCall("read_code", {}, "audit-read-code-guide");
    assert.equal(isToolError(r), false);
    const data = r as { repositories: Array<{ repo_path: string }>; usage_guide: { path_rules: string[]; recommended_next_calls: Array<{ tool: string }> } };
    assert.equal(data.repositories[0]?.repo_path, normalizeRepoRootPath("C:\\Example\\Repo"));
    assert.ok(data.usage_guide.path_rules.some((rule) => rule.includes("repo_path")));
    assert.equal(data.usage_guide.recommended_next_calls[0]?.tool, "repo_list");
    assert.equal(data.usage_guide.recommended_next_calls[1]?.tool, "repo_files");
  });

  await it("returns the first-use guide when api_tool is called without arguments", async () => {
    const r = await handleToolCall("api_tool", {}, "audit-api-tool-guide");
    assert.equal(isToolError(r), false);
    const data = r as { repositories: Array<{ repo_path: string }>; usage_guide: { compatibility_names: string[] } };
    assert.equal(data.repositories[0]?.repo_path, normalizeRepoRootPath("C:\\Example\\Repo"));
    assert.deepEqual(data.usage_guide.compatibility_names, ["read_code", "api_tool"]);
  });

  await it("keeps explicit read_code repo_files routing after adding the first-use guide", async () => {
    const r = await handleToolCall("read_code", {
      operation: "repo_files",
      arguments: { repo_path: "C:\\Example\\Repo", prefix: "src", limit: 1 },
    }, "audit-read-code-files");
    assert.equal(isToolError(r), false);
    const data = r as { items: Array<{ path: string }>; usage_guide?: unknown };
    assert.equal(data.items[0]?.path, "src/index.ts");
    assert.equal("usage_guide" in data, false);
  });

  await it("uses the only configured repository when repo_path is omitted", async () => {
    const r = await handleToolCall("repo_tree", { path: ".", depth: 1, limit: 5 }, "audit-default-context");
    assert.equal(isToolError(r), false);
    assert.equal((r as Record<string, unknown>).repo_path, normalizeRepoRootPath("C:\\Example\\Repo"));
    assert.equal((r as Record<string, unknown>).snapshot_id, "snap-test");
  });

  await it("dispatches repo_files and returns the selected repository file map", async () => {
    const r = await handleToolCall("repo_files", { repo_path: "C:\\Example\\Repo", prefix: "src", limit: 2 }, "audit-files");
    assert.equal(isToolError(r), false);
    const data = r as { items: Array<{ path: string; fetchable: boolean; indexed: boolean; state: string }>; has_more: boolean };
    assert.deepEqual(data.items.map((item) => item.path), ["src/index.ts", "src/ui/Button.tsx"]);
    assert.ok(data.items.every((item) => item.fetchable === true && item.indexed === false && item.state === "fetchable_unindexed"));
    assert.equal(data.has_more, false);
  });

  await it("accepts legacy dotted repo.files calls through the dispatcher", async () => {
    const r = await handleToolCall("repo.files", { repo_path: "C:\\Example\\Repo", prefix: "src", limit: 1 }, "audit-legacy-files");
    assert.equal(isToolError(r), false);
    const data = r as { items: Array<{ path: string }>; has_more: boolean };
    assert.equal(data.items[0]?.path, "src/index.ts");
    assert.equal(data.has_more, true);
  });

  await it("accepts api_tool file map calls with nested arguments", async () => {
    const r = await handleToolCall("api_tool", {
      action: "files",
      arguments: { repo_path: "C:\\Example\\Repo", prefix: "src", limit: 1 },
    }, "audit-api-files");
    assert.equal(isToolError(r), false);
    const data = r as { items: Array<{ path: string }>; has_more: boolean };
    assert.equal(data.items[0]?.path, "src/index.ts");
    assert.equal(data.has_more, true);
  });

  await it("requires repo_path when multiple repositories are configured", async () => {
    const otherRepoPath = normalizeRepoRootPath("C:\\Example\\Other");
    const otherRepo = registerRepo(otherRepoPath, { name: "other-repo" });
    bindRepo(otherRepo.repo_id);
    const otherManifest = {
      snapshot_id: "snap-other",
      repo_id: otherRepo.repo_id,
      files: [],
      excluded_files: [],
      policy_version: CONFIG.policyVersion,
    } as unknown as Parameters<typeof attachManifest>[1];
    requestSnapshot("snap-other", otherRepo.repo_id);
    transitionState("snap-other", "manifest_building");
    transitionState("snap-other", "filtering");
    attachManifest("snap-other", otherManifest);
    setRuntimeStates([
      {
        manifest: runtimeManifest,
        rootDir: ".",
        repoPath: runtimeRepoPath,
        repoName: "example-repo",
        repoDescription: "Example repository for tests.",
        budgetState: createBudgetState(),
        sessionSnapshotId: "snap-test",
      } as Parameters<typeof setRuntimeStates>[0][number],
      {
        manifest: otherManifest,
        rootDir: ".",
        repoPath: otherRepoPath,
        repoName: "other-repo",
        budgetState: createBudgetState(),
        sessionSnapshotId: "snap-other",
      } as Parameters<typeof setRuntimeStates>[0][number],
    ]);

    const r = await handleToolCall("repo_tree", { path: ".", depth: 1, limit: 5 }, "audit-default-context");
    assert.equal(isToolError(r), true);
    if (isToolError(r)) {
      assert.equal(r.error_code, "access_denied");
      assert.match(r.message, /multiple repositories/);
      assert.equal("repo_id" in r, false);
      assert.equal(r.repo_path, "unknown");
    }
  });

  await it("does not expose repo_id on unknown tool errors", async () => {
    const r = await handleToolCall("repo.write", {}, "audit-unknown-no-path");
    assert.equal(isToolError(r), true);
    if (isToolError(r)) assert.equal("repo_id" in r, false);
  });

  await it("uses repo_path to select the initialized runtime context", async () => {
    const r = await handleToolCall("repo_tree", { repo_path: "C:/Example/Repo/", path: ".", depth: 1, limit: 5 }, "audit-repo-path");
    assert.equal(isToolError(r), false);
    assert.equal((r as Record<string, unknown>).repo_path, normalizeRepoRootPath("C:\\Example\\Repo"));
    assert.equal((r as Record<string, unknown>).snapshot_id, "snap-test");
  });

  await it("rejects repo_path outside the configured whitelist", async () => {
    const r = await handleToolCall("repo_tree", { repo_path: "C:\\Other\\Repo", snapshot_id: "snap-test", path: "." }, "audit-repo-mismatch");
    assert.equal(isToolError(r), true);
    if (isToolError(r)) {
      assert.equal(r.error_code, "access_denied");
    }
  });

  await it("rejects snapshot mismatch across tools", async () => {
    const r = await handleToolCall("repo_search", { repo_path: "C:\\Example\\Repo", snapshot_id: "snap-other", query: "test" }, "audit-006");
    assert.equal(isToolError(r), true);
  });
});

await describe("MCP response size behavior", async () => {
  await it("keeps full tool data in structuredContent and short summary in content", async () => {
    const { server, url } = await startServer(0);
    const client = new Client({ name: "server-smoke-test", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(url));

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      const toolsByName = new Map(tools.tools.map((tool) => [tool.name, tool]));
      assert.equal(tools.tools.length, 9);
      assert.equal(toolsByName.has("read_code"), true);
      assert.equal(toolsByName.has("api_tool"), true);
      assert.equal(tools.tools.some((tool) => tool.name.includes(".")), false);
      for (const tool of tools.tools) {
        assert.deepEqual((tool._meta?.ui as { visibility?: unknown } | undefined)?.visibility, ["model", "app"]);
        assert.equal(tool._meta?.["openai/visibility"], "public");
        assert.equal(typeof tool._meta?.["openai/toolInvocation/invoking"], "string");
        assert.equal(typeof tool._meta?.["openai/toolInvocation/invoked"], "string");
        assert.deepEqual(tool._meta?.securitySchemes, [{ type: "noauth" }]);
      }
      for (const name of ["read_code", "api_tool", "repo_search", "repo_files", "repo_fetch", "repo_tree", "repo_symbols", "repo_refresh"]) {
        const required = ((toolsByName.get(name)?.inputSchema as { required?: unknown[] } | undefined)?.required ?? []) as unknown[];
        assert.equal(required.includes("repo_path"), false);
      }

      const result = await client.callTool({ name: "repo_list", arguments: {} });
      assert.equal(result.isError, undefined);
      assert.ok(result.structuredContent);
      const text = result.content[0]?.type === "text" ? result.content[0].text : "";
      const summary = JSON.parse(text) as { tool?: string; repositories?: number };
      assert.equal(summary.tool, "repo_list");
      assert.equal(summary.repositories, 1);
      assert.notEqual(text, JSON.stringify(result.structuredContent));
      assert.ok(Array.isArray((result.structuredContent as { repositories?: unknown }).repositories));

      const tree = await client.callTool({ name: "repo_tree", arguments: { path: ".", depth: 1, limit: 5 } });
      assert.equal(tree.isError, undefined);
      assert.ok(Array.isArray((tree.structuredContent as { entries?: unknown }).entries));

      const files = await client.callTool({ name: "repo_files", arguments: { prefix: "src", limit: 1 } });
      assert.equal(files.isError, undefined);
      assert.ok(Array.isArray((files.structuredContent as { items?: unknown }).items));
      const filesText = files.content[0]?.type === "text" ? files.content[0].text : "";
      const filesSummary = JSON.parse(filesText) as { tool?: string; items?: number; has_more?: boolean };
      assert.equal(filesSummary.tool, "repo_files");
      assert.equal(filesSummary.items, 1);
      assert.equal(filesSummary.has_more, true);

      const apiTool = await client.callTool({ name: "api_tool", arguments: { operation: "repo_list" } });
      assert.equal(apiTool.isError, undefined);
      assert.ok(Array.isArray((apiTool.structuredContent as { repositories?: unknown }).repositories));

      const readCode = await client.callTool({ name: "read_code", arguments: { operation: "repo_list" } });
      assert.equal(readCode.isError, undefined);
      assert.ok(Array.isArray((readCode.structuredContent as { repositories?: unknown }).repositories));
    } finally {
      await client.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  await it("marks repo_path required in MCP schema when multiple repositories are configured", async () => {
    const otherRepoPath = normalizeRepoRootPath("C:\\Example\\Other");
    const otherRepo = registerRepo(otherRepoPath, { name: "other-repo" });
    bindRepo(otherRepo.repo_id);
    const otherManifest = {
      snapshot_id: "snap-other",
      repo_id: otherRepo.repo_id,
      files: [],
      excluded_files: [],
      policy_version: CONFIG.policyVersion,
    } as unknown as Parameters<typeof attachManifest>[1];
    requestSnapshot("snap-other", otherRepo.repo_id);
    transitionState("snap-other", "manifest_building");
    transitionState("snap-other", "filtering");
    attachManifest("snap-other", otherManifest);
    setRuntimeStates([
      {
        manifest: runtimeManifest,
        rootDir: ".",
        repoPath: runtimeRepoPath,
        repoName: "example-repo",
        repoDescription: "Example repository for tests.",
        budgetState: createBudgetState(),
        sessionSnapshotId: "snap-test",
      } as Parameters<typeof setRuntimeStates>[0][number],
      {
        manifest: otherManifest,
        rootDir: ".",
        repoPath: otherRepoPath,
        repoName: "other-repo",
        budgetState: createBudgetState(),
        sessionSnapshotId: "snap-other",
      } as Parameters<typeof setRuntimeStates>[0][number],
    ]);

    const { server, url } = await startServer(0);
    const client = new Client({ name: "server-smoke-test", version: "0.0.0" });
    const transport = new StreamableHTTPClientTransport(new URL(url));

    try {
      await client.connect(transport);
      const tools = await client.listTools();
      const toolsByName = new Map(tools.tools.map((tool) => [tool.name, tool]));
      const readCodeRequired = ((toolsByName.get("read_code")?.inputSchema as { required?: unknown[] } | undefined)?.required ?? []) as unknown[];
      assert.equal(readCodeRequired.includes("repo_path"), false);

      const apiToolRequired = ((toolsByName.get("api_tool")?.inputSchema as { required?: unknown[] } | undefined)?.required ?? []) as unknown[];
      assert.equal(apiToolRequired.includes("repo_path"), false);

      const listRequired = ((toolsByName.get("repo_list")?.inputSchema as { required?: unknown[] } | undefined)?.required ?? []) as unknown[];
      assert.equal(listRequired.includes("repo_path"), false);

      for (const name of ["repo_search", "repo_files", "repo_fetch", "repo_tree", "repo_symbols", "repo_refresh"]) {
        const required = ((toolsByName.get(name)?.inputSchema as { required?: unknown[] } | undefined)?.required ?? []) as unknown[];
        assert.equal(required.includes("repo_path"), true);
      }
    } finally {
      await client.close();
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});

await describe("Config", async () => {
  await it("has policy version", () => assert.ok(CONFIG.policyVersion));
  await it("has content origin markers", () => {
    assert.equal(CONFIG.contentOrigin, "repository_snapshot");
    assert.equal(CONFIG.instructionTrust, "untrusted");
  });
  await it("has disabled byte, count, depth, and throttle limits", () => {
    assert.equal(CONFIG.budget.singleResponseMaxBytes, null);
    assert.equal(CONFIG.budget.singleFileLineWindowMax, null);
    assert.equal(CONFIG.budget.throttleMaxCalls, null);
    assert.equal(CONFIG.budget.sessionTotalBytes, null);
    assert.equal(CONFIG.budget.grantTotalBytes, null);
    assert.equal(CONFIG.budget.treeMaxDepth, null);
    assert.equal(CONFIG.budget.searchHitMax, null);
    assert.equal(CONFIG.budget.symbolHitMax, null);
  });
});

async function fetchJson(url: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const res = await fetch(url);
  const body = await res.json() as Record<string, unknown>;
  return { status: res.status, body };
}

await describe("HTTP discovery routing", async () => {
  await it("serves connector metadata without entering MCP transport", async () => {
    const { server, url } = await startServer(0);
    try {
      const base = new URL(url).origin;
      const first = await fetchJson(`${base}/connector-meta`);
      const second = await fetchJson(`${base}/connector-meta`);

      assert.equal(first.status, 200);
      assert.equal(second.status, 200);
      assert.equal(first.body.name, CONFIG.server.name);
      assert.equal(second.body.mode, "dev_local");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  await it("serves protected resource metadata", async () => {
    const { server, url } = await startServer(0);
    try {
      const base = new URL(url).origin;
      const { status, body } = await fetchJson(`${base}/.well-known/oauth-protected-resource`);

      assert.equal(status, 200);
      assert.equal(body.resource, `${base}/mcp`);
      assert.deepEqual(body.authorization_servers, []);
      assert.equal(body.oauth2_status, "blocked");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  await it("serves protected resource metadata for the /mcp resource path", async () => {
    const { server, url } = await startServer(0);
    try {
      const base = new URL(url).origin;
      const { status, body } = await fetchJson(`${base}/.well-known/oauth-protected-resource/mcp`);

      assert.equal(status, 200);
      assert.equal(body.resource, `${base}/mcp`);
      assert.deepEqual(body.authorization_servers, []);
      assert.equal(body.oauth2_status, "blocked");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  await it("returns explicit unavailable metadata for OAuth server discovery", async () => {
    const { server, url } = await startServer(0);
    try {
      const base = new URL(url).origin;
      const oauth = await fetchJson(`${base}/.well-known/oauth-authorization-server`);
      const oidc = await fetchJson(`${base}/.well-known/openid-configuration`);

      assert.equal(oauth.status, 501);
      assert.equal(oidc.status, 501);
      assert.equal(oauth.body.error, "oauth_authorization_server_unavailable");
      assert.equal(oidc.body.oauth2_status, "blocked");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  await it("returns 404 for unknown paths instead of MCP transport errors", async () => {
    const { server, url } = await startServer(0);
    try {
      const base = new URL(url).origin;
      const { status, body } = await fetchJson(`${base}/unknown`);

      assert.equal(status, 404);
      assert.equal(body.error, "not_found");
      assert.equal(body.mcp_endpoint, "/mcp");
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  await it("handles consecutive MCP POST requests without reusing a connected transport", async () => {
    const { server, url } = await startServer(0);
    const body = {
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "server-smoke-test", version: "0.0.0" },
      },
      id: 1,
    };

    try {
      for (let i = 0; i < 2; i++) {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Accept: "application/json, text/event-stream",
          },
          body: JSON.stringify(body),
        });
        const text = await res.text();

        assert.equal(res.status, 200);
        assert.ok(text.includes(CONFIG.server.name));
        assert.equal(text.includes("Already connected to a transport"), false);
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  await it("normalizes incomplete MCP Accept headers before SDK transport handling", async () => {
    const { server, url } = await startServer(0);
    const body = {
      jsonrpc: "2.0",
      method: "initialize",
      params: {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "server-smoke-test", version: "0.0.0" },
      },
      id: 1,
    };
    const cases: Array<{ name: string; headers: Record<string, string> }> = [
      { name: "missing accept", headers: { "Content-Type": "application/json" } },
      { name: "json only", headers: { "Content-Type": "application/json", Accept: "application/json" } },
      { name: "event stream only", headers: { "Content-Type": "application/json", Accept: "text/event-stream" } },
      { name: "wildcard", headers: { "Content-Type": "application/json", Accept: "*/*" } },
    ];

    try {
      for (const item of cases) {
        const res = await fetch(url, {
          method: "POST",
          headers: item.headers,
          body: JSON.stringify(body),
        });
        const text = await res.text();

        assert.equal(res.status, 200, `${item.name}: ${text}`);
        assert.ok(text.includes(CONFIG.server.name), item.name);
        assert.equal(text.includes("Not Acceptable"), false, item.name);
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
