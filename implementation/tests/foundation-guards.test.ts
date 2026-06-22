/**
 * Foundation guards tests — path validation, budget enforcement, redaction, secret scanning.
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateFilePath } from "../src/security/path-guard.js";
import { checkResponseBytes, checkSessionBudget, checkGrantBudget, checkCallCount, checkThrottle, checkTreeDepth, checkLineWindow, createBudgetState } from "../src/security/budget.js";
import { redactContent, sanitizeContent, wrapRepositoryContent } from "../src/security/redaction.js";
import { scanForSecrets, screenContent, isSensitiveFileType } from "../src/security/secret-scanner.js";
import { generateAuditId } from "../src/audit/audit-id.js";

const TEST_REPO = "test-repo";
const TEST_SNAP = "snap-1";

function aid() { return generateAuditId(); }

// ─── Path Guard ──────────────────────────────────────────────────────────────

await describe("Path Guard", async () => {
  await it("rejects absolute Windows path", () => {
    const r = validateFilePath("C:\\Users\\example\\secret.txt", TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.allowed, false);
    assert.ok(r.error);
    assert.equal(r.error.error_code, "access_denied");
  });

  await it("rejects absolute Unix path", () => {
    const r = validateFilePath("/etc/passwd", TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.allowed, false);
    assert.ok(r.error);
  });

  await it("rejects parent directory traversal", () => {
    const r = validateFilePath("../../../etc/passwd", TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.allowed, false);
    assert.ok(r.error?.message.includes("traversal"));
  });

  await it("rejects dot dot in path", () => {
    const r = validateFilePath("src/../secret.env", TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.allowed, false);
  });

  await it("rejects .git path", () => {
    const r = validateFilePath(".git/config", TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.allowed, false);
    assert.ok(r.error?.error_code === "secret_detected");
  });

  await it("rejects .env file", () => {
    const r = validateFilePath(".env", TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.allowed, false);
    assert.ok(r.error?.error_code === "secret_detected");
  });

  await it("rejects .pem file", () => {
    const r = validateFilePath("certs/server.pem", TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.allowed, false);
    assert.ok(r.error?.error_code === "secret_detected");
  });

  await it("rejects id_rsa file", () => {
    const r = validateFilePath(".ssh/id_rsa", TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.allowed, false);
    assert.ok(r.error?.error_code === "secret_detected");
  });

  await it("allows normal source file", () => {
    const r = validateFilePath("src/components/Button.tsx", TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.allowed, true);
    assert.equal(r.normalized, "src/components/Button.tsx");
  });

  await it("normalizes backslashes to forward slashes", () => {
    const r = validateFilePath("src\\utils\\helper.ts", TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.allowed, true);
    assert.equal(r.normalized, "src/utils/helper.ts");
  });

  await it("rejects empty path", () => {
    const r = validateFilePath("", TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.allowed, false);
  });
});

// ─── Budget ──────────────────────────────────────────────────────────────────

await describe("Budget", async () => {
  await it("checkResponseBytes allows small response", () => {
    const r = checkResponseBytes(1000, TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.allowed, true);
  });

  await it("checkResponseBytes rejects oversized response", () => {
    const r = checkResponseBytes(10 * 1024 * 1024, TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.allowed, false);
    assert.equal(r.error?.error_code, "result_too_large");
  });

  await it("checkSessionBudget accumulates and rejects overflow", () => {
    const state = createBudgetState();
    const r1 = checkSessionBudget(1_000_000, state, TEST_REPO, TEST_SNAP, aid());
    assert.equal(r1.allowed, true);
    const r2 = checkSessionBudget(2_000_000, state, TEST_REPO, TEST_SNAP, aid());
    assert.equal(r2.allowed, false);
    assert.equal(r2.error?.error_code, "budget_exceeded");
  });

  await it("checkGrantBudget accumulates and rejects overflow", () => {
    const state = createBudgetState();
    const r1 = checkGrantBudget(9_000_000, state, TEST_REPO, TEST_SNAP, aid());
    assert.equal(r1.allowed, true);
    const r2 = checkGrantBudget(2_000_000, state, TEST_REPO, TEST_SNAP, aid());
    assert.equal(r2.allowed, false);
    assert.equal(r2.error?.error_code, "budget_exceeded");
  });

  await it("checkCallCount enforces limit", () => {
    const state = createBudgetState();
    state.toolCallCount = 499;
    const r1 = checkCallCount(state, TEST_REPO, TEST_SNAP, aid());
    assert.equal(r1.allowed, true);
    assert.equal(state.toolCallCount, 500);
    const r2 = checkCallCount(state, TEST_REPO, TEST_SNAP, aid());
    assert.equal(r2.allowed, false);
    assert.equal(r2.error?.error_code, "budget_exceeded");
  });

  await it("checkThrottle allows burst then rejects", () => {
    const state = createBudgetState();
    for (let i = 0; i < 60; i++) {
      const r = checkThrottle(state, TEST_REPO, TEST_SNAP, aid());
      assert.equal(r.allowed, true);
    }
    const r = checkThrottle(state, TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.allowed, false);
    assert.equal(r.error?.error_code, "rate_limited");
  });

  await it("checkTreeDepth rejects excessive depth", () => {
    const r = checkTreeDepth(5, TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.allowed, false);
    assert.equal(r.error?.error_code, "result_too_large");
  });

  await it("checkLineWindow rejects negative window", () => {
    const r = checkLineWindow(10, 5, TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.allowed, false);
    assert.equal(r.error?.error_code, "access_denied");
  });

  await it("checkLineWindow rejects oversized window", () => {
    const r = checkLineWindow(1, 500, TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.allowed, false);
    assert.equal(r.error?.error_code, "result_too_large");
  });
});

// ─── Redaction ───────────────────────────────────────────────────────────────

await describe("Redaction", async () => {
  await it("redacts AWS access key", () => {
    const result = redactContent("AKIAIOSFODNN7EXAMPLE");
    assert.ok(result.secretsFound > 0);
    assert.ok(result.redacted.includes("[REDACTED:"));
  });

  await it("redacts private key header", () => {
    const result = redactContent("-----BEGIN RSA PRIVATE KEY-----\nabc123\n-----END RSA PRIVATE KEY-----");
    assert.ok(result.secretsFound > 0);
    assert.ok(result.redacted.includes("[REDACTED:PRIVATE_KEY_HEADER]"));
  });

  await it("redacts JWT token", () => {
    const result = redactContent("Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U");
    assert.ok(result.secretsFound > 0);
  });

  await it("truncates content to max bytes", () => {
    const long = "line of normal text. ".repeat(500);
    const result = sanitizeContent(long, 1000);
    assert.equal(result.truncated, true);
    assert.ok(result.redacted.length <= 1100); // some overhead for truncation message
  });

  await it("wrapRepositoryContent adds origin markers", () => {
    const wrapped = wrapRepositoryContent({ hits: [] }, "audit-1");
    assert.equal(wrapped.content_origin, "repository_snapshot");
    assert.equal(wrapped.instruction_trust, "untrusted");
    assert.ok(wrapped.policy_version);
    assert.equal(wrapped.audit_id, "audit-1");
  });
});

// ─── Secret Scanner ──────────────────────────────────────────────────────────

await describe("Secret Scanner", async () => {
  await it("detects private key header", () => {
    const r = scanForSecrets("-----BEGIN RSA PRIVATE KEY-----", TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.passed, false);
    assert.ok(r.error?.error_code === "secret_detected");
  });

  await it("detects connection string with credentials", () => {
    const r = scanForSecrets("mongodb://admin:secret123@localhost:27017/db", TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.passed, false);
    assert.ok(r.error?.error_code === "secret_detected");
  });

  await it("detects bearer token", () => {
    const r = scanForSecrets("Authorization: bearer abcdefghijklmnopqrstuvwxyz1234567890", TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.passed, false);
  });

  await it("passes normal code content", () => {
    const r = scanForSecrets("function hello() { return 'world'; }", TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.passed, true);
  });

  await it("isSensitiveFileType flags .env files", () => {
    assert.equal(isSensitiveFileType(".env"), true);
    assert.equal(isSensitiveFileType(".env.local"), true);
    assert.equal(isSensitiveFileType("credentials.json"), true);
    assert.equal(isSensitiveFileType("LLM模型APIKEY 可供测试使用.md"), true);
    assert.equal(isSensitiveFileType("notes-token.md"), true);
  });

  await it("isSensitiveFileType passes normal files", () => {
    assert.equal(isSensitiveFileType("index.ts"), false);
    assert.equal(isSensitiveFileType("README.md"), false);
    assert.equal(isSensitiveFileType("src/utils.ts"), false);
    assert.equal(isSensitiveFileType("tokenizer.ts"), false);
  });

  await it("screenContent rejects .pem files", () => {
    const r = screenContent("content", "key.pem", TEST_REPO, TEST_SNAP, aid());
    assert.equal(r.passed, false);
    assert.ok(r.findings.includes("SENSITIVE_FILE_TYPE"));
  });
});

// ─── Audit ID ────────────────────────────────────────────────────────────────

await describe("Audit ID", async () => {
  await it("generates unique IDs", () => {
    const id1 = aid();
    const id2 = aid();
    assert.notEqual(id1, id2);
  });

  await it("starts with audit- prefix", () => {
    const id = aid();
    assert.ok(id.startsWith("audit-"));
  });
});
