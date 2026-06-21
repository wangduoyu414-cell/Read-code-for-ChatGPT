/**
 * Structured error types matching task-card.md §17.6 error response contract.
 * Every tool error MUST include: isError, error_code, message, repo_id, snapshot_id,
 * policy_version, audit_id, retryable.
 */

export const ERROR_CODES = [
  "auth_failed",
  "scope_denied",
  "snapshot_not_ready",
  "access_denied",
  "secret_detected",
  "result_too_large",
  "budget_exceeded",
  "rate_limited",
  "unsupported_file_type",
  "index_failed",
  "tunnel_unavailable",
  "internal_error",
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ToolError {
  [key: string]: unknown;
  isError: true;
  error_code: ErrorCode;
  message: string;
  repo_id: string;
  snapshot_id: string;
  policy_version: string;
  audit_id: string;
  retryable: boolean;
}

export interface NotYetImplementedError extends ToolError {
  error_code: "internal_error";
  message: "Tool not yet implemented.";
}

/**
 * Create a not-yet-implemented error for the scaffold phase.
 * All four tools return this until their implementations are wired in EXEC-008.
 */
export function notImplementedError(
  repo_id: string,
  snapshot_id: string,
  policy_version: string,
  audit_id: string,
): NotYetImplementedError {
  return {
    isError: true,
    error_code: "internal_error",
    message: "Tool not yet implemented.",
    repo_id,
    snapshot_id,
    policy_version,
    audit_id,
    retryable: false,
  };
}

/**
 * Create a structured tool error with full contract fields.
 */
export function toolError(
  code: ErrorCode,
  message: string,
  repo_id: string,
  snapshot_id: string,
  policy_version: string,
  audit_id: string,
  retryable = false,
): ToolError {
  return {
    isError: true,
    error_code: code,
    message,
    repo_id,
    snapshot_id,
    policy_version,
    audit_id,
    retryable,
  };
}

/**
 * Type guard: check if an object is a ToolError.
 */
export function isToolError(value: unknown): value is ToolError {
  return (
    typeof value === "object" &&
    value !== null &&
    "isError" in value &&
    (value as ToolError).isError === true &&
    "error_code" in value &&
    "audit_id" in value
  );
}
