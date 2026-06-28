/**
 * Budget model — enforces cumulative data exfiltration limits.
 * Implements §17.4 data exfiltration budget from task-card.md.
 *
 * Tracks: per-response and per-grant byte budgets, session byte accounting;
 * call counts, tree depth, search/symbol hit limits, throttle windows.
 */

import { toolError, type ToolError } from "../errors.js";
import { CONFIG } from "../config.js";

// ─── Budget state ────────────────────────────────────────────────────────────

export interface BudgetState {
  sessionBytesUsed: number;
  grantBytesUsed: number;
  toolCallCount: number;
  lastCallTimestamp: number;
  callsInCurrentWindow: number;
  windowStartTimestamp: number;
}

export function createBudgetState(): BudgetState {
  const now = Date.now();
  return {
    sessionBytesUsed: 0,
    grantBytesUsed: 0,
    toolCallCount: 0,
    lastCallTimestamp: now,
    callsInCurrentWindow: 0,
    windowStartTimestamp: now,
  };
}

// ─── Budget check result ─────────────────────────────────────────────────────

export interface BudgetCheckResult {
  allowed: boolean;
  error?: ToolError;
}

// ─── Budget checks ───────────────────────────────────────────────────────────

/**
 * Check per-response byte limit.
 */
export function checkResponseBytes(
  byteCount: number,
  repo_id: string,
  snapshot_id: string,
  audit_id: string,
): BudgetCheckResult {
  const responseLimit = CONFIG.budget.singleResponseMaxBytes;
  if (responseLimit === null) {
    return { allowed: true };
  }

  if (byteCount > responseLimit) {
    return {
      allowed: false,
      error: toolError(
        "result_too_large",
        `Response size ${byteCount} exceeds limit ${responseLimit}.`,
        repo_id,
        snapshot_id,
        CONFIG.policyVersion,
        audit_id,
      ),
    };
  }
  return { allowed: true };
}

/**
 * Check and update session byte accounting; enforce only when configured.
 */
export function checkSessionBudget(
  additionalBytes: number,
  state: BudgetState,
  repo_id: string,
  snapshot_id: string,
  audit_id: string,
): BudgetCheckResult {
  const sessionLimit = CONFIG.budget.sessionTotalBytes;
  if (sessionLimit === null) {
    state.sessionBytesUsed += additionalBytes;
    return { allowed: true };
  }

  const newTotal = state.sessionBytesUsed + additionalBytes;
  if (newTotal > sessionLimit) {
    return {
      allowed: false,
      error: toolError(
        "budget_exceeded",
        `Session budget exceeded: ${newTotal} > ${sessionLimit}.`,
        repo_id,
        snapshot_id,
        CONFIG.policyVersion,
        audit_id,
        false,
      ),
    };
  }
  state.sessionBytesUsed = newTotal;
  return { allowed: true };
}

/**
 * Check and update grant cumulative budget.
 */
export function checkGrantBudget(
  additionalBytes: number,
  state: BudgetState,
  repo_id: string,
  snapshot_id: string,
  audit_id: string,
): BudgetCheckResult {
  const newTotal = state.grantBytesUsed + additionalBytes;
  if (newTotal > CONFIG.budget.grantTotalBytes) {
    return {
      allowed: false,
      error: toolError(
        "budget_exceeded",
        `Grant budget exceeded: ${newTotal} > ${CONFIG.budget.grantTotalBytes}.`,
        repo_id,
        snapshot_id,
        CONFIG.policyVersion,
        audit_id,
        false,
      ),
    };
  }
  state.grantBytesUsed = newTotal;
  return { allowed: true };
}

/**
 * Check and update call count budget.
 */
export function checkCallCount(
  state: BudgetState,
  repo_id: string,
  snapshot_id: string,
  audit_id: string,
): BudgetCheckResult {
  const toolCallLimit = CONFIG.budget.toolCallCount;
  if (toolCallLimit !== null && state.toolCallCount >= toolCallLimit) {
    return {
      allowed: false,
      error: toolError(
        "budget_exceeded",
        `Tool call count exceeded: ${state.toolCallCount} >= ${toolCallLimit}.`,
        repo_id,
        snapshot_id,
        CONFIG.policyVersion,
        audit_id,
        false,
      ),
    };
  }
  state.toolCallCount += 1;
  return { allowed: true };
}

/**
 * Throttle check: max calls per time window.
 */
export function checkThrottle(
  state: BudgetState,
  repo_id: string,
  snapshot_id: string,
  audit_id: string,
): BudgetCheckResult {
  const throttleMaxCalls = CONFIG.budget.throttleMaxCalls;
  if (throttleMaxCalls === null) {
    state.lastCallTimestamp = Date.now();
    return { allowed: true };
  }

  const now = Date.now();
  if (now - state.windowStartTimestamp >= CONFIG.budget.throttleWindowMs) {
    // New window
    state.windowStartTimestamp = now;
    state.callsInCurrentWindow = 0;
  }
  if (state.callsInCurrentWindow >= throttleMaxCalls) {
    return {
      allowed: false,
      error: toolError(
        "rate_limited",
        `Throttle limit: ${throttleMaxCalls} calls per ${CONFIG.budget.throttleWindowMs}ms.`,
        repo_id,
        snapshot_id,
        CONFIG.policyVersion,
        audit_id,
        true,
      ),
    };
  }
  state.callsInCurrentWindow += 1;
  state.lastCallTimestamp = now;
  return { allowed: true };
}

/**
 * Check tree depth budget.
 */
export function checkTreeDepth(
  depth: number,
  repo_id: string,
  snapshot_id: string,
  audit_id: string,
): BudgetCheckResult {
  if (depth > CONFIG.budget.treeMaxDepth) {
    return {
      allowed: false,
      error: toolError(
        "result_too_large",
        `Tree depth ${depth} exceeds limit ${CONFIG.budget.treeMaxDepth}.`,
        repo_id,
        snapshot_id,
        CONFIG.policyVersion,
        audit_id,
      ),
    };
  }
  return { allowed: true };
}

/**
 * Check search hit limit.
 */
export function checkSearchHitLimit(
  count: number,
  repo_id: string,
  snapshot_id: string,
  audit_id: string,
): BudgetCheckResult {
  if (count > CONFIG.budget.searchHitMax) {
    return {
      allowed: false,
      error: toolError(
        "result_too_large",
        `Search hits ${count} exceeds limit ${CONFIG.budget.searchHitMax}.`,
        repo_id,
        snapshot_id,
        CONFIG.policyVersion,
        audit_id,
      ),
    };
  }
  return { allowed: true };
}

/**
 * Check symbol hit limit.
 */
export function checkSymbolHitLimit(
  count: number,
  repo_id: string,
  snapshot_id: string,
  audit_id: string,
): BudgetCheckResult {
  if (count > CONFIG.budget.symbolHitMax) {
    return {
      allowed: false,
      error: toolError(
        "result_too_large",
        `Symbol hits ${count} exceeds limit ${CONFIG.budget.symbolHitMax}.`,
        repo_id,
        snapshot_id,
        CONFIG.policyVersion,
        audit_id,
      ),
    };
  }
  return { allowed: true };
}

/**
 * Check single file line window limit.
 */
export function checkLineWindow(
  lineStart: number,
  lineEnd: number,
  repo_id: string,
  snapshot_id: string,
  audit_id: string,
): BudgetCheckResult {
  const window = lineEnd - lineStart + 1;
  if (window < 0) {
    return {
      allowed: false,
      error: toolError("access_denied", "line_end must be >= line_start.", repo_id, snapshot_id, CONFIG.policyVersion, audit_id),
    };
  }

  const lineWindowLimit = CONFIG.budget.singleFileLineWindowMax;
  if (lineWindowLimit === null) {
    return { allowed: true };
  }

  if (window > lineWindowLimit) {
    return {
      allowed: false,
      error: toolError(
        "result_too_large",
        `Line window ${window} exceeds limit ${lineWindowLimit}.`,
        repo_id,
        snapshot_id,
        CONFIG.policyVersion,
        audit_id,
      ),
    };
  }
  return { allowed: true };
}
