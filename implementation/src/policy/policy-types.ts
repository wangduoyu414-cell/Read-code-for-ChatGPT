/**
 * Policy types — shared type definitions for authorization, grants, and policy engine.
 * These are the canonical types used across EXEC-003 through EXEC-010.
 */

import type { ErrorCode } from "../errors.js";

// ─── Grant record (task-card.md §17.1) ───────────────────────────────────────

export interface Grant {
  grant_id: string;
  user_id: string;
  client_id: string;
  repo_id: string;
  snapshot_id: string;
  allowed_tools: string[];
  allowed_paths: string[];
  data_budget: GrantBudget;
  expiry: string; // ISO 8601
  revoked_at: string | null;
  policy_version: string;
  // Consent tracking (§17.1 explicit consent)
  consent_id: string;
  consent_actor: string;
  consent_at: string; // ISO 8601
  consent_surface: "api" | "cli" | "ui" | "config";
  approved_repo_id: string;
  approved_snapshot_id: string;
  approved_paths: string[];
  approved_tools: string[];
  approved_budget: GrantBudget;
  expires_at: string; // ISO 8601
}

export interface GrantBudget {
  single_response_max_bytes: number | null;
  single_file_line_window_max: number | null;
  session_total_bytes: number | null;
  grant_total_bytes: number | null;
  tool_call_count: number | null;
  tree_max_depth: number | null;
  search_hit_max: number | null;
  symbol_hit_max: number | null;
}

// ─── Policy version ──────────────────────────────────────────────────────────

export interface PolicyVersion {
  version: string;
  active_from: string;
  rules_hash: string;
}

// ─── Auth result ─────────────────────────────────────────────────────────────

export interface AuthResult {
  allowed: boolean;
  grant?: Grant;
  error_code?: ErrorCode;
  error_message?: string;
  audit_id: string;
}

// ─── Token claims (development only) ─────────────────────────────────────────

export interface DevTokenClaims {
  user_id: string;
  client_id: string;
  audience: string;
  scope: string[];
  issuer: string;
  issued_at: string;
  expiry: string;
}

// ─── Policy decision ─────────────────────────────────────────────────────────

export interface PolicyDecision {
  allowed: boolean;
  reason: string;
  audit_id: string;
  grant_id: string;
  policy_version: string;
}
