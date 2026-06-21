/**
 * Policy engine — central authorization decision point.
 * Every tool call passes through authorizeToolCall which validates:
 * grant_id, user_id, client_id, repo_id, snapshot_id, tool,
 * allowed_paths, budget, policy_version, expiry, revoked_at.
 */

import { toolError, type ToolError } from "../errors.js";
import { CONFIG } from "../config.js";
import { getGrant, isGrantActive, requiresReConsent } from "../auth/grants.js";
import { verifyTokenWithChecks } from "../auth/tokens.js";
import type { AuthResult } from "./policy-types.js";
import { generateAuditId } from "../audit/audit-id.js";

const SERVER_AUDIENCE = "chatgpt-local-repo-001";
const TRUSTED_ISSUER = "chatgpt-local-repo-001-dev";

export function authorizeToolCall(
  token: string,
  grant_id: string,
  toolName: string,
  repo_id: string,
  snapshot_id: string,
  requestedPath: string,
): AuthResult {
  const audit_id = generateAuditId();

  // 1. Verify token (audience, issuer, scope — AUTH-002, AUTH-003)
  const tokenResult = verifyTokenWithChecks(token, SERVER_AUDIENCE, ["read:snapshot"], TRUSTED_ISSUER);
  if ("error" in tokenResult) {
    return { allowed: false, error_code: "auth_failed", error_message: tokenResult.error, audit_id };
  }
  const { claims } = tokenResult;

  // 2. Get grant
  const grant = getGrant(grant_id);
  if (!grant) {
    return { allowed: false, error_code: "access_denied", error_message: "Grant not found.", audit_id };
  }

  // 3. Bind user/client from token to grant
  if (grant.user_id !== claims.user_id) {
    return { allowed: false, error_code: "access_denied", error_message: "Grant user_id != token user_id.", audit_id };
  }
  if (grant.client_id !== claims.client_id) {
    return { allowed: false, error_code: "access_denied", error_message: "Grant client_id != token client_id.", audit_id };
  }

  // 4. Grant active check (revoked / expired)
  if (!isGrantActive(grant)) {
    return {
      allowed: false,
      error_code: grant.revoked_at ? "access_denied" : "scope_denied",
      error_message: grant.revoked_at ? "Grant revoked." : "Grant expired.",
      audit_id,
    };
  }

  // 5. Repo / snapshot match
  if (grant.repo_id !== repo_id) {
    return { allowed: false, error_code: "access_denied", error_message: "Repo mismatch.", audit_id };
  }
  if (grant.snapshot_id !== snapshot_id) {
    return { allowed: false, error_code: "snapshot_not_ready", error_message: "Snapshot mismatch.", audit_id };
  }

  // 6. Policy version match
  if (grant.policy_version !== CONFIG.policyVersion) {
    return { allowed: false, error_code: "scope_denied", error_message: "Policy version mismatch; re-auth required.", audit_id };
  }

  // 7. Tool allowlist
  if (!grant.allowed_tools.includes(toolName)) {
    return { allowed: false, error_code: "access_denied", error_message: `Tool ${toolName} not allowed.`, audit_id };
  }

  // 8. Re-consent check (path/tool/snapshot expansion)
  const reConsent = requiresReConsent(grant, toolName, requestedPath);
  if (reConsent.required) {
    return { allowed: false, error_code: "scope_denied", error_message: `Re-consent: ${reConsent.reason}`, audit_id };
  }

  // 9. Path allowlist
  const norm = grant.allowed_paths.map((p) => p.endsWith("/") ? p : p + "/");
  const pathOk = norm.some(
    (p) => requestedPath === p.slice(0, -1) || requestedPath.startsWith(p),
  );
  if (!pathOk) {
    return { allowed: false, error_code: "access_denied", error_message: `Path not allowed.`, audit_id };
  }

  return { allowed: true, grant, audit_id };
}

export function authDeniedResponse(result: AuthResult): ToolError {
  return toolError(
    result.error_code ?? "access_denied",
    result.error_message ?? "Authorization denied.",
    "unknown", "unknown",
    CONFIG.policyVersion,
    result.audit_id,
  );
}
