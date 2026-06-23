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

    apiTool: {
      name: "api_tool" as const,
      title: "Read Code API Tool",
      description:
        "Backward-compatible read-only wrapper for older ChatGPT connectors that call read_code/api_tool. If unsure how to begin, call with no arguments to get a usage guide and repository list. Prefer direct repo_* tools when available. Set tool, name, operation, or action to one of repo_list, repo_files, repo_search, repo_fetch, repo_tree, repo_symbols, or repo_refresh; pass tool arguments in arguments, args, params, input, or top-level fields.",
    },

    readCode: {
      name: "read_code" as const,
      title: "Read Code Compatibility",
      description:
        "Backward-compatible read-only wrapper for ChatGPT conversations that expect a read_code entry. If unsure how to begin, call with no arguments to get a usage guide and repository list. Prefer direct repo_* tools when available. Set tool, name, operation, or action to one of repo_list, repo_files, repo_search, repo_fetch, repo_tree, repo_symbols, or repo_refresh; pass tool arguments in arguments, args, params, input, or top-level fields.",
    },

    list: {
      name: "repo_list" as const,
      title: "Repository List",
      description:
        "List configured repositories with names, descriptions, exact repository paths, lightweight summaries, and the first-use guide. Use this first when multiple repositories are available, when you need the exact repo_path, or when connector usage is unclear.",
    },

    search: {
      name: "repo_search" as const,
      title: "Repository Search",
      description:
        "Search indexed text, config, docs, and error strings within an authorized immutable repository snapshot. Use repo_files first when paths are unclear or a large repository may contain fetchable files that are not indexed. If only one repository is configured, repo_path may be omitted; otherwise use a repo_path from repo_list.",
      queryMaxLength: 512,
      defaultLimit: 10,
      maxLimit: 20,
    },

    files: {
      name: "repo_files" as const,
      title: "Repository Files",
      description:
        "List a paginated file map from an authorized immutable repository snapshot without returning file contents. Use this to discover whether files exist, are fetchable, are indexed for search, or were excluded before calling repo_fetch.",
      prefixMaxLength: 512,
      filterMaxItems: 20,
      cursorMaxLength: 2048,
      defaultLimit: 100,
      maxLimit: 500,
    },

    fetch: {
      name: "repo_fetch" as const,
      title: "Repository Fetch Segment",
      description:
        "Fetch a bounded line segment from a known file path. Use this after repo_files, repo_search, repo_symbols, or a targeted repo_tree identifies the file. Rejects absolute paths, parent-directory traversal, symlink escapes, and sensitive files. If only one repository is configured, repo_path may be omitted; otherwise use a repo_path from repo_list.",
      pathMaxLength: 512,
      purposeMaxLength: 256,
    },

    tree: {
      name: "repo_tree" as const,
      title: "Repository Tree",
      description:
        "List a small, bounded directory summary for navigation only. Use this when the user asks about project layout or a specific directory; prefer repo_files, repo_search, or repo_symbols for finding code. If only one repository is configured, repo_path may be omitted; otherwise use a repo_path from repo_list.",
      defaultDepth: 1,
      maxDepth: 4,
      defaultLimit: 50,
      maxLimit: 200,
    },

    symbols: {
      name: "repo_symbols" as const,
      title: "Repository Symbols",
      description:
        "Find class, function, and other lightweight symbol definitions. Prefer this first when the user asks where a symbol is defined. First version: definitions only (no references, usages, or cross-file call graphs). If only one repository is configured, repo_path may be omitted; otherwise use a repo_path from repo_list.",
      queryMaxLength: 256,
      defaultLimit: 20,
      maxLimit: 50,
    },

    refresh: {
      name: "repo_refresh" as const,
      title: "Repository Refresh Snapshot",
      description:
        "Refresh the authorized repository snapshot and indexes only when the user says the repository changed, results are stale, or a fresh snapshot is needed. Builds the new snapshot first, then switches runtime state only after the refresh succeeds. If only one repository is configured, repo_path may be omitted; otherwise use a repo_path from repo_list.",
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
  policyVersion: "policy-2026-06-22-v4",

  /** Content origin and trust markers for prompt-injection isolation (§17.5). */
  contentOrigin: "repository_snapshot" as const,
  instructionTrust: "untrusted" as const,
} as const;
