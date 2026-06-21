# MCP Gateway Contract（MCP 网关契约）

状态：scaffold（骨架阶段，所有工具返回 not_implemented）。
时间戳：2026-06-21T06:00:00Z。

## Server Identity

- name: `chatgpt-local-repo-001`
- version: `0.1.0`
- transport: `Streamable HTTP` (port 3100, localhost only)
- MCP endpoint: `http://127.0.0.1:3100/mcp`

## Tools

| Tool | Status | Handler |
|---|---|---|
| `repo.search` | scaffold | returns `not_implemented` |
| `repo.fetch` | scaffold | returns `not_implemented` |
| `repo.tree` | scaffold | returns `not_implemented` |
| `repo.symbols` | scaffold | returns `not_implemented` |

## Annotations (all tools)

- `readOnlyHint`: true
- `destructiveHint`: false
- `openWorldHint`: false

## Error Contract

All errors follow docs/design/task-card.md §17.6:
```json
{
  "isError": true,
  "error_code": "internal_error",
  "message": "Tool not yet implemented.",
  "repo_id": "<caller value>",
  "snapshot_id": "<caller value>",
  "policy_version": "policy-2026-06-21-v1",
  "audit_id": "audit-<ts>-<counter>-<uuid8>",
  "retryable": false
}
```

## Server Instructions

The server initialization instructions declare repository content as untrusted data, all tools as read-only, and full-repo export as blocked by budget enforcement.

## Dependency Lock

- `@modelcontextprotocol/sdk` (official, core boundary)
- No `fastmcp`, `mcp-framework`, or third-party MCP frameworks
- `vitest` for testing
- `typescript` ^5.8

## Next Steps

- EXEC-003: wire audit_id, path guards, budget model, error contract
- EXEC-008: replace scaffold handlers with real read-only implementations
