import { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { registerRepo, bindRepo, revokeRepo, isRepoBound } from "../src/repo/repo-catalog.js";
import { requestSnapshot, transitionState, attachManifest, getSnapshot, isSnapshotReady, rejectIfNotReady } from "../src/snapshot/snapshot-registry.js";
import { computeFileHash, computeManifestHash, finalizeManifest, type SnapshotManifest } from "../src/snapshot/manifest.js";
import { CONFIG } from "../src/config.js";

function makeManifest(snapId: string, repoId: string): SnapshotManifest {
  return finalizeManifest({
    snapshot_id: snapId,
    repo_id: repoId,
    created_at: new Date().toISOString(),
    source_root_hash: computeFileHash("/fake/root"),
    files: [{ relative_path: "src/a.ts", file_hash: computeFileHash("x"), byte_count: 10, line_count: 1, language: "typescript", extension: ".ts", sensitive_detected: false, index_admitted: true }],
    excluded_files: [],
    index_version: 1,
    policy_version: CONFIG.policyVersion,
    expires_at: new Date(Date.now() + 36e5).toISOString(),
  });
}

beforeEach(() => { /* registry cleared per-test via helpers */ });

await describe("Repo Catalog", async () => {
  await it("registers and binds a repo", () => {
    const r = registerRepo("/fake/path");
    assert.equal(r.binding_state, "binding_requested");
    const b = bindRepo(r.repo_id);
    assert.ok(b);
    assert.equal(b!.binding_state, "bound");
  });
  await it("revokes a repo", () => {
    const r = registerRepo("/fake/path2");
    bindRepo(r.repo_id);
    assert.equal(isRepoBound(r.repo_id), true);
    revokeRepo(r.repo_id);
    assert.equal(isRepoBound(r.repo_id), false);
  });
});

await describe("Snapshot Registry", async () => {
  await it("lifecycle: request -> manifest_ready", () => {
    const snap = requestSnapshot("s1", "r1");
    assert.equal(snap.state, "snapshot_requested");
    transitionState("s1", "manifest_building");
    transitionState("s1", "filtering");
    const m = makeManifest("s1", "r1");
    attachManifest("s1", m);
    assert.equal(isSnapshotReady("s1"), true);
  });
  await it("rejects expired snapshot", () => {
    requestSnapshot("s2", "r1");
    transitionState("s2", "manifest_building");
    transitionState("s2", "expired");
    assert.ok(rejectIfNotReady("s2"));
  });
  await it("rejects revoked snapshot", () => {
    requestSnapshot("s3", "r1");
    transitionState("s3", "manifest_building");
    transitionState("s3", "revoked");
    assert.ok(rejectIfNotReady("s3"));
  });
  await it("rejects snapshot_not_ready", () => {
    requestSnapshot("s4", "r1");
    assert.equal(rejectIfNotReady("s4"), "snapshot_not_ready");
  });
  await it("snapshot refresh creates new snapshot_id", () => {
    const s1 = requestSnapshot("snap-a", "r1");
    transitionState("snap-a", "manifest_building");
    transitionState("snap-a", "filtering");
    attachManifest("snap-a", makeManifest("snap-a", "r1"));
    const s2 = requestSnapshot("snap-b", "r1");
    assert.notEqual(s1.snapshot_id, s2.snapshot_id);
  });
});

await describe("Manifest", async () => {
  await it("content-identical files produce stable file_hash", () => {
    const h1 = computeFileHash("hello");
    const h2 = computeFileHash("hello");
    assert.equal(h1, h2);
  });
  await it("different content gives different hash", () => {
    assert.notEqual(computeFileHash("a"), computeFileHash("b"));
  });
  await it("finalizeManifest adds manifest_hash", () => {
    const m = makeManifest("s1", "r1");
    assert.ok(m.manifest_hash);
    assert.ok(m.manifest_hash.length > 0);
  });
  await it("manifest contains no absolute paths", () => {
    const m = makeManifest("s1", "r1");
    for (const f of m.files) {
      assert.equal(f.relative_path.startsWith("/"), false);
      assert.equal(f.relative_path.includes("\\"), false);
    }
  });
});
