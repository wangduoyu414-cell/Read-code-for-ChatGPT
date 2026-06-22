/**
 * On-demand snapshot refresh for the currently authorized repository root.
 * Builds the new manifest and indexes before publishing it to runtime state.
 */

import { statSync } from "node:fs";
import { CONFIG } from "../config.js";
import { toolError, type ToolError } from "../errors.js";
import { checkCallCount, checkGrantBudget, checkResponseBytes, checkSessionBudget, checkThrottle, type BudgetState } from "../security/budget.js";
import { wrapRepositoryContent } from "../security/redaction.js";
import { runIndexer } from "../indexer/indexer.js";
import type { IndexResult } from "../indexer/indexer.js";
import type { SnapshotManifest } from "./manifest.js";
import { ingestDirectory } from "./snapshot-ingest.js";
import { attachManifest, requestSnapshot, transitionState } from "./snapshot-registry.js";

interface RefreshSnapshotParams {
  repo_id: string;
  current_snapshot_id: string;
  rootDir: string;
  budget: BudgetState;
  audit_id: string;
  publishSnapshot: (manifest: SnapshotManifest, snapshotId: string) => void;
}

let refreshInProgress = false;

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function assertUsableRoot(rootDir: string, repo_id: string, snapshot_id: string, audit_id: string): ToolError | null {
  try {
    const stat = statSync(rootDir);
    if (!stat.isDirectory()) {
      return toolError(
        "internal_error",
        "Authorized root is not a directory; old snapshot retained.",
        repo_id,
        snapshot_id,
        CONFIG.policyVersion,
        audit_id,
      );
    }
  } catch {
    return toolError(
      "internal_error",
      "Authorized root is not readable; old snapshot retained.",
      repo_id,
      snapshot_id,
      CONFIG.policyVersion,
      audit_id,
    );
  }

  return null;
}

function checkRefreshBudgets(
  response: Record<string, unknown>,
  budget: BudgetState,
  repo_id: string,
  snapshot_id: string,
  audit_id: string,
): ToolError | null {
  const byteCount = Buffer.byteLength(JSON.stringify(response), "utf-8");

  const responseBytes = checkResponseBytes(byteCount, repo_id, snapshot_id, audit_id);
  if (!responseBytes.allowed) return responseBytes.error!;

  const sessionBudget = checkSessionBudget(byteCount, budget, repo_id, snapshot_id, audit_id);
  if (!sessionBudget.allowed) return sessionBudget.error!;

  const grantBudget = checkGrantBudget(byteCount, budget, repo_id, snapshot_id, audit_id);
  if (!grantBudget.allowed) return grantBudget.error!;

  return null;
}

function responseIndexSummary(indexResult: IndexResult): Record<string, unknown> {
  return {
    files_indexed: indexResult.files_indexed,
    files_skipped: indexResult.files_skipped,
    duration_ms: indexResult.duration_ms,
  };
}

export async function refreshRepositorySnapshot(params: RefreshSnapshotParams): Promise<ToolError | Record<string, unknown>> {
  const throttle = checkThrottle(params.budget, params.repo_id, params.current_snapshot_id, params.audit_id);
  if (!throttle.allowed) return throttle.error!;

  const callCount = checkCallCount(params.budget, params.repo_id, params.current_snapshot_id, params.audit_id);
  if (!callCount.allowed) return callCount.error!;

  if (refreshInProgress) {
    return toolError(
      "rate_limited",
      "Repository refresh is already in progress.",
      params.repo_id,
      params.current_snapshot_id,
      CONFIG.policyVersion,
      params.audit_id,
      true,
    );
  }

  const rootError = assertUsableRoot(params.rootDir, params.repo_id, params.current_snapshot_id, params.audit_id);
  if (rootError) return rootError;

  refreshInProgress = true;
  const startedAt = Date.now();
  let nextSnapshotId: string | null = null;

  try {
    nextSnapshotId = `snap-${Date.now()}`;
    requestSnapshot(nextSnapshotId, params.repo_id);
    transitionState(nextSnapshotId, "manifest_building");
    transitionState(nextSnapshotId, "filtering");

    const { manifest } = ingestDirectory(params.rootDir, params.repo_id, nextSnapshotId);
    const attached = attachManifest(nextSnapshotId, manifest);
    if (!attached) {
      transitionState(nextSnapshotId, "revoked");
      return toolError(
        "internal_error",
        "Refresh failed while attaching the new manifest; old snapshot retained.",
        params.repo_id,
        params.current_snapshot_id,
        CONFIG.policyVersion,
        params.audit_id,
      );
    }

    const indexResult = runIndexer(manifest, params.rootDir, { clearExisting: false });
    if (!indexResult.success) {
      transitionState(nextSnapshotId, "revoked");
      return toolError(
        "index_failed",
        `Refresh index failed; old snapshot retained. ${indexResult.error ?? "Unknown index error."}`,
        params.repo_id,
        params.current_snapshot_id,
        CONFIG.policyVersion,
        params.audit_id,
      );
    }

    const response = wrapRepositoryContent({
      repo_id: params.repo_id,
      previous_snapshot_id: params.current_snapshot_id,
      snapshot_id: nextSnapshotId,
      refreshed: true,
      status: "refreshed",
      files: manifest.files.length,
      excluded: manifest.excluded_files.length,
      manifest_hash: manifest.manifest_hash,
      index: responseIndexSummary(indexResult),
      duration_ms: Date.now() - startedAt,
    }, params.audit_id);

    const budgetError = checkRefreshBudgets(response, params.budget, params.repo_id, params.current_snapshot_id, params.audit_id);
    if (budgetError) {
      transitionState(nextSnapshotId, "revoked");
      return budgetError;
    }

    params.publishSnapshot(manifest, nextSnapshotId);
    return response;
  } catch (err) {
    if (nextSnapshotId !== null) {
      transitionState(nextSnapshotId, "revoked");
    }
    return toolError(
      "internal_error",
      `Refresh failed; old snapshot retained. ${errorMessage(err)}`,
      params.repo_id,
      params.current_snapshot_id,
      CONFIG.policyVersion,
      params.audit_id,
    );
  } finally {
    refreshInProgress = false;
  }
}
