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
