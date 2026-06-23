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
  await it("admits common extensionless project text files", () => {
    const root = makeTempRepo();
    try {
      writeFileSync(join(root, "Dockerfile"), "FROM node:22\n");
      writeFileSync(join(root, "Makefile"), "test:\n\tnode --test\n");
      writeFileSync(join(root, "LICENSE"), "MIT\n");
      writeFileSync(join(root, ".gitignore"), "node_modules/\n");

      const { manifest } = ingestDirectory(root, "repo-test", "snap-test");
      const paths = manifest.files.map((f) => f.relative_path).sort();

      assert.deepEqual(paths, [".gitignore", "Dockerfile", "LICENSE", "Makefile"]);
      assert.ok(manifest.files.every((f) => f.language === "text"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  await it("admits unknown extension text files but rejects binary files", () => {
    const root = makeTempRepo();
    try {
      writeFileSync(join(root, "config.local"), "feature=true\n");
      writeFileSync(join(root, "image.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x01]));

      const { manifest } = ingestDirectory(root, "repo-test", "snap-test");
      const paths = manifest.files.map((f) => f.relative_path);

      assert.deepEqual(paths, ["config.local"]);
      assert.ok(manifest.excluded_files.some((f) => f.relative_path === "image.png" && f.reason.includes("non-text")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  await it("still rejects sensitive files after text admission is widened", () => {
    const root = makeTempRepo();
    try {
      writeFileSync(join(root, ".env"), "DATABASE_URL=postgres://user:pass@example/db\n");
      writeFileSync(join(root, "id_rsa"), "-----BEGIN OPENSSH PRIVATE KEY-----\nsecret\n");
      writeFileSync(join(root, "keep.local"), "visible=true\n");

      const { manifest } = ingestDirectory(root, "repo-test", "snap-test");
      const paths = manifest.files.map((f) => f.relative_path);

      assert.deepEqual(paths, ["keep.local"]);
      assert.ok(manifest.excluded_files.some((f) => f.relative_path === ".env" && f.reason === "sensitive file type"));
      assert.ok(manifest.excluded_files.some((f) => f.relative_path === "id_rsa" && f.reason.includes("path rejected")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  await it("rejects secret-like content in newly admitted text files", () => {
    const root = makeTempRepo();
    try {
      writeFileSync(join(root, "notes.local"), "bearer abcdefghijklmnopqrstuvwxyz123456\n");
      writeFileSync(join(root, "keep.local"), "visible=true\n");

      const { manifest, warnings } = ingestDirectory(root, "repo-test", "snap-test");
      const paths = manifest.files.map((f) => f.relative_path);

      assert.deepEqual(paths, ["keep.local"]);
      assert.ok(manifest.excluded_files.some((f) => f.relative_path === "notes.local" && f.reason === "sensitive content"));
      assert.ok(warnings.some((w) => w.includes("EXCLUDED(sensitive): notes.local")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

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

  await it("skips common local cache and virtual environment directories by name", () => {
    const root = makeTempRepo();
    try {
      for (const dir of [".claude", ".venv", ".pytest_cache", ".tmp_agent", "tmp_probe", "dist"]) {
        mkdirSync(join(root, dir), { recursive: true });
        writeFileSync(join(root, dir, "hidden.md"), "hidden");
      }
      writeFileSync(join(root, "keep.md"), "visible");

      const { manifest } = ingestDirectory(root, "repo-test", "snap-test");

      assert.deepEqual(manifest.files.map((f) => f.relative_path), ["keep.md"]);
      assert.ok(manifest.excluded_files.some((f) => f.relative_path === ".claude"));
      assert.ok(manifest.excluded_files.some((f) => f.relative_path === ".venv"));
      assert.ok(manifest.excluded_files.some((f) => f.relative_path === ".tmp_agent"));
      assert.ok(manifest.excluded_files.some((f) => f.relative_path === "tmp_probe"));
      assert.ok(manifest.excluded_files.some((f) => f.relative_path === "dist"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  await it("stops traversal when maxEntries is reached", () => {
    const root = makeTempRepo();
    try {
      mkdirSync(join(root, "a"), { recursive: true });
      mkdirSync(join(root, "b"), { recursive: true });
      writeFileSync(join(root, "a", "one.md"), "one");
      writeFileSync(join(root, "b", "two.md"), "two");
      writeFileSync(join(root, "three.md"), "three");

      const { manifest, warnings } = ingestDirectory(root, "repo-test", "snap-test", { maxEntries: 2 });

      assert.ok(manifest.excluded_files.some((f) => f.reason.startsWith("snapshot traversal limit reached:")));
      assert.ok(warnings.some((w) => w.includes("EXCLUDED(limit):")));
      assert.ok(manifest.files.length <= 2);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  await it("prioritizes source and test directories before large report output when maxEntries is low", () => {
    const root = makeTempRepo();
    try {
      mkdirSync(join(root, "reports"), { recursive: true });
      mkdirSync(join(root, "src"), { recursive: true });
      mkdirSync(join(root, "tests"), { recursive: true });

      for (let index = 0; index < 20; index += 1) {
        writeFileSync(join(root, "reports", `report-${String(index).padStart(2, "0")}.md`), `report ${index}\n`);
      }
      writeFileSync(join(root, "src", "app.py"), "def main():\n    return 'ok'\n");
      writeFileSync(join(root, "tests", "app.test.py"), "def test_main():\n    assert True\n");

      const { manifest, warnings } = ingestDirectory(root, "repo-test", "snap-test", { maxEntries: 8 });
      const paths = manifest.files.map((f) => f.relative_path);

      assert.ok(paths.includes("src/app.py"));
      assert.ok(paths.includes("tests/app.test.py"));
      assert.ok(manifest.excluded_files.some((f) => f.reason.startsWith("snapshot traversal limit reached:")));
      assert.ok(warnings.some((w) => w.includes("EXCLUDED(limit):")));
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
