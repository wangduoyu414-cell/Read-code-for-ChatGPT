import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { ingestDirectory } from "../src/snapshot/snapshot-ingest.js";

function makeTempRepo(): string {
  return mkdtempSync(join(tmpdir(), "snapshot-ingest-"));
}

await describe("snapshot ingest", async () => {
  await it("skips Windows system directories by name", () => {
    const root = makeTempRepo();
    try {
      mkdirSync(join(root, "$RECYCLE.BIN"), { recursive: true });
      mkdirSync(join(root, "System Volume Information"), { recursive: true });
      writeFileSync(join(root, "$RECYCLE.BIN", "hidden.md"), "hidden");
      writeFileSync(join(root, "System Volume Information", "hidden.md"), "hidden");
      writeFileSync(join(root, "keep.md"), "visible");

      const { manifest } = ingestDirectory(root, "repo-test", "snap-test");

      assert.deepEqual(manifest.files.map((f) => f.relative_path), ["keep.md"]);
      assert.ok(manifest.excluded_files.some((f) => f.relative_path === "$RECYCLE.BIN"));
      assert.ok(manifest.excluded_files.some((f) => f.relative_path === "System Volume Information"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  await it(
    "records unreadable directories without aborting the snapshot",
    { skip: process.platform === "win32" ? "POSIX permissions are not portable on Windows." : false },
    () => {
      const root = makeTempRepo();
      const unreadable = join(root, "locked");
      try {
        mkdirSync(unreadable);
        writeFileSync(join(unreadable, "hidden.md"), "hidden");
        writeFileSync(join(root, "keep.md"), "visible");
        chmodSync(unreadable, 0o000);

        const { manifest, warnings } = ingestDirectory(root, "repo-test", "snap-test");

        assert.deepEqual(manifest.files.map((f) => f.relative_path), ["keep.md"]);
        assert.ok(manifest.excluded_files.some((f) => f.relative_path === "locked" && f.reason.startsWith("unreadable directory:")));
        assert.ok(warnings.some((w) => w.includes("EXCLUDED(unreadable): locked")));
      } finally {
        chmodSync(unreadable, 0o700);
        rmSync(root, { recursive: true, force: true });
      }
    },
  );
});
