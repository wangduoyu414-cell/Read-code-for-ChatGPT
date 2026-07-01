/**
 * Snapshot Registry — manages snapshot lifecycle.
 * snapshot_requested -> manifest_building -> filtering -> manifest_ready -> expired/revoked
 */

import type { SnapshotManifest } from "./manifest.js";
import type { ErrorCode } from "../errors.js";

export type SnapshotState =
  | "snapshot_requested"
  | "manifest_building"
  | "filtering"
  | "manifest_ready"
  | "expired"
  | "revoked";

export interface SnapshotRecord {
  snapshot_id: string;
  repo_id: string;
  state: SnapshotState;
  manifest?: SnapshotManifest;
  created_at: string;
  expired_at?: string;
  revoked_at?: string;
}

const registry = new Map<string, SnapshotRecord>();

export function requestSnapshot(snapshot_id: string, repo_id: string): SnapshotRecord {
  const rec: SnapshotRecord = { snapshot_id, repo_id, state: "snapshot_requested", created_at: new Date().toISOString() };
  registry.set(snapshot_id, rec);
  return rec;
}

export function transitionState(snapshot_id: string, to: SnapshotState): SnapshotRecord | null {
  const rec = registry.get(snapshot_id);
  if (!rec) return null;
  rec.state = to;
  if (to === "expired") rec.expired_at = new Date().toISOString();
  if (to === "revoked") rec.revoked_at = new Date().toISOString();
  return rec;
}

export function attachManifest(snapshot_id: string, manifest: SnapshotManifest): SnapshotRecord | null {
  const rec = registry.get(snapshot_id);
  if (!rec || rec.state !== "filtering") return null;
  rec.manifest = manifest;
  rec.state = "manifest_ready";
  return rec;
}

export function getSnapshot(snapshot_id: string): SnapshotRecord | undefined {
  return registry.get(snapshot_id);
}

export function isSnapshotReady(snapshot_id: string): boolean {
  return registry.get(snapshot_id)?.state === "manifest_ready";
}

export function rejectIfNotReady(snapshot_id: string): ErrorCode | null {
  const rec = registry.get(snapshot_id);
  if (!rec) return "snapshot_not_ready";
  if (rec.state === "expired") return "snapshot_not_ready";
  if (rec.state === "revoked") return "access_denied";
  if (rec.state !== "manifest_ready") return "snapshot_not_ready";
  return null;
}

export function clearRegistry(): void {
  registry.clear();
}

export function deleteSnapshot(snapshot_id: string): void {
  registry.delete(snapshot_id);
}
