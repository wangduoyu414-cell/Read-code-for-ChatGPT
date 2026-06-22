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
        "List configured repositories with names, descriptions, exact repository paths, and lightweight summaries. Use this when multiple repositories are available or when you need the exact repo_path.",
    },

    search: {
      name: "repo.search" as const,
      title: "Repository Search",
      description:
        "Search text, config, docs, and error strings within an authorized immutable repository snapshot. Prefer this before repo.tree when you know what text to find. If only one repository is configured, repo_path may be omitted; otherwise use a repo_path from repo.list.",
      queryMaxLength: 512,
      defaultLimit: 10,
      maxLimit: 20,
    },

    fetch: {
      name: "repo.fetch" as const,
      title: "Repository Fetch Segment",
      description:
        "Fetch a bounded line segment from a known file path. Use this after repo.search, repo.symbols, or a targeted repo.tree identifies the file. Rejects absolute paths, parent-directory traversal, symlink escapes, and sensitive files. If only one repository is configured, repo_path may be omitted; otherwise use a repo_path from repo.list.",
      pathMaxLength: 512,
      purposeMaxLength: 256,
    },

    tree: {
      name: "repo.tree" as const,
      title: "Repository Tree",
      description:
        "List a small, bounded directory summary for navigation only. Use this when the user asks about project layout or a specific directory; prefer repo.search or repo.symbols for finding code. If only one repository is configured, repo_path may be omitted; otherwise use a repo_path from repo.list.",
      defaultDepth: 1,
      maxDepth: 4,
      defaultLimit: 50,
      maxLimit: 200,
    },

    symbols: {
      name: "repo.symbols" as const,
      title: "Repository Symbols",
      description:
        "Find class, function, and other lightweight symbol definitions. Prefer this first when the user asks where a symbol is defined. First version: definitions only (no references, usages, or cross-file call graphs). If only one repository is configured, repo_path may be omitted; otherwise use a repo_path from repo.list.",
      queryMaxLength: 256,
      defaultLimit: 20,
      maxLimit: 50,
    },

    refresh: {
      name: "repo.refresh" as const,
      title: "Repository Refresh Snapshot",
      description:
        "Refresh the authorized repository snapshot and indexes only when the user says the repository changed, results are stale, or a fresh snapshot is needed. Builds the new snapshot first, then switches runtime state only after the refresh succeeds. If only one repository is configured, repo_path may be omitted; otherwise use a repo_path from repo.list.",
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
