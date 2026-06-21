# EXEC-006：仓库绑定、快照创建入口与 Manifest 清单

状态：ready_for_ai_execution（可由 AI 执行）。
依赖：EXEC-005 complete（完成）。

## 1. Objective（目标）

实现单仓库绑定、快照创建入口和不可变 manifest（清单），但不实现文本/符号索引。

## 2. Scope（范围）

Allowed files（允许修改）：
- `implementation/src/repo/repo-catalog.ts`
- `implementation/src/snapshot/manifest.ts`
- `implementation/src/snapshot/snapshot-registry.ts`
- `implementation/src/snapshot/snapshot-ingest.ts`
- `implementation/tests/snapshot-manifest.test.ts`
- `implementation/fixtures/safe-repo/README.md`
- `implementation/docs/snapshot-manifest-contract.md`

Forbidden changes（禁止）：
- 不读取用户真实仓库；只使用 fixture。
- 不实现索引器。
- 不执行仓库代码。

## 必交产物（Required Deliverables）

Primary deliverables（主产物；路径相对本项目根目录）：
- implementation/src/repo/repo-catalog.ts
- implementation/src/snapshot/manifest.ts
- implementation/src/snapshot/snapshot-registry.ts
- implementation/src/snapshot/snapshot-ingest.ts
- implementation/tests/snapshot-manifest.test.ts
- implementation/fixtures/safe-repo/README.md
- implementation/docs/snapshot-manifest-contract.md

Closeout deliverables（收口产物；终止状态回写前必须存在）：
- execution-cards/EXEC-006-repo-binding-snapshot-manifest.claude-review/cycle1.input.json
- execution-cards/EXEC-006-repo-binding-snapshot-manifest.claude-review/cycle1.receipt.json
- execution-cards/EXEC-006-repo-binding-snapshot-manifest.claude-review/closure.json
- execution-cards/EXEC-006-repo-binding-snapshot-manifest.claude-review/validator_result.json
- execution-cards/EXEC-006-repo-binding-snapshot-manifest.claude-review/handshake.json（仅整卡委派给子代理执行时必须先创建）

Artifact existence validation（产物存在性校验）：
- 终止状态回写前，执行器必须用 `Test-Path` 或等效方法确认每个必交产物存在。
- required artifact path missing（必交产物路径缺失）、路径仍为通配符且未列出实际文件、或产物无法从证据追踪时，不得写 `complete`（完成）。
## 3. Required Work（必须执行）

- 实现 repo binding 状态：`unbound -> binding_requested -> bound -> revoked`。
- 实现 snapshot lifecycle 到 manifest ready：`snapshot_requested -> manifest_building -> filtering -> manifest_ready -> expired/revoked`。
- 实现 `snapshot-ingest` 开发入口，仅允许 fixture 路径。
- manifest 包含相对路径、文件哈希、字节数、行数、语言、敏感检测状态、索引准入状态、manifest_hash。
- 创建 fixture specification（测试夹具规格）：至少 3 层目录、2 种语言、`.env` 样本、`.git` 样本、二进制样本、大文件样本、提示注入样本、符号定义样本。

## 4. Acceptance Criteria（验收标准）

- AC-001：fixture 内容相同时可生成稳定 `manifest_hash`，但每次 snapshot refresh（快照刷新）必须生成新的 `snapshot_id`，不得复用旧快照标识。
- AC-002：manifest 不包含绝对路径。
- AC-003：expired/revoked 快照被拒绝。
- AC-004：fixture 规格完整，供 EXEC-007 到 EXEC-009 复用。

## 5. Validation（校验）

Commands（命令）：
- `npm test -- snapshot-manifest`
- `npm run typecheck`

## 6. Required Evidence（所需证据）

- manifest 样本。
- fixture 规格。
- 过期/撤销快照拒绝测试。

## 7. Completion Writeback（完成回写）

changed files:
- implementation/src/repo/repo-catalog.ts
- implementation/src/snapshot/manifest.ts
- implementation/src/snapshot/snapshot-registry.ts
- implementation/src/snapshot/snapshot-ingest.ts
- implementation/tests/snapshot-manifest.test.ts
- implementation/fixtures/safe-repo/README.md
- implementation/docs/snapshot-manifest-contract.md

created artifacts:
- list actual files
- execution-cards/EXEC-006-repo-binding-snapshot-manifest.claude-review/cycle1.input.json
- execution-cards/EXEC-006-repo-binding-snapshot-manifest.claude-review/cycle1.receipt.json
- execution-cards/EXEC-006-repo-binding-snapshot-manifest.claude-review/closure.json
- execution-cards/EXEC-006-repo-binding-snapshot-manifest.claude-review/validator_result.json
- execution-cards/EXEC-006-repo-binding-snapshot-manifest.claude-review/handshake.json（仅整卡委派给子代理时）

validation commands:
- list exact commands

validation results, including exit code:
- include summary and exit code

skipped validations and reason:
- real user repository ingest skipped unless explicitly authorized

protected files unchanged:
- confirm no real user repo was read

remaining blockers:
- list blockers or none

completion status:
- complete | blocked | failed

## 8. Non-Completion Rule（非完成规则）

通用规则：required artifact path missing（必交产物路径缺失）、终止状态缺少 Claude closeout（Claude 收口复核）侧车证据、`validate_closure.py` 未通过、或 Claude 候选问题未分类时，不得写 `complete`（完成）。

未定义快照创建入口、manifest 或 fixture 规格时，不得写 `complete`（完成）。

## 9. Immutability Addendum（不可变快照补充）

本卡必须把快照不可变性写成硬约束：

- manifest（清单）必须包含 `repo_id`、`created_at`、`source_root_hash`、`manifest_hash`、`index_version`、`policy_version`、`expires_at`、`excluded_files`。
- 快照刷新必须创建新的 `snapshot_id`，不得原地修改旧快照含义。
- expired（过期）/revoked（撤销）快照必须拒绝所有工具调用。
- 撤销或过期后必须触发索引和缓存清理记录；若清理无法完成，任务写 blocked（阻塞）而不是 complete（完成）。
- 四个工具必须使用同一 `snapshot_id`；混用不同快照必须在工具或 policy 层拒绝。

额外验收：
- 对同一 fixture 两次快照刷新产生不同 snapshot_id。
- 旧 snapshot_id 被撤销后无法查询。
- mixed snapshot 请求返回结构化错误。
## Claude Closeout Review（终止回写前外部复核）

- 在写入 `complete`、`blocked`、`failed` 或 `aborted` 等终止状态前，必须调用 `claude-taskcard-review`（Claude 任务卡复核）并把输入、回执、`closure`（收口）和 `validator_result`（校验结果）写入同名 `.claude-review` 侧车目录。
- `closure.json` 必须通过 `$CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py`；若 `CODEX_HOME` 不可用，必须记录解析到的脚本路径或阻塞原因。
- `Claude findings`（Claude 候选问题）只作为 `advisory`（建议性）证据；执行器必须把每个候选问题分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`，并写明本地证据。
- `complete`（完成）要求最新 Claude receipt（回执）为 `call_status=ok`、所有 `accepted_blocking` 已解决、`validate_closure.py` 报告可写完成；否则只能按本地证据写 `blocked`、`failed` 或 `aborted`。
- 若整卡委派给子代理执行，子代理在业务工作前必须先写 `execution-cards/EXEC-006-repo-binding-snapshot-manifest.claude-review/handshake.json`，且其中 `agent_role` 必须是 `executor`（执行者）。
