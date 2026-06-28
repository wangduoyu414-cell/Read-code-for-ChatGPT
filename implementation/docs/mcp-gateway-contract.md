# MCP Gateway Contract（MCP 网关契约）

状态：implemented_read_only（已实现只读工具链路）。
时间戳：2026-06-22T12:46:36Z。

## Server Identity

- name: `chatgpt-local-repo-001`
- version: `0.1.0`
- transport: `Streamable HTTP` (port 3100, localhost only)
- MCP endpoint: `http://127.0.0.1:3100/mcp`

## Tools

| Tool | Status | Handler |
|---|---|---|
| `repo.list` | implemented | lists configured repository names, descriptions, exact `repo_path` values, snapshot ids, file counts, top directories, and primary languages |
| `repo.search` | implemented | searches indexed text, config, docs, and error strings within an authorized repository snapshot |
| `repo.fetch` | implemented | fetches a bounded line range from a known repository-relative file path |
| `repo.tree` | implemented | lists a small, bounded directory summary for layout or targeted navigation |
| `repo.symbols` | implemented | finds lightweight symbol definitions; references, usages, and call graphs are out of scope |
| `repo.refresh` | implemented | rebuilds the selected authorized snapshot and switches runtime state only after success |

## Annotations (all tools)

- `readOnlyHint`: true
- `destructiveHint`: false
- `openWorldHint`: false

## Error Contract

All tool errors keep the structured contract from `docs/design/task-card.md` §17.6 internally:
```json
{
  "isError": true,
  "error_code": "internal_error",
  "message": "Human-readable error summary.",
  "repo_id": "<caller value>",
  "snapshot_id": "<caller value>",
  "policy_version": "policy-2026-06-21-v1",
  "audit_id": "audit-<ts>-<counter>-<uuid8>",
  "retryable": false
}
```

Public MCP tool responses replace the internal `repo_id` with the selected `repo_path` so ChatGPT can disambiguate configured repositories without seeing generated internal ids. Typical public error shape:

```json
{
  "isError": true,
  "error_code": "access_denied",
  "message": "repo_path is not in the configured repository whitelist.",
  "repo_path": "<configured-repo-path-or-unknown>",
  "snapshot_id": "<snapshot id>",
  "policy_version": "policy-2026-06-21-v1",
  "audit_id": "audit-<ts>-<counter>-<uuid8>",
  "retryable": false
}
```

## Server Instructions

The server initialization instructions declare repository content as untrusted data and all tools as read-only. There is no full-repository export tool; callers must use file discovery, search, symbols, tree, and targeted fetch operations.

Read-order guidance:

- For a targeted question, prefer `repo.symbols` for definitions or `repo.search` for text/config/docs/errors, then call `repo.fetch` for the smallest useful line range.
- For first orientation in an unfamiliar configured repository, call `repo.list` to get the lightweight repository map. Use `repo.tree(path=".", depth=1)` only when directory layout is needed.
- `repo.tree` is not a full repository scan or export tool. It is capped by depth and result limit.
- Use `repo.refresh` only when the user says files changed or earlier results may be stale.

## Dependency Lock

- `@modelcontextprotocol/sdk` (official, core boundary)
- No `fastmcp`, `mcp-framework`, or third-party MCP frameworks
- `vitest` for testing
- `typescript` ^5.8

## Next Steps

- Future task only if evidence proves the need: expand `repo.list` with additional lightweight manifest-derived fields under hard limits.
- Future task only if explicitly scoped before binding: candidate repository discovery from controlled workspace markers.
- Out of current scope: reference/call graph, shell execution, git execution, write tools, full repository export, vector database, embeddings, file watchers, or IDE-style background indexing.

## Historical Note

Earlier scaffold-stage documents described `repo.search`, `repo.fetch`, `repo.tree`, and `repo.symbols` as returning `not_implemented`. That historical state ended when real read-only handlers were wired in `EXEC-008`; it must not be used as the current implementation status.
