/**
 * Server configuration — single source of truth for all bounds and defaults.
 * All values here derive from task-card.md security invariants and tool-schemas.json.
 */

export const CONFIG = {
  server: {
    name: "chatgpt-local-repo-001",
    version: "0.1.0",
    transport: "streamable-http" as const,
    port: 3100,
    host: "127.0.0.1",
  },

  tools: {
    /** All tools are read-only from the connector caller's perspective; this is enforced server-side, not by annotation hints. */
    readOnlyHint: true as const,
    destructiveHint: false as const,
    openWorldHint: false as const,

    list: {
      name: "repo.list" as const,
      title: "Repository List",
      description:
        "List configured repository names and exact repository paths. Use repo_path from this list when calling repository read tools.",
    },

    search: {
      name: "repo.search" as const,
      title: "Repository Search",
      description:
        "Search within an authorized immutable repository snapshot and return bounded code hits with provenance. Rejects sensitive files, accepts only snapshot-relative paths, and enforces budget limits.",
      queryMaxLength: 512,
      defaultLimit: 10,
      maxLimit: 20,
    },

    fetch: {
      name: "repo.fetch" as const,
      title: "Repository Fetch Segment",
      description:
        "Fetch a bounded line segment from an authorized immutable repository snapshot. Rejects absolute paths, parent-directory traversal, symlink escapes, and sensitive files.",
      pathMaxLength: 512,
      purposeMaxLength: 256,
    },

    tree: {
      name: "repo.tree" as const,
      title: "Repository Tree",
      description:
        "List a bounded directory tree from an authorized immutable repository snapshot. Depth and entry count are capped; sensitive paths are excluded from output.",
      defaultDepth: 2,
      maxDepth: 4,
      defaultLimit: 100,
      maxLimit: 200,
    },

    symbols: {
      name: "repo.symbols" as const,
      title: "Repository Symbols",
      description:
        "Find symbol definitions in an authorized immutable repository snapshot. First version: definitions only (no references, usages, or cross-file call graphs).",
      queryMaxLength: 256,
      defaultLimit: 20,
      maxLimit: 50,
    },

    refresh: {
      name: "repo.refresh" as const,
      title: "Repository Refresh Snapshot",
      description:
        "Refresh the authorized repository snapshot and indexes on demand. Builds the new snapshot first, then switches runtime state only after the refresh succeeds.",
      reasonMaxLength: 256,
    },
  },

  /** Budget defaults — all enforced server-side, never trusted from hints. */
  budget: {
    singleResponseMaxBytes: 64 * 1024, // 64 KiB
    singleFileLineWindowMax: 200,
    sessionTotalBytes: 2 * 1024 * 1024, // 2 MiB
    grantTotalBytes: 10 * 1024 * 1024, // 10 MiB
    toolCallCount: 500,
    treeMaxDepth: 4,
    searchHitMax: 20,
    symbolHitMax: 50,
    throttleWindowMs: 60_000,
    throttleMaxCalls: 60, // per window
  },

  /** Policy version — must increment on any policy or schema change. */
  policyVersion: "policy-2026-06-21-v1",

  /** Content origin and trust markers for prompt-injection isolation (§17.5). */
  contentOrigin: "repository_snapshot" as const,
  instructionTrust: "untrusted" as const,
} as const;
