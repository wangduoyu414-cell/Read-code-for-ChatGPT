import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { registerRepo, bindRepo, clearCatalog } from "../src/repo/repo-catalog.js";
import { createBudgetState } from "../src/security/budget.js";
import { runIndexer } from "../src/indexer/indexer.js";
import { clearTextIndex } from "../src/indexer/text-index.js";
import { clearSymbolIndex } from "../src/indexer/symbol-index.js";
import { ingestDirectory } from "../src/snapshot/snapshot-ingest.js";
import { attachManifest, clearRegistry, requestSnapshot, transitionState } from "../src/snapshot/snapshot-registry.js";
import { getRuntimeState, handleToolCall, setRuntimeState } from "../src/tools/registry.js";
import { isToolError } from "../src/errors.js";

function makeTempRepo(): string {
  return mkdtempSync(join(tmpdir(), "refresh-tool-"));
}

function initializeRuntime(rootDir: string) {
  clearCatalog();
  clearRegistry();
  clearTextIndex();
  clearSymbolIndex();

  const repo = registerRepo(rootDir);
  bindRepo(repo.repo_id);

  const snapId = `snap-initial-${randomUUID().slice(0, 8)}`;
  requestSnapshot(snapId, repo.repo_id);
  transitionState(snapId, "manifest_building");
  transitionState(snapId, "filtering");

  const { manifest } = ingestDirectory(rootDir, repo.repo_id, snapId);
  attachManifest(snapId, manifest);
  const indexResult = runIndexer(manifest, rootDir);
  assert.equal(indexResult.success, true);

  const budgetState = createBudgetState();
  setRuntimeState({
    manifest,
    rootDir,
    budgetState,
    sessionSnapshotId: snapId,
  });

  return { repoId: repo.repo_id, snapId, budgetState };
}

await describe("repo.refresh", async () => {
  await it("refreshes the manifest and index without resetting budget state", async () => {
    const root = makeTempRepo();
    try {
      writeFileSync(join(root, "existing.ts"), "export const existing = 'old-marker';\n");
      const { snapId } = initializeRuntime(root);
      const stateBefore = getRuntimeState();
      assert.ok(stateBefore);
      const budgetBefore = stateBefore.budgetState;

      writeFileSync(join(root, "new.local"), "fresh-marker=true\n");

      const beforeRefresh = await handleToolCall("repo.search", { query: "fresh-marker", limit: 10 }, "audit-before-refresh");
      assert.equal(isToolError(beforeRefresh), false);
      assert.equal((beforeRefresh as { hits: unknown[] }).hits.length, 0);

      const refresh = await handleToolCall("repo.refresh", { reason: "test" }, "audit-refresh");
      assert.equal(isToolError(refresh), false);
      const refreshData = refresh as { snapshot_id: string; previous_snapshot_id: string; refreshed: boolean; files: number };
      assert.equal(refreshData.previous_snapshot_id, snapId);
      assert.notEqual(refreshData.snapshot_id, snapId);
      assert.equal(refreshData.refreshed, true);
      assert.equal(refreshData.files, 2);

      const stateAfter = getRuntimeState();
      assert.ok(stateAfter);
      assert.equal(stateAfter.sessionSnapshotId, refreshData.snapshot_id);
      assert.equal(stateAfter.budgetState, budgetBefore);
      assert.ok(stateAfter.budgetState.toolCallCount >= 2);

      const afterRefresh = await handleToolCall("repo.search", { query: "fresh-marker", limit: 10 }, "audit-after-refresh");
      assert.equal(isToolError(afterRefresh), false);
      const hits = (afterRefresh as { hits: Array<{ path: string; snapshot_id: string }> }).hits;
      assert.equal(hits.length, 1);
      assert.equal(hits[0]?.path, "new.local");
      assert.equal(hits[0]?.snapshot_id, refreshData.snapshot_id);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  await it("keeps the previous runtime state when the authorized root is unavailable", async () => {
    const root = makeTempRepo();
    try {
      writeFileSync(join(root, "existing.ts"), "export const existing = 'old-marker';\n");
      const { snapId } = initializeRuntime(root);
      const stateBefore = getRuntimeState();
      assert.ok(stateBefore);

      rmSync(root, { recursive: true, force: true });

      const refresh = await handleToolCall("repo.refresh", {}, "audit-refresh-missing-root");
      assert.equal(isToolError(refresh), true);
      if (isToolError(refresh)) {
        assert.equal(refresh.error_code, "internal_error");
        assert.equal(refresh.snapshot_id, snapId);
      }

      const stateAfter = getRuntimeState();
      assert.ok(stateAfter);
      assert.equal(stateAfter.sessionSnapshotId, snapId);
      assert.equal(stateAfter.manifest, stateBefore.manifest);
      assert.equal(stateAfter.budgetState, stateBefore.budgetState);

      const search = await handleToolCall("repo.search", { query: "old-marker", limit: 10 }, "audit-search-after-failed-refresh");
      assert.equal(isToolError(search), false);
      assert.equal((search as { hits: unknown[] }).hits.length, 1);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
