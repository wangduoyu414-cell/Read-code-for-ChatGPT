/**
 * Path guard — validates that requested paths are safe and within authorized bounds.
 * Implements PATH-001 to PATH-004 from task-card.md §8.
 */

import { toolError, type ToolError } from "../errors.js";
import { CONFIG } from "../config.js";

// ─── Sensitive path patterns ────────────────────────────────────────────────

const SENSITIVE_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  { pattern: /(?:^|[\\/])\.git(?:[\\/]|$)/i, reason: "git internal directory" },
  { pattern: /\.env(?:[\\/]|$)/i, reason: "environment variable file" },
  { pattern: /(?:^|[\\/])\.ssh(?:[\\/]|$)/i, reason: "SSH directory" },
  { pattern: /\.pem$/i, reason: "private key file" },
  { pattern: /(?:^|[\\/])\.?aws(?:[\\/]|$)/i, reason: "AWS config/credentials" },
  { pattern: /(?:^|[\\/])\.?gcloud(?:[\\/]|$)/i, reason: "GCP config/credentials" },
  { pattern: /(?:^|[\\/])\.?azure(?:[\\/]|$)/i, reason: "Azure config/credentials" },
  { pattern: /(?:^|[\\/])kubeconfig/i, reason: "Kubernetes config" },
  { pattern: /\.tfstate/i, reason: "Terraform state" },
  { pattern: /(?:id_rsa|id_ed25519|id_ecdsa)/i, reason: "SSH private key" },
];

// ─── Path rejection interface ────────────────────────────────────────────────

export interface PathValidationResult {
  allowed: boolean;
  normalized?: string;
  error?: ToolError;
}

// ─── Path guards ─────────────────────────────────────────────────────────────

/**
 * Reject absolute paths (start with / or drive letter).
 */
function rejectAbsolutePath(input: string): boolean {
  return /^[A-Za-z]:[\\/]/.test(input) || input.startsWith("/");
}

/**
 * Reject parent directory traversal attempts (including URL-encoded variants).
 */
function rejectParentTraversal(input: string): boolean {
  // Direct traversal
  if (input.includes("..")) return true;
  // URL-encoded traversal attempts (GAP-007 fix)
  const decoded = decodeURISafely(input);
  if (decoded !== input && decoded.includes("..")) return true;
  return false;
}

/** Safely decode URI-encoded characters; returns original on failure. */
function decodeURISafely(input: string): string {
  try { return decodeURIComponent(input); }
  catch { return input; }
}

/**
 * Normalize a repository-relative path.
 * Only allows forward-slash paths within the snapshot.
 */
function normalizeRepoPath(input: string): string {
  // Convert backslashes to forward slashes
  let normalized = input.replace(/\\/g, "/");
  // Remove leading ./
  normalized = normalized.replace(/^\.\//, "");
  // Collapse multiple slashes
  normalized = normalized.replace(/\/+/g, "/");
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, "");
  return normalized;
}

/**
 * Check if a normalized path matches sensitive patterns.
 */
function isSensitivePath(normalized: string): { sensitive: boolean; reason?: string } {
  for (const { pattern, reason } of SENSITIVE_PATTERNS) {
    if (pattern.test(normalized)) {
      return { sensitive: true, reason };
    }
  }
  return { sensitive: false };
}

/**
 * Validate a requested file path against security rules.
 * Returns structured result: either allowed with normalized path, or denied with ToolError.
 */
export function validateFilePath(
  input: string,
  repo_id: string,
  snapshot_id: string,
  audit_id: string,
): PathValidationResult {
  // Reject empty
  if (!input || input.trim().length === 0) {
    return {
      allowed: false,
      error: toolError("access_denied", "Empty path not allowed.", repo_id, snapshot_id, CONFIG.policyVersion, audit_id),
    };
  }

  // Reject absolute paths
  if (rejectAbsolutePath(input)) {
    return {
      allowed: false,
      error: toolError("access_denied", "Absolute paths not allowed.", repo_id, snapshot_id, CONFIG.policyVersion, audit_id),
    };
  }

  // Reject parent directory traversal
  if (rejectParentTraversal(input)) {
    return {
      allowed: false,
      error: toolError("access_denied", "Parent directory traversal not allowed.", repo_id, snapshot_id, CONFIG.policyVersion, audit_id),
    };
  }

  // Normalize and re-check
  const normalized = normalizeRepoPath(input);

  // After normalization, verify no traversal survived
  if (rejectParentTraversal(normalized)) {
    return {
      allowed: false,
      error: toolError("access_denied", "Path traversal detected after normalization.", repo_id, snapshot_id, CONFIG.policyVersion, audit_id),
    };
  }

  // Check sensitive patterns
  const sensitiveCheck = isSensitivePath(normalized);
  if (sensitiveCheck.sensitive) {
    return {
      allowed: false,
      error: toolError(
        "secret_detected",
        `Path matches sensitive pattern: ${sensitiveCheck.reason}`,
        repo_id,
        snapshot_id,
        CONFIG.policyVersion,
        audit_id,
      ),
    };
  }

  return { allowed: true, normalized };
}
