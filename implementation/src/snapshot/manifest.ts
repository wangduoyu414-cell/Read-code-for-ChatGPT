/**
 * Snapshot Manifest — immutable inventory of a repository snapshot.
 * Implements §17.2 snapshot manifest and SNAP-001 to SNAP-003.
 */

import { createHash } from "node:crypto";

export interface ManifestFile {
  relative_path: string;
  file_hash: string;
  byte_count: number;
  line_count: number;
  language: string;
  extension: string;
  sensitive_detected: boolean;
  sensitive_reason?: string;
  fetchable: boolean;
  fetch_reject_reason?: string;
  index_admitted: boolean;
  index_reject_reason?: string;
}

export interface SnapshotManifest {
  snapshot_id: string;
  repo_id: string;
  created_at: string;
  source_root_hash: string;
  manifest_hash: string;
  files: ManifestFile[];
  excluded_files: Array<{ relative_path: string; reason: string }>;
  index_version: number;
  policy_version: string;
  expires_at: string;
}

export function computeFileHash(content: string | Buffer): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export function computeManifestHash(manifest: Omit<SnapshotManifest, "manifest_hash">): string {
  const payload = JSON.stringify({
    snapshot_id: manifest.snapshot_id,
    repo_id: manifest.repo_id,
    source_root_hash: manifest.source_root_hash,
    files: manifest.files.map((f) => [f.relative_path, f.file_hash]),
  });
  return createHash("sha256").update(payload).digest("hex").slice(0, 16);
}

export function finalizeManifest(input: Omit<SnapshotManifest, "manifest_hash">): SnapshotManifest {
  return { ...input, manifest_hash: computeManifestHash(input) };
}
