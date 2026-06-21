/**
 * Grant store — server-side authorization grant records.
 * Implements task-card.md §17.1 authorization grant record.
 *
 * Every readable repo snapshot MUST have a persisted grant record.
 * This is a dev-only in-memory store. Production requires persistent, auditable storage.
 */

import type { Grant, GrantBudget } from "../policy/policy-types.js";
import { CONFIG } from "../config.js";

// ─── In-memory grant store (dev only) ────────────────────────────────────────

const grantStore = new Map<string, Grant>();

// ─── Default budget ──────────────────────────────────────────────────────────

export function defaultGrantBudget(): GrantBudget {
  return {
    single_response_max_bytes: CONFIG.budget.singleResponseMaxBytes,
    single_file_line_window_max: CONFIG.budget.singleFileLineWindowMax,
    session_total_bytes: CONFIG.budget.sessionTotalBytes,
    grant_total_bytes: CONFIG.budget.grantTotalBytes,
    tool_call_count: CONFIG.budget.toolCallCount,
    tree_max_depth: CONFIG.budget.treeMaxDepth,
    search_hit_max: CONFIG.budget.searchHitMax,
    symbol_hit_max: CONFIG.budget.symbolHitMax,
  };
}

// ─── Consent record (explicit consent, §17.1 EXEC-004.3) ─────────────────────

export interface ConsentRecord {
  consent_id: string;
  consent_actor: string;
  consent_at: string;
  consent_surface: "api" | "cli" | "ui" | "config";
  approved_repo_id: string;
  approved_snapshot_id: string;
  approved_paths: string[];
  approved_tools: string[];
  approved_budget: GrantBudget;
  expires_at: string;
}

const consentStore: ConsentRecord[] = [];

/**
 * Record explicit consent. A grant CANNOT be created without a consent record.
 */
export function recordConsent(consent: ConsentRecord): void {
  consentStore.push(consent);
}

/**
 * Check if consent exists for a given repo/snapshot/user combination.
 */
export function hasConsent(user_id: string, repo_id: string, snapshot_id: string): boolean {
  const now = new Date();
  return consentStore.some(
    (c) =>
      c.consent_actor === user_id &&
      c.approved_repo_id === repo_id &&
      c.approved_snapshot_id === snapshot_id &&
      new Date(c.expires_at) > now,
  );
}

/**
 * Find the latest active consent for a user/repo/snapshot.
 */
export function getLatestConsent(user_id: string, repo_id: string, snapshot_id: string): ConsentRecord | undefined {
  const now = new Date();
  const active = consentStore
    .filter(
      (c) =>
        c.consent_actor === user_id &&
        c.approved_repo_id === repo_id &&
        c.approved_snapshot_id === snapshot_id &&
        new Date(c.expires_at) > now,
    )
    .sort((a, b) => new Date(b.consent_at).getTime() - new Date(a.consent_at).getTime());
  return active[0];
}

// ─── Grant CRUD ──────────────────────────────────────────────────────────────

/**
 * Create a grant. REQUIRES an existing consent record.
 * Returns null if no consent exists (AC-005: no grant without explicit consent).
 */
export function createGrant(
  input: Omit<Grant, "grant_id" | "policy_version">,
  consent: ConsentRecord,
): Grant | { error: string } {
  // Verify consent covers this grant
  if (
    consent.consent_actor !== input.user_id ||
    consent.approved_repo_id !== input.repo_id ||
    consent.approved_snapshot_id !== input.snapshot_id
  ) {
    return { error: "Consent does not match grant request." };
  }

  const grant: Grant = {
    ...input,
    grant_id: `grant-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    policy_version: CONFIG.policyVersion,
    consent_id: consent.consent_id,
    consent_actor: consent.consent_actor,
    consent_at: consent.consent_at,
    consent_surface: consent.consent_surface,
    approved_repo_id: consent.approved_repo_id,
    approved_snapshot_id: consent.approved_snapshot_id,
    approved_paths: consent.approved_paths,
    approved_tools: consent.approved_tools,
    approved_budget: consent.approved_budget,
  };

  grantStore.set(grant.grant_id, grant);
  return grant;
}

/**
 * Get a grant by ID.
 */
export function getGrant(grant_id: string): Grant | undefined {
  return grantStore.get(grant_id);
}

/**
 * Revoke a grant. After revocation, all attempted uses MUST be rejected.
 */
export function revokeGrant(grant_id: string): boolean {
  const grant = grantStore.get(grant_id);
  if (!grant) return false;
  grant.revoked_at = new Date().toISOString();
  return true;
}

/**
 * Check if a grant is currently active.
 */
export function isGrantActive(grant: Grant): boolean {
  const now = new Date();
  if (grant.revoked_at) return false;
  if (new Date(grant.expiry) < now) return false;
  if (new Date(grant.expires_at) < now) return false;
  return true;
}

/**
 * Check if a policy change (version, paths, tools, budget, snapshot) requires re-consent.
 * If any dimension expands, the old consent is insufficient.
 */
export function requiresReConsent(
  grant: Grant,
  requestedTool: string,
  requestedPath: string,
): { required: boolean; reason?: string } {
  // Tool expansion?
  if (!grant.approved_tools.includes(requestedTool)) {
    return { required: true, reason: `Tool ${requestedTool} not in approved tools.` };
  }

  // Path expansion? (prefix match)
  const normalizedApproved = grant.approved_paths.map((p) => p.endsWith("/") ? p : p + "/");
  const pathAllowed = normalizedApproved.some(
    (approved) => requestedPath === approved.slice(0, -1) || requestedPath.startsWith(approved),
  );
  if (!pathAllowed) {
    return { required: true, reason: `Path ${requestedPath} not in approved paths.` };
  }

  // Snapshot changed?
  if (grant.snapshot_id !== grant.approved_snapshot_id) {
    return { required: true, reason: "Snapshot changed since consent." };
  }

  return { required: false };
}

/** Clear all grants and consents (for testing). */
export function clearGrants(): void {
  grantStore.clear();
  consentStore.length = 0;
}
