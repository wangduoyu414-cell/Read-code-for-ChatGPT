# Snapshot Manifest Contract（快照清单契约）

状态：implemented（已实现）。时间戳：2026-06-21T07:00:00Z。

## Modules
| 模块 | 路径 | 功能 |
|---|---|---|
| Repo Catalog | `src/repo/repo-catalog.ts` | 仓库注册、绑定、撤销 |
| Manifest | `src/snapshot/manifest.ts` | 不可变清单类型、文件哈希、清单哈希 |
| Snapshot Registry | `src/snapshot/snapshot-registry.ts` | 快照生命周期状态机 |
| Snapshot Ingest | `src/snapshot/snapshot-ingest.ts` | 从 fixture 目录创建清单（dev only） |

## States
- Repo: unbound → binding_requested → bound → revoked
- Snapshot: snapshot_requested → manifest_building → filtering → manifest_ready → expired/revoked

## Immutability
- 快照刷新创建新 snapshot_id，不原地修改旧快照
- expired/revoked 快照拒绝所有工具调用
- 查询工具必须使用当前运行时绑定的同一 snapshot_id；`repo.refresh` 成功后切换到新的 snapshot_id

## File Map And Indexing
- `files[]`（文件列表）记录授权快照内可被工具解释的文件，不记录绝对路径。
- `fetchable=true`（可读取）表示 `repo_fetch` 可以在预算和安全检查通过后读取该相对路径。
- `index_admitted=true`（允许索引）表示该文件进入 `repo_search`（搜索）和 `repo_symbols`（符号）的索引。
- `fetchable=true` 且 `index_admitted=false` 的文件可以被 `repo_files`（文件地图）发现并被 `repo_fetch` 读取，但 `repo_search` 可能搜不到。
- `excluded_files[]`（被排除文件）记录未进入可读取文件集的相对路径和原因；`repo_files` 只有在调用方显式请求 `states=["excluded"]` 时返回这些排除条目。
- `repo_fetch` 不得读取 manifest（清单）之外的真实工作目录文件。
