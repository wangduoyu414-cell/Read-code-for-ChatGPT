/**
 * Audit ID generation and audit event types.
 * Each tool invocation gets a unique, sortable audit_id.
 */

import { randomUUID } from "node:crypto";

let counter = 0;

/** Generate a unique, sortable audit ID. */
export function generateAuditId(): string {
  counter += 1;
  const ts = Date.now();
  return `audit-${ts}-${counter}-${randomUUID().slice(0, 8)}`;
}

/** Minimal audit event — full evidence packaging in EXEC-009. */
export interface AuditEvent {
  audit_id: string;
  timestamp: string;
  event_type: "tool_call" | "auth_check" | "budget_reject" | "path_reject" | "secret_reject";
  repo_id: string;
  snapshot_id: string;
  policy_version: string;
  tool_name?: string;
  outcome: "allowed" | "denied";
  reason?: string;
  request_hash?: string;
  response_hash?: string;
  grant_id?: string;
  user_id?: string;
}

/** In-memory audit log — replaced with structured persistent log in EXEC-009. */
const auditLog: AuditEvent[] = [];

export function recordAuditEvent(event: AuditEvent): void {
  auditLog.push(event);
}

export function getAuditLog(): readonly AuditEvent[] {
  return auditLog;
}

export function clearAuditLog(): void {
  auditLog.length = 0;
}
