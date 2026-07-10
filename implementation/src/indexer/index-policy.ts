/**
 * Index policy — keeps the expensive full-text/symbol index focused on useful
 * repository material while leaving manifest-admitted files fetchable.
 */

import type { ManifestFile } from "../snapshot/manifest.js";

const CORE_DIRECTORIES = [
  "src",
  "source",
  "lib",
  "app",
  "apps",
  "packages",
  "models",
  "tools",
  "scripts",
  "tests",
  "test",
  "spec",
  "configs",
  "config",
  ".github",
  "docs",
] as const;

const CORE_DIRECTORY_ORDER = new Map<string, number>(CORE_DIRECTORIES.map((name, index) => [name, index]));

const RUNTIME_ARTIFACT_DIRECTORIES = new Set([
  ".pytest_tmp",
  ".pytest-tmp",
  ".pytest_output",
  ".test-results",
  "test-results",
  "playwright-report",
  "allure-results",
]);

const DEFERRED_DIRECTORIES = new Set([
  "reports",
  "report",
  "archive",
  "archives",
  "runs",
  "run",
  "artifacts",
  "logs",
]);

function pathSegments(relativePath: string): string[] {
  return relativePath.split("/").filter(Boolean).map((segment) => segment.toLowerCase());
}

export function defaultIndexRejectReason(relativePath: string): string | undefined {
  const segments = pathSegments(relativePath);
  return segments.some((segment) => RUNTIME_ARTIFACT_DIRECTORIES.has(segment))
    ? "runtime_artifact_default"
    : undefined;
}

export function indexPriority(file: Pick<ManifestFile, "relative_path" | "language">): readonly [number, number, string] {
  const segments = pathSegments(file.relative_path);
  const topLevel = segments[0] ?? "";
  const coreRank = CORE_DIRECTORY_ORDER.get(topLevel);
  if (coreRank !== undefined) return [0, coreRank, file.relative_path.toLowerCase()];

  if (DEFERRED_DIRECTORIES.has(topLevel) || segments.some((segment) => DEFERRED_DIRECTORIES.has(segment))) {
    return [2, 0, file.relative_path.toLowerCase()];
  }

  const rootFile = segments.length <= 1;
  return [rootFile ? 0 : 1, rootFile ? 100 : 50, file.relative_path.toLowerCase()];
}

export function sortIndexCandidates(files: readonly ManifestFile[]): ManifestFile[] {
  return [...files].sort((left, right) => {
    const leftPriority = indexPriority(left);
    const rightPriority = indexPriority(right);
    for (let index = 0; index < leftPriority.length; index += 1) {
      const difference = leftPriority[index]! < rightPriority[index]! ? -1 : leftPriority[index]! > rightPriority[index]! ? 1 : 0;
      if (difference !== 0) return difference;
    }
    return left.relative_path.localeCompare(right.relative_path);
  });
}

export function isCoreRepositoryPath(relativePath: string): boolean {
  const topLevel = pathSegments(relativePath)[0] ?? "";
  return CORE_DIRECTORY_ORDER.has(topLevel);
}

export function isDeferredRepositoryPath(relativePath: string): boolean {
  return pathSegments(relativePath).some((segment) => DEFERRED_DIRECTORIES.has(segment));
}
