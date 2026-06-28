export interface SnapshotIndexStatus {
  snapshot_id: string;
  indexed_paths: ReadonlySet<string>;
  skipped_paths: ReadonlySet<string>;
  skip_reason_by_path: ReadonlyMap<string, string>;
}

const statusBySnapshot = new Map<string, SnapshotIndexStatus>();

export function setIndexStatus(status: {
  snapshot_id: string;
  indexed_paths: Iterable<string>;
  skipped_paths?: Iterable<string>;
  skip_reason_by_path?: Iterable<[string, string]>;
}): void {
  statusBySnapshot.set(status.snapshot_id, {
    snapshot_id: status.snapshot_id,
    indexed_paths: new Set(status.indexed_paths),
    skipped_paths: new Set(status.skipped_paths ?? []),
    skip_reason_by_path: new Map(status.skip_reason_by_path ?? []),
  });
}

export function getIndexStatus(snapshotId: string): SnapshotIndexStatus | undefined {
  return statusBySnapshot.get(snapshotId);
}

export function isPathIndexed(snapshotId: string, relativePath: string): boolean {
  return statusBySnapshot.get(snapshotId)?.indexed_paths.has(relativePath) === true;
}

export function indexSkipReason(snapshotId: string, relativePath: string): string | undefined {
  return statusBySnapshot.get(snapshotId)?.skip_reason_by_path.get(relativePath);
}

export function clearIndexStatus(): void {
  statusBySnapshot.clear();
}
