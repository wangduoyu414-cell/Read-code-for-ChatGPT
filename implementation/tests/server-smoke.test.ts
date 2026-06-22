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
      { relative_path: "src/index.ts", file_hash: "h1", byte_count: 10, line_count: 1, language: "typescript", extension: ".ts", sensitive_detected: false, index_admitted: true },
      { relative_path: "src/ui/Button.tsx", file_hash: "h2", byte_count: 10, line_count: 1, language: "typescript", extension: ".tsx", sensitive_detected: false, index_admitted: true },
      { relative_path: "README.md", file_hash: "h3", byte_count: 10, line_count: 1, language: "markdown", extension: ".md", sensitive_detected: false, index_admitted: true },
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
  await it("registers exactly six tools", () => assert.equal(tools.length, 6));
  await it("registers repo.list", () => assert.equal(isRegisteredTool("repo.list"), true));
  await it("registers repo.search", () => assert.equal(isRegisteredTool("repo.search"), true));
  await it("registers repo.fetch", () => assert.equal(isRegisteredTool("repo.fetch"), true));
  await it("registers repo.tree", () => assert.equal(isRegisteredTool("repo.tree"), true));
  await it("registers repo.symbols", () => assert.equal(isRegisteredTool("repo.symbols"), true));
  await it("registers repo.refresh", () => assert.equal(isRegisteredTool("repo.refresh"), true));
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
  }
});

await describe("Tool Dispatch (with runtime)", async () => {
  await it("rejects unknown tool", async () => {
    const r = await handleToolCall("repo.write", { repo_path: "C:\\Example\\Repo", snapshot_id: "snap-test" }, "audit-005");
    assert.equal(isToolError(r), true);
    if (isToolError(r)) assert.equal(r.error_code, "access_denied");
  });

  await it("lists configured repositories with exact repo_path values", async () => {
    const r = await handleToolCall("repo.list", {}, "audit-list");
    assert.equal(isToolError(r), false);
    const data = r as { repositories: Array<{ name: string; description: string; repo_path: string; snapshot_id: string; file_count: number; top_dirs: string[]; primary_languages: string[] }> };
    assert.equal(data.repositories.length, 1);
    assert.equal(data.repositories[0]?.name, "example-repo");
    assert.equal(data.repositories[0]?.description, "Example repository for tests.");
    assert.equal(data.repositories[0]?.repo_path, normalizeRepoRootPath("C:\\Example\\Repo"));
    assert.equal(data.repositories[0]?.snapshot_id, "snap-test");
    assert.equal(data.repositories[0]?.file_count, 3);
    assert.deepEqual(data.repositories[0]?.top_dirs, ["src"]);
    assert.ok(data.repositories[0]?.primary_languages.includes("typescript"));
  });

  await it("uses the only configured repository when repo_path is omitted", async () => {
    const r = await handleToolCall("repo.tree", { path: ".", depth: 1, limit: 5 }, "audit-default-context");
    assert.equal(isToolError(r), false);
    assert.equal((r as Record<string, unknown>).repo_path, normalizeRepoRootPath("C:\\Example\\Repo"));
    assert.equal((r as Record<string, unknown>).snapshot_id, "snap-test");
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

    const r = await handleToolCall("repo.tree", { path: ".", depth: 1, limit: 5 }, "audit-default-context");
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
    const r = await handleToolCall("repo.tree", { repo_path: "C:/Example/Repo/", path: ".", depth: 1, limit: 5 }, "audit-repo-path");
    assert.equal(isToolError(r), false);
    assert.equal((r as Record<string, unknown>).repo_path, normalizeRepoRootPath("C:\\Example\\Repo"));
    assert.equal((r as Record<string, unknown>).snapshot_id, "snap-test");
  });

  await it("rejects repo_path outside the configured whitelist", async () => {
    const r = await handleToolCall("repo.tree", { repo_path: "C:\\Other\\Repo", snapshot_id: "snap-test", path: "." }, "audit-repo-mismatch");
    assert.equal(isToolError(r), true);
    if (isToolError(r)) {
      assert.equal(r.error_code, "access_denied");
    }
  });

  await it("rejects snapshot mismatch across tools", async () => {
    const r = await handleToolCall("repo.search", { repo_path: "C:\\Example\\Repo", snapshot_id: "snap-other", query: "test" }, "audit-006");
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
      assert.equal(tools.tools.length, 6);
      for (const name of ["repo.search", "repo.fetch", "repo.tree", "repo.symbols", "repo.refresh"]) {
        const required = ((toolsByName.get(name)?.inputSchema as { required?: unknown[] } | undefined)?.required ?? []) as unknown[];
        assert.equal(required.includes("repo_path"), false);
      }

      const result = await client.callTool({ name: "repo.list", arguments: {} });
      assert.equal(result.isError, undefined);
      assert.ok(result.structuredContent);
      const text = result.content[0]?.type === "text" ? result.content[0].text : "";
      const summary = JSON.parse(text) as { tool?: string; repositories?: number };
      assert.equal(summary.tool, "repo.list");
      assert.equal(summary.repositories, 1);
      assert.notEqual(text, JSON.stringify(result.structuredContent));
      assert.ok(Array.isArray((result.structuredContent as { repositories?: unknown }).repositories));

      const tree = await client.callTool({ name: "repo.tree", arguments: { path: ".", depth: 1, limit: 5 } });
      assert.equal(tree.isError, undefined);
      assert.ok(Array.isArray((tree.structuredContent as { entries?: unknown }).entries));
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
      const listRequired = ((toolsByName.get("repo.list")?.inputSchema as { required?: unknown[] } | undefined)?.required ?? []) as unknown[];
      assert.equal(listRequired.includes("repo_path"), false);

      for (const name of ["repo.search", "repo.fetch", "repo.tree", "repo.symbols", "repo.refresh"]) {
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
  await it("has budget limits", () => {
    assert.ok(CONFIG.budget.singleResponseMaxBytes > 0);
    assert.ok(CONFIG.budget.sessionTotalBytes > 0);
    assert.ok(CONFIG.budget.grantTotalBytes > 0);
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
});
