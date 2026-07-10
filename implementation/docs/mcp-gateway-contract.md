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
| `repo.search` | implemented | executes `text`、`symbol` 或 `hybrid` 检索，并返回索引覆盖和限定前缀补扫状态 |
| `repo.fetch` | implemented | 从仍与 manifest（清单）哈希一致、未逃逸的仓库相对普通文件读取有界行范围 |
| `repo.tree` | implemented | lists a small, bounded directory summary for layout or targeted navigation |
| `repo.symbols` | implemented | finds lightweight symbol definitions; references, usages, and call graphs are out of scope |
| `repo.refresh` | implemented | rebuilds the selected authorized snapshot and switches runtime state only after success |

## Annotations (all tools)

- `readOnlyHint`: true
- `destructiveHint`: false
- `openWorldHint`: false

## Tool Descriptor Contract

All public tools declare an object `outputSchema` because every successful and error response returns `structuredContent`. ChatGPT-facing compatibility metadata is mirrored in `_meta`, including `_meta.securitySchemes=[{"type":"noauth"}]`, `_meta.ui.visibility=["model","app"]`, and public OpenAI invocation status text.

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

当文件在快照后发生变更、被替换为符号链接或不能再安全解析到授权根目录时，`repo_fetch`（读取）返回可重试的 `snapshot_stale`（快照过期）错误；调用者必须先使用 `repo_refresh`（刷新）建立新快照，不能把旧搜索命中与新文件正文混用。

## Server Instructions

The server initialization instructions declare repository content as untrusted data and all tools as read-only. There is no full-repository export tool; callers must use file discovery, search, symbols, tree, and targeted fetch operations.

Read-order guidance:

- For a targeted question, prefer `repo.symbols` for definitions or `repo.search` for text/config/docs/errors, then call `repo.fetch` for the smallest useful line range. `repo_search` 的 `coverage`（覆盖）字段会说明全文索引是否部分覆盖；空结果不代表文件不存在。
- For first orientation in an unfamiliar configured repository, call `repo.list` to get the lightweight repository map. Use `repo.tree(path=".", depth=1)` only when directory layout is needed.
- `repo.tree` is not a full repository scan or export tool. It is capped by depth and result limit.
- Use `repo.refresh` only when the user says files changed or earlier results may be stale.
- 本地 `agent`（守护命令）不属于 MCP 工具注册表；它只在用户机器上观察和恢复 MCP/隧道连接。它以绝对 Node（节点运行时）入口兼容 Windows UNC（网络共享）运行目录，拒绝内联凭据，只保存环境变量名称/非机密 profile（配置文件）路径，并仅重启自身启动的子进程；详见 `implementation/docs/agent-supervisor.md`。

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
