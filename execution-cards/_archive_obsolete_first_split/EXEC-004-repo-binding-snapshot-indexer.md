# EXEC-004：仓库绑定、快照清单与隔离索引

状态：ready_for_ai_execution（可由 AI 执行）。
依赖：EXEC-003 complete（完成）。

## 1. Objective（目标）

实现单仓库绑定、不可变快照清单和安全索引流程，为后续只读工具提供统一 `snapshot_id`（快照标识）事实源。

## 2. Scope（范围）

Allowed files（允许修改）：
- `implementation/src/repo/repo-catalog.ts`
- `implementation/src/snapshot/manifest.ts`
- `implementation/src/snapshot/snapshot-registry.ts`
- `implementation/src/indexer/indexer.ts`
- `implementation/src/indexer/text-index.ts`
- `implementation/src/indexer/symbol-index.ts`
- `implementation/tests/snapshot-indexer.test.ts`
- `implementation/fixtures/safe-repo/**`
- `implementation/docs/snapshot-manifest-contract.md`

Forbidden changes（禁止）：
- 不索引用户真实仓库；只使用测试 fixture（测试夹具）。
- 不执行仓库代码、构建脚本、宏、插件、语言服务器扩展。
- 不访问网络。
- 不读取执行根目录外路径。

## 3. Required Work（必须执行）

- 实现 repo binding（仓库绑定）对象：`unbound -> binding_requested -> bound -> revoked`。
- 实现 snapshot lifecycle（快照生命周期）：`snapshot_requested -> manifest_building -> filtering -> indexing -> ready -> expired/revoked`。
- 生成 manifest（清单）：相对路径、文件哈希、字节数、行数、语言、敏感检测状态、索引准入状态、manifest_hash。
- 索引器只处理 fixture（测试夹具）快照，且不执行代码。
- `repo.tree/search/symbols/fetch` 未来都必须基于同一 manifest（清单）。

## 4. Acceptance Criteria（验收标准）

- AC-001：fixture 快照生成稳定 `snapshot_id` 和 `manifest_hash`。
- AC-002：旧快照 expired/revoked 后查询接口返回拒绝状态。
- AC-003：符号索引失败时不会绕过策略，返回 `index_failed` 或 `unsupported_file_type`。
- AC-004：测试证明索引器不读取 fixture 外路径。

## 5. Validation（校验）

Commands（命令）：
- `npm test -- snapshot-indexer`
- `npm run typecheck`

## 6. Required Evidence（所需证据）

- manifest（清单）样本。
- 快照状态转换测试。
- 越界路径拒绝测试。

## 7. Completion Writeback（完成回写）

changed files:
- implementation/src/repo/repo-catalog.ts
- implementation/src/snapshot/manifest.ts
- implementation/src/snapshot/snapshot-registry.ts
- implementation/src/indexer/indexer.ts
- implementation/src/indexer/text-index.ts
- implementation/src/indexer/symbol-index.ts
- implementation/tests/snapshot-indexer.test.ts
- implementation/fixtures/safe-repo/**
- implementation/docs/snapshot-manifest-contract.md

created artifacts:
- list actual files

validation commands:
- list exact commands

validation results, including exit code:
- include summary and exit code

skipped validations and reason:
- list skipped checks

protected files unchanged:
- confirm no real user repo was read

remaining blockers:
- list blockers or none

completion status:
- complete | blocked | failed

## 8. Non-Completion Rule（非完成规则）

如果索引器能读取 fixture 外路径、执行代码或混读实时目录，不得写 complete（完成）。
