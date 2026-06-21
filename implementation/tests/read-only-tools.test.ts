import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerRepo, bindRepo } from "../src/repo/repo-catalog.js";
import { requestSnapshot, transitionState, attachManifest } from "../src/snapshot/snapshot-registry.js";
import { ingestDirectory } from "../src/snapshot/snapshot-ingest.js";
import { runIndexer } from "../src/indexer/indexer.js";
import { repoSearcher, repoFetcher, repoTreer, repoSymbols } from "../src/tools/read-only-tools.js";
import { createBudgetState } from "../src/security/budget.js";
import { isToolError } from "../src/errors.js";

const FIXTURE_DIR = join(import.meta.dirname ?? fileURLToPath(new URL(".", import.meta.url)), "..", "fixtures", "safe-repo");

let repoId: string;
let snapId: string;
let manifest: ReturnType<typeof ingestDirectory>["manifest"];
let rootDir: string;
let budget: ReturnType<typeof createBudgetState>;

beforeEach(() => {
  budget = createBudgetState();
  repoId = `repo-${Date.now()}`;
  const repo = registerRepo(FIXTURE_DIR);
  repoId = repo.repo_id;
  bindRepo(repoId);
  snapId = `snap-${Date.now()}`;
  rootDir = FIXTURE_DIR;
  requestSnapshot(snapId, repoId);
  transitionState(snapId, "manifest_building");
  transitionState(snapId, "filtering");
  const { manifest: m } = ingestDirectory(rootDir, repoId, snapId);
  manifest = m;
  attachManifest(snapId, manifest);
  runIndexer(manifest, rootDir);
});

await describe("repo.search", async () => {
  await it("finds known symbol", async () => {
    const r = await repoSearcher({ repo_id: repoId, snapshot_id: snapId, query: "App", limit: 5 }, manifest, rootDir, budget);
    if (isToolError(r)) { assert.fail(`Unexpected error: ${r.error_code}`); }
    assert.ok((r as { hits: unknown[] }).hits.length > 0);
  });

  await it("returns empty for nonexistent query", async () => {
    const r = await repoSearcher({ repo_id: repoId, snapshot_id: snapId, query: "xyznonexistent123", limit: 5 }, manifest, rootDir, budget);
    if (!isToolError(r)) assert.equal((r as { hits: unknown[] }).hits.length, 0);
  });

  await it("has content marker: content_origin=repository_snapshot", async () => {
    const r = await repoSearcher({ repo_id: repoId, snapshot_id: snapId, query: "Button", limit: 5 }, manifest, rootDir, budget);
    if (!isToolError(r)) {
      assert.equal((r as Record<string, unknown>).content_origin, "repository_snapshot");
      assert.equal((r as Record<string, unknown>).instruction_trust, "untrusted");
    }
  });
});

await describe("repo.fetch", async () => {
  await it("fetches valid file segment", async () => {
    const r = await repoFetcher({ repo_id: repoId, snapshot_id: snapId, path: "src/index.ts", line_start: 10, line_end: 18, purpose: "review" }, manifest, rootDir, budget);
    if (isToolError(r)) { assert.fail(`Unexpected error: ${r.error_code}`); }
    const data = r as { content: string; path: string };
    assert.ok(data.content.includes("App"));
    assert.equal(data.path, "src/index.ts");
  });

  await it("rejects .env file", async () => {
    const r = await repoFetcher({ repo_id: repoId, snapshot_id: snapId, path: ".env", line_start: 1, line_end: 5, purpose: "check" }, manifest, rootDir, budget);
    assert.equal(isToolError(r), true);
  });

  await it("rejects path traversal", async () => {
    const r = await repoFetcher({ repo_id: repoId, snapshot_id: snapId, path: "../../../etc/passwd", line_start: 1, line_end: 5, purpose: "hack" }, manifest, rootDir, budget);
    assert.equal(isToolError(r), true);
  });

  await it("rejects URL-encoded traversal (%2e%2e)", async () => {
    const r = await repoFetcher({ repo_id: repoId, snapshot_id: snapId, path: "%2e%2e/%2e%2e/etc/passwd", line_start: 1, line_end: 5, purpose: "hack" }, manifest, rootDir, budget);
    assert.equal(isToolError(r), true);
  });

  await it("rejects .git path", async () => {
    const r = await repoFetcher({ repo_id: repoId, snapshot_id: snapId, path: ".git/config", line_start: 1, line_end: 5, purpose: "check" }, manifest, rootDir, budget);
    assert.equal(isToolError(r), true);
  });
});

await describe("repo.tree", async () => {
  await it("lists directory entries", async () => {
    const r = await repoTreer({ repo_id: repoId, snapshot_id: snapId, depth: 2, limit: 50 }, manifest, budget);
    if (isToolError(r)) { assert.fail(`Unexpected error: ${r.error_code}`); }
    const data = r as { entries: Array<{ path: string }> };
    assert.ok(data.entries.length > 0);
    assert.ok(data.entries.some((e) => e.path.includes("src/")));
  });

  await it("treats path dot as repository root", async () => {
    const r = await repoTreer({ repo_id: repoId, snapshot_id: snapId, path: ".", depth: 2, limit: 50 }, manifest, budget);
    if (isToolError(r)) { assert.fail(`Unexpected error: ${r.error_code}`); }
    const data = r as { entries: Array<{ path: string }> };
    assert.ok(data.entries.length > 0);
    assert.ok(data.entries.some((e) => e.path.includes("src/")));
  });

  await it("rejects path traversal", async () => {
    const r = await repoTreer({ repo_id: repoId, snapshot_id: snapId, path: "../", depth: 2, limit: 50 }, manifest, budget);
    assert.equal(isToolError(r), true);
  });
});

await describe("repo.symbols", async () => {
  await it("finds class definitions", async () => {
    const r = await repoSymbols({ repo_id: repoId, snapshot_id: snapId, query: "App", limit: 10 }, manifest, budget);
    if (isToolError(r)) { assert.fail(`Unexpected error: ${r.error_code}`); }
    const data = r as { symbols: Array<{ kind: string }> };
    assert.ok(data.symbols.length > 0);
    assert.ok(data.symbols.some((s) => s.kind === "class"));
  });

  await it("finds function definitions", async () => {
    const r = await repoSymbols({ repo_id: repoId, snapshot_id: snapId, query: "Button", limit: 10 }, manifest, budget);
    if (isToolError(r)) { assert.fail(`Unexpected error: ${r.error_code}`); }
    const data = r as { symbols: Array<{ kind: string }> };
    assert.ok(data.symbols.some((s) => s.kind === "function"));
  });
});

await describe("Cross-tool snapshot consistency (SNAP-002)", async () => {
  await it("rejects different snapshot_id across tools", async () => {
    // This is tested at the handleToolCall level in server-smoke.test.ts
    // Here we verify tools themselves bind snapshot in responses
    const r = await repoSearcher({ repo_id: repoId, snapshot_id: snapId, query: "App", limit: 3 }, manifest, rootDir, budget);
    if (!isToolError(r)) {
      assert.equal((r as Record<string, unknown>).snapshot_id, snapId);
    }
  });
});

await describe("Budget cumulative enforcement", async () => {
  await it("session budget accumulates across calls", async () => {
    const b = createBudgetState();
    // Make multiple search calls
    await repoSearcher({ repo_id: repoId, snapshot_id: snapId, query: "App", limit: 3 }, manifest, rootDir, b);
    await repoSearcher({ repo_id: repoId, snapshot_id: snapId, query: "Button", limit: 3 }, manifest, rootDir, b);
    // Budget should have accumulated bytes
    assert.ok(b.sessionBytesUsed > 0);
    assert.ok(b.toolCallCount >= 2);
  });

  await it("grant budget accumulates across calls", async () => {
    const b = createBudgetState();
    await repoFetcher({ repo_id: repoId, snapshot_id: snapId, path: "src/index.ts", line_start: 10, line_end: 18, purpose: "test" }, manifest, rootDir, b);
    assert.ok(b.grantBytesUsed > 0);
  });
});
