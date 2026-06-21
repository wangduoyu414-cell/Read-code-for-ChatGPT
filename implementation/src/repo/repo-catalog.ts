/**
 * Repo Catalog — manages registered repositories and their binding state.
 * Implements repo binding lifecycle: unbound -> binding_requested -> bound -> revoked.
 */

import { randomUUID } from "node:crypto";

export type RepoBindingState = "unbound" | "binding_requested" | "bound" | "revoked";

export interface RepoEntry {
  repo_id: string;
  internal_abs_path: string; // never exposed to model
  binding_state: RepoBindingState;
  registered_at: string;
  revoked_at: string | null;
  metadata: {
    description?: string;
    default_branch?: string;
  };
}

const catalog = new Map<string, RepoEntry>();

export function registerRepo(internalAbsPath: string, description?: string): RepoEntry {
  const repo_id = `repo-${randomUUID().slice(0, 12)}`;
  const entry: RepoEntry = {
    repo_id,
    internal_abs_path: internalAbsPath,
    binding_state: "binding_requested",
    registered_at: new Date().toISOString(),
    revoked_at: null,
    metadata: { description },
  };
  catalog.set(repo_id, entry);
  return entry;
}

export function bindRepo(repo_id: string): RepoEntry | null {
  const entry = catalog.get(repo_id);
  if (!entry || entry.binding_state !== "binding_requested") return null;
  entry.binding_state = "bound";
  return entry;
}

export function revokeRepo(repo_id: string): boolean {
  const entry = catalog.get(repo_id);
  if (!entry) return false;
  entry.binding_state = "revoked";
  entry.revoked_at = new Date().toISOString();
  return true;
}

export function getRepo(repo_id: string): RepoEntry | undefined {
  return catalog.get(repo_id);
}

export function isRepoBound(repo_id: string): boolean {
  return catalog.get(repo_id)?.binding_state === "bound";
}

export function clearCatalog(): void {
  catalog.clear();
}
