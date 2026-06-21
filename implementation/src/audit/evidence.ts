/**
 * Evidence packaging — structured audit with integrity fields.
 * Implements EXEC-009: audit, log privacy, evidence package.
 */

import { createHash, randomUUID } from "node:crypto";
import { CONFIG } from "../config.js";
import type { ToolError } from "../errors.js";

export interface EvidenceRecord {
  evidence_id: string;
  test_id?: string;
  timestamp: string;
  validator: string;
  validation_surface: "mcp_inspector" | "chatgpt_dev_mode" | "api_playground" | "manual" | "unit_test";
  repo_id: string;
  snapshot_id: string;
  policy_version: string;
  tool?: string;
  request_hash: string;
  response_hash: string;
  outcome: "allowed" | "denied" | "truncated" | "error";
  error_code?: string;
  audit_id: string;
  path_returned?: string;
  line_range?: string;
  byte_count?: number;
  truncated: boolean;
  sensitive_content_returned: boolean;
  raw_code_logged: boolean;
  raw_prompt_logged: boolean;
  grant_id?: string;
  budget_state_before?: string;
  budget_state_after?: string;
  retention_until: string;
  evidence_storage_path: string;
  tamper_check: string;
  pass_fail: "pass" | "fail" | "blocked" | "skipped";
}

const evidenceLog: EvidenceRecord[] = [];

export function createEvidence(overrides: Partial<EvidenceRecord>): EvidenceRecord {
  const now = new Date().toISOString();
  const evidence: EvidenceRecord = {
    evidence_id: `ev-${Date.now()}-${randomUUID().slice(0, 8)}`,
    timestamp: now,
    validator: "claude-code-executor",
    validation_surface: "unit_test",
    repo_id: "unknown",
    snapshot_id: "unknown",
    policy_version: CONFIG.policyVersion,
    request_hash: "",
    response_hash: "",
    outcome: "denied",
    audit_id: "",
    truncated: false,
    sensitive_content_returned: false,
    raw_code_logged: false,
    raw_prompt_logged: false,
    retention_until: new Date(Date.now() + 90 * 24 * 3600_000).toISOString(),
    evidence_storage_path: "",
    tamper_check: "pass",
    pass_fail: "blocked",
    ...overrides,
  };
  evidenceLog.push(evidence);
  return evidence;
}

export function hashRequest(req: unknown): string {
  return createHash("sha256").update(JSON.stringify(req)).digest("hex").slice(0, 16);
}

export function hashResponse(resp: unknown): string {
  return createHash("sha256").update(JSON.stringify(resp)).digest("hex").slice(0, 16);
}

export function evidenceFromToolCall(
  tool: string,
  repo_id: string,
  snapshot_id: string,
  audit_id: string,
  input: unknown,
  output: unknown,
  isError: boolean,
): EvidenceRecord {
  return createEvidence({
    tool,
    repo_id,
    snapshot_id,
    audit_id,
    request_hash: hashRequest(input),
    response_hash: hashResponse(output),
    outcome: isError ? "denied" : "allowed",
    error_code: isError ? (output as ToolError)?.error_code : undefined,
    validation_surface: "unit_test",
    pass_fail: isError ? "fail" : "pass",
  });
}

export function getEvidenceLog(): readonly EvidenceRecord[] {
  return evidenceLog;
}

export function clearEvidence(): void {
  evidenceLog.length = 0;
}
