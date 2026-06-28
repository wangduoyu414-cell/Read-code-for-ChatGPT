import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { ingestDirectory } from "../src/snapshot/snapshot-ingest.js";
import { requestSnapshot, transitionState, attachManifest, isSnapshotReady } from "../src/snapshot/snapshot-registry.js";
import { registerRepo, bindRepo } from "../src/repo/repo-catalog.js";
import { runIndexer } from "../src/indexer/indexer.js";
import { isPathIndexed, indexSkipReason } from "../src/indexer/index-status.js";
import { searchText } from "../src/indexer/text-index.js";
import { searchSymbols } from "../src/indexer/symbol-index.js";

const FIXTURE_DIR = join(import.meta.dirname ?? fileURLToPath(new URL(".", import.meta.url)), "..", "fixtures", "safe-repo");

await describe("Indexer", async () => {
  const repo = registerRepo(FIXTURE_DIR);
  bindRepo(repo.repo_id);
  const snapId = `snap-idx-${Date.now()}`;

  requestSnapshot(snapId, repo.repo_id);
  transitionState(snapId, "manifest_building");
  transitionState(snapId, "filtering");

  const { manifest, warnings } = ingestDirectory(FIXTURE_DIR, repo.repo_id, snapId);

  await it("ingests fixture directory", () => {
    assert.ok(manifest.files.length > 0);
    // .env and .git should be excluded
    const excludedRel = manifest.excluded_files.map((e) => e.relative_path);
    assert.ok(excludedRel.some((p) => p.includes(".env") || p.includes(".git")), "sensitive files excluded");
  });

  await it("no absolute paths in manifest", () => {
    for (const f of manifest.files) {
      assert.equal(f.relative_path.includes("\\"), false);
    }
  });

  attachManifest(snapId, manifest);
  assert.equal(isSnapshotReady(snapId), true);

  const result = runIndexer(manifest, FIXTURE_DIR);

  await it("indexer runs successfully", () => {
    assert.equal(result.success, true);
    assert.ok(result.files_indexed > 0);
  });

  await it("text search finds known content", () => {
    const hits = searchText(snapId, "App", 10);
    assert.ok(hits.length > 0, "should find App");
    assert.ok(hits.some((h) => h.path.includes("index.ts")));
  });

  await it("text search finds Python content", () => {
    const hits = searchText(snapId, "ConfigLoader", 5);
    assert.ok(hits.length > 0, "should find ConfigLoader in Python file");
  });

  await it("text search does not find .env content", () => {
    const hits = searchText(snapId, "DATABASE_URL", 10);
    assert.equal(hits.length, 0, ".env should be excluded");
  });

  await it("symbol index finds TypeScript class", () => {
    const syms = searchSymbols(snapId, "App", undefined, 10);
    assert.ok(syms.length > 0);
    assert.ok(syms.some((s) => s.kind === "class"));
  });

  await it("symbol index finds Python class", () => {
    const syms = searchSymbols(snapId, "ConfigLoader", undefined, 10);
    assert.ok(syms.length > 0);
    assert.ok(syms.some((s) => s.kind === "class"));
  });

  await it("symbol index finds function definitions", () => {
    const syms = searchSymbols(snapId, "createApp", undefined, 10);
    assert.ok(syms.length > 0);
    assert.ok(syms.some((s) => s.kind === "function"));
  });

  await it("records actual indexed paths separately from index eligibility", () => {
    const tempRoot = join(import.meta.dirname ?? fileURLToPath(new URL(".", import.meta.url)), "..", "tmp", `index-limit-${Date.now()}`);
    mkdirSync(tempRoot, { recursive: true });
    try {
      for (let index = 0; index < 3; index += 1) {
        writeFileSync(join(tempRoot, `file-${String(index).padStart(5, "0")}.ts`), `export function marker${index}() { return ${index}; }\n`);
      }

      const repo = registerRepo(tempRoot);
      bindRepo(repo.repo_id);
      const snapId = `snap-limit-${Date.now()}`;
      requestSnapshot(snapId, repo.repo_id);
      transitionState(snapId, "manifest_building");
      transitionState(snapId, "filtering");
      const { manifest } = ingestDirectory(tempRoot, repo.repo_id, snapId);
      attachManifest(snapId, manifest);

      const result = runIndexer(manifest, tempRoot, { maxIndexedFiles: 2 });
      assert.equal(result.success, true);
      assert.equal(result.files_indexed, 2);
      assert.equal(result.files_skipped, 1);
      assert.equal(isPathIndexed(snapId, "file-00001.ts"), true);
      assert.equal(isPathIndexed(snapId, "file-00002.ts"), false);
      assert.equal(indexSkipReason(snapId, "file-00002.ts"), "index_file_limit");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});
