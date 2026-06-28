/**
 * Redaction module — content filtering and output sanitization.
 * Ensures sensitive data never reaches the model output.
 *
 * Default rule: unknown/suspicious content is redacted, not passed through.
 */

import { CONFIG } from "../config.js";

// ─── High-entropy secret patterns ────────────────────────────────────────────

const SECRET_PATTERNS: ReadonlyArray<{ pattern: RegExp; label: string }> = [
  // AWS Access Key
  { pattern: /AKIA[0-9A-Z]{16}/g, label: "AWS_ACCESS_KEY" },
  // Generic base64-looking strings that might be secrets (length > 32 base64 chars)
  { pattern: /(?:[A-Za-z0-9+/]{40,}={0,2})/g, label: "LONG_BASE64_SUSPECT" },
  // Common private key headers
  { pattern: /-----BEGIN (?:RSA|EC|DSA|OPENSSH|PGP) PRIVATE KEY-----/g, label: "PRIVATE_KEY_HEADER" },
  // JWT tokens
  { pattern: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, label: "JWT_TOKEN" },
  // GitHub tokens
  { pattern: /ghp_[A-Za-z0-9]{36}/g, label: "GITHUB_TOKEN" },
  // Generic API key patterns
  { pattern: /(?:api[_-]?key|apikey|secret|token|password|passwd)\s*[:=]\s*["'][^"']{8,}["']/gi, label: "API_KEY_ASSIGNMENT" },
];

// ─── Redaction result ────────────────────────────────────────────────────────

export interface RedactionResult {
  redacted: string;
  secretsFound: number;
  labels: string[];
  truncated: boolean;
}

// ─── Redaction functions ─────────────────────────────────────────────────────

/**
 * Redact known secret patterns from content.
 * Returns redacted content and metadata about what was found.
 */
export function redactContent(content: string): RedactionResult {
  let redacted = content;
  let secretsFound = 0;
  const labels: string[] = [];

  for (const { pattern, label } of SECRET_PATTERNS) {
    const matches = redacted.match(pattern);
    if (matches && matches.length > 0) {
      secretsFound += matches.length;
      if (!labels.includes(label)) {
        labels.push(label);
      }
      redacted = redacted.replace(pattern, `[REDACTED:${label}]`);
    }
  }

  return { redacted, secretsFound, labels, truncated: false };
}

/**
 * Truncate content to max bytes, with metadata.
 */
export function truncateContent(content: string, maxBytes: number): RedactionResult {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(content);

  if (bytes.length <= maxBytes) {
    return { redacted: content, secretsFound: 0, labels: [], truncated: false };
  }

  // Truncate at byte boundary
  let truncated = content;
  let byteCount = 0;
  for (let i = 0; i < truncated.length; i++) {
    const charBytes = encoder.encode(truncated[i]!).length;
    if (byteCount + charBytes > maxBytes) {
      truncated = truncated.slice(0, i) + "\n[TRUNCATED]";
      return { redacted: truncated, secretsFound: 0, labels: [], truncated: true };
    }
    byteCount += charBytes;
  }

  return { redacted: truncated, secretsFound: 0, labels: [], truncated: true };
}

/**
 * Full content sanitization pipeline: redact then truncate.
 */
export function sanitizeContent(content: string, maxBytes: number | null): RedactionResult {
  const redactResult = redactContent(content);
  if (maxBytes === null) {
    return redactResult;
  }

  const truncResult = truncateContent(redactResult.redacted, maxBytes);
  return {
    redacted: truncResult.redacted,
    secretsFound: redactResult.secretsFound,
    labels: redactResult.labels,
    truncated: truncResult.truncated,
  };
}

/**
 * Build structured output with content origin and trust markers.
 * Wraps repository content as untrusted data (§17.5).
 */
export function wrapRepositoryContent(
  data: Record<string, unknown>,
  auditId: string,
): Record<string, unknown> {
  return {
    ...data,
    content_origin: CONFIG.contentOrigin,
    instruction_trust: CONFIG.instructionTrust,
    policy_version: CONFIG.policyVersion,
    audit_id: auditId,
  };
}
