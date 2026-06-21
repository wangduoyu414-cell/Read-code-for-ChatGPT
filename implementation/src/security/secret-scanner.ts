/**
 * Secret scanner — content analysis for sensitive data before output.
 * Default posture: uncertain samples default to DENY.
 * Implements AC-004 from EXEC-003: unknown/suspect content is rejected.
 */

import { toolError, type ToolError } from "../errors.js";
import { CONFIG } from "../config.js";

// ─── High-confidence sensitive indicators ────────────────────────────────────

interface SecretIndicator {
  pattern: RegExp;
  label: string;
  severity: "block" | "warn";
}

const BLOCK_PATTERNS: ReadonlyArray<SecretIndicator> = [
  // Private key PEM headers (block always)
  { pattern: /-----BEGIN (?:RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----/i, label: "PRIVATE_KEY", severity: "block" },
  // AWS secret access key pattern
  { pattern: /(?:^|\W)([A-Za-z0-9/+=]{40})(?:\W|$)/, label: "AWS_SECRET_LIKE", severity: "block" },
  // Connection strings with credentials
  { pattern: /(?:mongodb|mysql|postgres|redis|jdbc):\/\/[^:@\s]+:[^@\s]+@/i, label: "CONNECTION_STRING_CREDENTIAL", severity: "block" },
  // Hardcoded bearer tokens
  { pattern: /bearer\s+[A-Za-z0-9._\-]{20,}/i, label: "BEARER_TOKEN", severity: "block" },
];

// ─── Scan result ─────────────────────────────────────────────────────────────

export interface ScanResult {
  passed: boolean;
  error?: ToolError;
  findings: string[];
}

/**
 * Scan content for high-confidence secrets.
 * Default to DENY if any blocking pattern matches or if uncertain.
 */
export function scanForSecrets(
  content: string,
  repo_id: string,
  snapshot_id: string,
  audit_id: string,
): ScanResult {
  const findings: string[] = [];

  for (const { pattern, label, severity } of BLOCK_PATTERNS) {
    if (pattern.test(content)) {
      findings.push(label);
      if (severity === "block") {
        return {
          passed: false,
          error: toolError(
            "secret_detected",
            `Content matches sensitive pattern: ${label}. Content blocked.`,
            repo_id,
            snapshot_id,
            CONFIG.policyVersion,
            audit_id,
          ),
          findings,
        };
      }
    }
  }

  return { passed: true, findings };
}

/**
 * Check if a filename or path indicates sensitive content.
 * Default-unsure rule: if it looks like it might contain secrets, block it.
 */
export function isSensitiveFileType(filename: string): boolean {
  const lower = filename.toLowerCase();
  const sensitiveExtensions = [
    ".pem", ".key", ".pfx", ".p12", ".jks", ".keystore", ".secret",
    ".credentials", ".htpasswd", ".npmrc", ".pypirc",
  ];
  const sensitiveNames = [
    ".env", ".env.local", ".env.production", ".env.development",
    "credentials.json", "service-account.json", "secrets.yaml",
    "secrets.yml", "config.json.enc",
  ];

  const base = lower.split("/").pop() ?? lower;

  if (sensitiveNames.some((n) => base === n)) return true;
  if (sensitiveExtensions.some((ext) => base.endsWith(ext))) return true;

  return false;
}

/**
 * Full content screening: filename check + content scan.
 */
export function screenContent(
  content: string,
  filename: string,
  repo_id: string,
  snapshot_id: string,
  audit_id: string,
): ScanResult {
  // Check filename first
  if (isSensitiveFileType(filename)) {
    return {
      passed: false,
      error: toolError(
        "secret_detected",
        `File type indicates sensitive content: ${filename}`,
        repo_id,
        snapshot_id,
        CONFIG.policyVersion,
        audit_id,
      ),
      findings: ["SENSITIVE_FILE_TYPE"],
    };
  }

  // Then scan content
  return scanForSecrets(content, repo_id, snapshot_id, audit_id);
}
