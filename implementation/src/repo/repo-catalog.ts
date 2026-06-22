/**
 * Repo Catalog — manages registered repositories and their binding state.
 * Implements repo binding lifecycle: unbound -> binding_requested -> bound -> revoked.
 */

import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

export type RepoBindingState = "unbound" | "binding_requested" | "bound" | "revoked";

export interface RepoMetadata {
  name?: string;
  description?: string;
  default_branch?: string;
}

export interface RepoEntry {
  repo_id: string;
  internal_abs_path: string;
  repo_path: string;
  binding_state: RepoBindingState;
  registered_at: string;
  revoked_at: string | null;
  metadata: RepoMetadata;
}

const catalog = new Map<string, RepoEntry>();
const catalogByPathKey = new Map<string, string>();

export function normalizeRepoRootPath(input: string): string {
  const resolved = resolve(input);
  return resolved.replace(/[\\/]$/, "");
}

export function repoPathCompareKey(input: string): string {
  const normalized = normalizeRepoRootPath(input);
  return process.platform === "win32" ? normalized.toLowerCase() : normalized;
}

export function registerRepo(internalAbsPath: string, metadataOrDescription?: RepoMetadata | string): RepoEntry {
  const normalizedPath = normalizeRepoRootPath(internalAbsPath);
  const metadata = typeof metadataOrDescription === "string"
    ? { description: metadataOrDescription }
    : { ...metadataOrDescription };
  const repo_id = `repo-${randomUUID().slice(0, 12)}`;
  const entry: RepoEntry = {
    repo_id,
    internal_abs_path: normalizedPath,
    repo_path: normalizedPath,
    binding_state: "binding_requested",
    registered_at: new Date().toISOString(),
    revoked_at: null,
    metadata,
  };
  catalog.set(repo_id, entry);
  catalogByPathKey.set(repoPathCompareKey(normalizedPath), repo_id);
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

export function getRepoByPath(repoPath: string): RepoEntry | undefined {
  const repoId = catalogByPathKey.get(repoPathCompareKey(repoPath));
  return repoId === undefined ? undefined : catalog.get(repoId);
}

export function isRepoBound(repo_id: string): boolean {
  return catalog.get(repo_id)?.binding_state === "bound";
}

export function clearCatalog(): void {
  catalog.clear();
  catalogByPathKey.clear();
}
