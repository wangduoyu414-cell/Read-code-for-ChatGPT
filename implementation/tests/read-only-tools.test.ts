import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { registerRepo, bindRepo } from "../src/repo/repo-catalog.js";
import { requestSnapshot, transitionState, attachManifest } from "../src/snapshot/snapshot-registry.js";
import { ingestDirectory } from "../src/snapshot/snapshot-ingest.js";
import { runIndexer } from "../src/indexer/indexer.js";
import { repoSearcher, repoFiles, repoFetcher, repoTreer, repoSymbols } from "../src/tools/read-only-tools.js";
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
    const r = await repoSearcher({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, query: "App", limit: 5 }, manifest, rootDir, budget);
    if (isToolError(r)) { assert.fail(`Unexpected error: ${r.error_code}`); }
    assert.ok((r as { hits: unknown[] }).hits.length > 0);
  });

  await it("returns empty for nonexistent query", async () => {
    const r = await repoSearcher({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, query: "xyznonexistent123", limit: 5 }, manifest, rootDir, budget);
    if (!isToolError(r)) assert.equal((r as { hits: unknown[] }).hits.length, 0);
  });

  await it("has content marker: content_origin=repository_snapshot", async () => {
    const r = await repoSearcher({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, query: "Button", limit: 5 }, manifest, rootDir, budget);
    if (!isToolError(r)) {
      assert.equal((r as Record<string, unknown>).content_origin, "repository_snapshot");
      assert.equal((r as Record<string, unknown>).instruction_trust, "untrusted");
    }
  });
});

await describe("repo.files", async () => {
  await it("lists a paginated file map with prefix, suffix, language, and state filters", async () => {
    const first = await repoFiles({
      repo_id: repoId,
      repo_path: rootDir,
      snapshot_id: snapId,
      prefix: "src",
      suffixes: [".ts", ".tsx"],
      languages: ["typescript", "tsx"],
      states: ["indexed"],
      limit: 1,
    }, manifest, budget);
    if (isToolError(first)) { assert.fail(`Unexpected error: ${first.error_code}`); }

    const firstData = first as { items: Array<{ path: string; fetchable: boolean; indexed: boolean; state: string }>; counts: { matching_total: number; returned: number }; has_more: boolean; next_cursor: string | null };
    assert.equal(firstData.counts.matching_total, 2);
    assert.equal(firstData.counts.returned, 1);
    assert.equal(firstData.items[0]?.path, "src/index.ts");
    assert.equal(firstData.items[0]?.fetchable, true);
    assert.equal(firstData.items[0]?.indexed, true);
    assert.equal(firstData.items[0]?.state, "indexed");
    assert.equal(firstData.has_more, true);
    assert.equal(typeof firstData.next_cursor, "string");

    const second = await repoFiles({
      repo_id: repoId,
      repo_path: rootDir,
      snapshot_id: snapId,
      prefix: "src",
      suffixes: [".ts", ".tsx"],
      languages: ["typescript", "tsx"],
      states: ["indexed"],
      cursor: firstData.next_cursor ?? undefined,
      limit: 1,
    }, manifest, budget);
    if (isToolError(second)) { assert.fail(`Unexpected error: ${second.error_code}`); }

    const secondData = second as { items: Array<{ path: string }>; has_more: boolean; next_cursor: string | null };
    assert.equal(secondData.items[0]?.path, "src/ui/Button.tsx");
    assert.equal(secondData.has_more, false);
    assert.equal(secondData.next_cursor, null);
  });

  await it("rejects invalid or stale cursors", async () => {
    const r = await repoFiles({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, cursor: "not-valid-json", limit: 1 }, manifest, budget);
    assert.equal(isToolError(r), true);
    if (isToolError(r)) assert.equal(r.error_code, "access_denied");
  });

  await it("rejects a valid cursor when repository binding changes", async () => {
    const first = await repoFiles({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, prefix: "src", limit: 1 }, manifest, budget);
    if (isToolError(first)) { assert.fail(`Unexpected error: ${first.error_code}`); }
    const cursor = (first as { next_cursor: string | null }).next_cursor;
    assert.equal(typeof cursor, "string");

    const stale = await repoFiles({ repo_id: repoId, repo_path: `${rootDir}-other`, snapshot_id: snapId, prefix: "src", cursor: cursor ?? undefined, limit: 1 }, manifest, budget);
    assert.equal(isToolError(stale), true);
    if (isToolError(stale)) {
      assert.equal(stale.error_code, "access_denied");
      assert.match(stale.message, /Invalid or stale repo_files cursor/);
    }
  });

  await it("returns excluded file map entries only when excluded state is requested", async () => {
    const defaultResult = await repoFiles({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, limit: 50 }, manifest, budget);
    if (isToolError(defaultResult)) { assert.fail(`Unexpected error: ${defaultResult.error_code}`); }
    const defaultData = defaultResult as { items: Array<{ path: string; state: string }> };
    assert.equal(defaultData.items.some((item) => item.state === "excluded"), false);

    const excludedResult = await repoFiles({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, states: ["excluded"], limit: 50 }, manifest, budget);
    if (isToolError(excludedResult)) { assert.fail(`Unexpected error: ${excludedResult.error_code}`); }
    const excludedData = excludedResult as { items: Array<{ path: string; fetchable: boolean; indexed: boolean; state: string; exclusion_reason: string | null }>; counts: { excluded_total: number; exclusion_reasons: Record<string, number> } };
    assert.ok(excludedData.counts.excluded_total > 0);
    assert.ok(Object.keys(excludedData.counts.exclusion_reasons).length > 0);
    assert.ok(excludedData.items.length > 0);
    assert.ok(excludedData.items.every((item) => item.fetchable === false && item.indexed === false && item.state === "excluded"));
    assert.ok(excludedData.items.some((item) => item.exclusion_reason === "secret_blocked"));
  });

  await it("allows fetch for fetchable files that are intentionally not indexed", async () => {
    const file = manifest.files.find((item) => item.relative_path === "src/utils/helpers.py");
    assert.ok(file);
    file.index_admitted = false;
    file.index_reject_reason = "index_file_limit";
    runIndexer(manifest, rootDir);

    const files = await repoFiles({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, states: ["fetchable_unindexed"], prefix: "src/utils", limit: 10 }, manifest, budget);
    if (isToolError(files)) { assert.fail(`Unexpected error: ${files.error_code}`); }
    const fileMap = files as { items: Array<{ path: string; fetchable: boolean; indexed: boolean; state: string; exclusion_reason: string | null }> };
    assert.deepEqual(fileMap.items.map((item) => item.path), ["src/utils/helpers.py"]);
    assert.equal(fileMap.items[0]?.fetchable, true);
    assert.equal(fileMap.items[0]?.indexed, false);
    assert.equal(fileMap.items[0]?.state, "fetchable_unindexed");

    const search = await repoSearcher({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, query: "find_entry_point", limit: 5 }, manifest, rootDir, budget);
    if (isToolError(search)) { assert.fail(`Unexpected error: ${search.error_code}`); }
    assert.equal((search as { hits: unknown[] }).hits.length, 0);

    const fetch = await repoFetcher({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, path: "src/utils/helpers.py", line_start: 9, line_end: 16, purpose: "review unindexed file" }, manifest, rootDir, budget);
    if (isToolError(fetch)) { assert.fail(`Unexpected error: ${fetch.error_code}`); }
    assert.match((fetch as { content: string }).content, /find_entry_point/);
  });
});

await describe("repo.fetch", async () => {
  await it("fetches valid file segment", async () => {
    const r = await repoFetcher({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, path: "src/index.ts", line_start: 10, line_end: 18, purpose: "review" }, manifest, rootDir, budget);
    if (isToolError(r)) { assert.fail(`Unexpected error: ${r.error_code}`); }
    const data = r as { content: string; path: string };
    assert.ok(data.content.includes("App"));
    assert.equal(data.path, "src/index.ts");
  });

  await it("rejects .env file", async () => {
    const r = await repoFetcher({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, path: ".env", line_start: 1, line_end: 5, purpose: "check" }, manifest, rootDir, budget);
    assert.equal(isToolError(r), true);
  });

  await it("rejects path traversal", async () => {
    const r = await repoFetcher({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, path: "../../../etc/passwd", line_start: 1, line_end: 5, purpose: "hack" }, manifest, rootDir, budget);
    assert.equal(isToolError(r), true);
  });

  await it("rejects URL-encoded traversal (%2e%2e)", async () => {
    const r = await repoFetcher({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, path: "%2e%2e/%2e%2e/etc/passwd", line_start: 1, line_end: 5, purpose: "hack" }, manifest, rootDir, budget);
    assert.equal(isToolError(r), true);
  });

  await it("rejects .git path", async () => {
    const r = await repoFetcher({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, path: ".git/config", line_start: 1, line_end: 5, purpose: "check" }, manifest, rootDir, budget);
    assert.equal(isToolError(r), true);
  });
});

await describe("repo.tree", async () => {
  await it("lists directory entries", async () => {
    const r = await repoTreer({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, depth: 1, limit: 50 }, manifest, budget);
    if (isToolError(r)) { assert.fail(`Unexpected error: ${r.error_code}`); }
    const data = r as { entries: Array<{ path: string; type: string }> };
    assert.ok(data.entries.length > 0);
    assert.ok(data.entries.some((e) => e.path === "src" && e.type === "directory"));
    assert.ok(data.entries.some((e) => e.path === "tests" && e.type === "directory"));
  });

  await it("treats path dot as repository root", async () => {
    const r = await repoTreer({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, path: ".", depth: 1, limit: 50 }, manifest, budget);
    if (isToolError(r)) { assert.fail(`Unexpected error: ${r.error_code}`); }
    const data = r as { entries: Array<{ path: string; type: string }> };
    assert.ok(data.entries.length > 0);
    assert.ok(data.entries.some((e) => e.path === "src" && e.type === "directory"));
  });

  await it("expands a targeted directory without flattening the whole repository", async () => {
    const r = await repoTreer({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, path: "src", depth: 1, limit: 50 }, manifest, budget);
    if (isToolError(r)) { assert.fail(`Unexpected error: ${r.error_code}`); }
    const data = r as { entries: Array<{ path: string; type: string }> };
    assert.ok(data.entries.some((e) => e.path === "src/index.ts" && e.type === "file"));
    assert.ok(data.entries.some((e) => e.path === "src/ui" && e.type === "directory"));
    assert.equal(data.entries.some((e) => e.path === "src/ui/Button.tsx"), false);
  });

  await it("rejects path traversal", async () => {
    const r = await repoTreer({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, path: "../", depth: 2, limit: 50 }, manifest, budget);
    assert.equal(isToolError(r), true);
  });
});

await describe("repo.symbols", async () => {
  await it("finds class definitions", async () => {
    const r = await repoSymbols({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, query: "App", limit: 10 }, manifest, budget);
    if (isToolError(r)) { assert.fail(`Unexpected error: ${r.error_code}`); }
    const data = r as { symbols: Array<{ kind: string }> };
    assert.ok(data.symbols.length > 0);
    assert.ok(data.symbols.some((s) => s.kind === "class"));
  });

  await it("finds function definitions", async () => {
    const r = await repoSymbols({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, query: "Button", limit: 10 }, manifest, budget);
    if (isToolError(r)) { assert.fail(`Unexpected error: ${r.error_code}`); }
    const data = r as { symbols: Array<{ kind: string }> };
    assert.ok(data.symbols.some((s) => s.kind === "function"));
  });
});

await describe("Cross-tool snapshot consistency (SNAP-002)", async () => {
  await it("rejects different snapshot_id across tools", async () => {
    // This is tested at the handleToolCall level in server-smoke.test.ts
    // Here we verify tools themselves bind snapshot in responses
    const r = await repoSearcher({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, query: "App", limit: 3 }, manifest, rootDir, budget);
    if (!isToolError(r)) {
      assert.equal((r as Record<string, unknown>).snapshot_id, snapId);
    }
  });
});

await describe("Budget cumulative enforcement", async () => {
  await it("session budget accumulates across calls", async () => {
    const b = createBudgetState();
    // Make multiple search calls
    await repoSearcher({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, query: "App", limit: 3 }, manifest, rootDir, b);
    await repoSearcher({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, query: "Button", limit: 3 }, manifest, rootDir, b);
    // Budget should have accumulated bytes
    assert.ok(b.sessionBytesUsed > 0);
    assert.ok(b.toolCallCount >= 2);
  });

  await it("grant budget accumulates across calls", async () => {
    const b = createBudgetState();
    await repoFetcher({ repo_id: repoId, repo_path: rootDir, snapshot_id: snapId, path: "src/index.ts", line_start: 10, line_end: 18, purpose: "test" }, manifest, rootDir, b);
    assert.ok(b.grantBytesUsed > 0);
  });
});
