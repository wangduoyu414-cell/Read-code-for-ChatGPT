/**
 * Server smoke tests — verify tool registration, annotations, and scaffold.
 * Updated for post-audit wiring.
 */

import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { getToolRegistrations, isRegisteredTool, handleToolCall, setRuntimeState, getRuntimeState } from "../src/tools/registry.js";
import { isToolError } from "../src/errors.js";
import { CONFIG } from "../src/config.js";
import { createBudgetState } from "../src/security/budget.js";
import { startServer } from "../src/server.js";
import { requestSnapshot, transitionState, attachManifest, clearRegistry } from "../src/snapshot/snapshot-registry.js";

beforeEach(() => {
  clearRegistry();
  const manifest = {
    snapshot_id: "snap-test",
    repo_id: "r1",
    files: [],
    excluded_files: [],
    policy_version: CONFIG.policyVersion,
  } as unknown as Parameters<typeof attachManifest>[1];
  requestSnapshot("snap-test", "r1");
  transitionState("snap-test", "manifest_building");
  transitionState("snap-test", "filtering");
  attachManifest("snap-test", manifest);
  setRuntimeState({
    manifest,
    rootDir: ".",
    budgetState: createBudgetState(),
    sessionSnapshotId: "snap-test",
  } as Parameters<typeof setRuntimeState>[0]);
});

await describe("Tool Registry", async () => {
  const tools = getToolRegistrations();
  await it("registers exactly four tools", () => assert.equal(tools.length, 4));
  await it("registers repo.search", () => assert.equal(isRegisteredTool("repo.search"), true));
  await it("registers repo.fetch", () => assert.equal(isRegisteredTool("repo.fetch"), true));
  await it("registers repo.tree", () => assert.equal(isRegisteredTool("repo.tree"), true));
  await it("registers repo.symbols", () => assert.equal(isRegisteredTool("repo.symbols"), true));
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
    const r = await handleToolCall("repo.write", { repo_id: "r1", snapshot_id: "snap-test" }, "audit-005");
    assert.equal(isToolError(r), true);
    if (isToolError(r)) assert.equal(r.error_code, "access_denied");
  });

  await it("defaults missing repo_id and snapshot_id to the initialized runtime context", async () => {
    const r = await handleToolCall("repo.tree", { path: ".", depth: 1, limit: 5 }, "audit-default-context");
    assert.equal(isToolError(r), false);
    assert.equal((r as Record<string, unknown>).repo_id, "r1");
    assert.equal((r as Record<string, unknown>).snapshot_id, "snap-test");
  });

  await it("rejects explicit repo_id mismatch", async () => {
    const r = await handleToolCall("repo.tree", { repo_id: "other", snapshot_id: "snap-test", path: "." }, "audit-repo-mismatch");
    assert.equal(isToolError(r), true);
    if (isToolError(r)) {
      assert.equal(r.error_code, "access_denied");
      assert.equal(r.repo_id, "other");
    }
  });

  await it("rejects snapshot mismatch across tools", async () => {
    const r = await handleToolCall("repo.search", { repo_id: "r1", snapshot_id: "snap-other", query: "test" }, "audit-006");
    assert.equal(isToolError(r), true);
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
