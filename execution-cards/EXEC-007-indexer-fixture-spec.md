# EXEC-007：隔离索引器与文本/符号索引

状态：ready_for_ai_execution（可由 AI 执行）。
依赖：EXEC-006 complete（完成）。

## 1. Objective（目标）

在不可变 manifest 基础上实现隔离文本索引和符号定义索引，为只读工具提供查询事实源。

## 2. Scope（范围）

Allowed files（允许修改）：
- `implementation/src/indexer/indexer.ts`
- `implementation/src/indexer/text-index.ts`
- `implementation/src/indexer/symbol-index.ts`
- `implementation/tests/indexer.test.ts`
- `implementation/docs/indexer-isolation-contract.md`
- `implementation/fixtures/safe-repo/**`

Forbidden changes（禁止）：
- 不执行仓库代码、构建脚本、宏、插件、语言服务器扩展。
- 不访问网络。
- 不读取 manifest 以外路径。

## 必交产物（Required Deliverables）

Primary deliverables（主产物；路径相对本项目根目录）：
- implementation/src/indexer/indexer.ts
- implementation/src/indexer/text-index.ts
- implementation/src/indexer/symbol-index.ts
- implementation/tests/indexer.test.ts
- implementation/docs/indexer-isolation-contract.md
- implementation/fixtures/safe-repo/**

Closeout deliverables（收口产物；终止状态回写前必须存在）：
- execution-cards/EXEC-007-indexer-fixture-spec.claude-review/cycle1.input.json
- execution-cards/EXEC-007-indexer-fixture-spec.claude-review/cycle1.receipt.json
- execution-cards/EXEC-007-indexer-fixture-spec.claude-review/closure.json
- execution-cards/EXEC-007-indexer-fixture-spec.claude-review/validator_result.json
- execution-cards/EXEC-007-indexer-fixture-spec.claude-review/handshake.json（仅整卡委派给子代理执行时必须先创建）

Artifact existence validation（产物存在性校验）：
- 终止状态回写前，执行器必须用 `Test-Path` 或等效方法确认每个必交产物存在。
- required artifact path missing（必交产物路径缺失）、路径仍为通配符且未列出实际文件、或产物无法从证据追踪时，不得写 `complete`（完成）。
## 3. Required Work（必须执行）

- 索引器只接受 manifest 中准入文件。
- 文本索引支持搜索命中、路径、行号、snippet。
- 符号索引第一版只支持 definitions（定义）。
- 解析失败返回 `index_failed` 或 `unsupported_file_type`，不得绕过安全策略。
- 索引器超时、文件大小、数量上限可配置。

## 4. Acceptance Criteria（验收标准）

- AC-001：文本索引正例命中 fixture 标准答案。
- AC-002：符号定义正例命中 fixture 标准答案。
- AC-003：敏感文件不进入索引。
- AC-004：索引器不读取 manifest 外路径，不访问网络，不执行代码。

## 5. Validation（校验）

Commands（命令）：
- `npm test -- indexer`
- `npm run typecheck`

## 6. Required Evidence（所需证据）

- 文本索引样本。
- 符号索引样本。
- 敏感文件排除样本。

## 7. Completion Writeback（完成回写）

changed files:
- implementation/src/indexer/indexer.ts
- implementation/src/indexer/text-index.ts
- implementation/src/indexer/symbol-index.ts
- implementation/tests/indexer.test.ts
- implementation/docs/indexer-isolation-contract.md
- implementation/fixtures/safe-repo/**

created artifacts:
- list actual files
- execution-cards/EXEC-007-indexer-fixture-spec.claude-review/cycle1.input.json
- execution-cards/EXEC-007-indexer-fixture-spec.claude-review/cycle1.receipt.json
- execution-cards/EXEC-007-indexer-fixture-spec.claude-review/closure.json
- execution-cards/EXEC-007-indexer-fixture-spec.claude-review/validator_result.json
- execution-cards/EXEC-007-indexer-fixture-spec.claude-review/handshake.json（仅整卡委派给子代理时）

validation commands:
- list exact commands

validation results, including exit code:
- include summary and exit code

skipped validations and reason:
- list skipped checks

protected files unchanged:
- confirm no real repo source was read

remaining blockers:
- list blockers or none

completion status:
- complete | blocked | failed

## 8. Non-Completion Rule（非完成规则）

通用规则：required artifact path missing（必交产物路径缺失）、终止状态缺少 Claude closeout（Claude 收口复核）侧车证据、`validate_closure.py` 未通过、或 Claude 候选问题未分类时，不得写 `complete`（完成）。

索引器能访问 manifest 外路径、执行代码、访问网络或索引敏感文件时，不得写 `complete`（完成）。

## 9. Isolation Addendum（隔离补充）

本卡必须把索引器隔离落成可验证要求：

- 索引器必须低权限运行；若当前平台无法自动创建低权限用户，必须在文档中写 blocked（阻塞）或手工配置步骤。
- 索引器不得挂载用户 home（家目录）、SSH（安全外壳）目录、云凭据目录或执行根目录外路径。
- 索引器不得访问网络；如测试环境无法证明无网络，必须记录 skipped validation（跳过校验）和剩余风险。
- 索引器必须有超时、内存、文件数量、单文件大小限制。
- 索引器不得执行仓库脚本、宏、插件、语言服务器扩展、测试命令或包安装。

额外验收：
- fixture 中存在诱导执行脚本，索引器不执行。
- fixture 中存在模拟 SSH/cloud credential 路径，索引器拒绝。
- 超大文件触发拒绝或跳过，并记录原因。
## Claude Closeout Review（终止回写前外部复核）

- 在写入 `complete`、`blocked`、`failed` 或 `aborted` 等终止状态前，必须调用 `claude-taskcard-review`（Claude 任务卡复核）并把输入、回执、`closure`（收口）和 `validator_result`（校验结果）写入同名 `.claude-review` 侧车目录。
- `closure.json` 必须通过 `$CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py`；若 `CODEX_HOME` 不可用，必须记录解析到的脚本路径或阻塞原因。
- `Claude findings`（Claude 候选问题）只作为 `advisory`（建议性）证据；执行器必须把每个候选问题分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`，并写明本地证据。
- `complete`（完成）要求最新 Claude receipt（回执）为 `call_status=ok`、所有 `accepted_blocking` 已解决、`validate_closure.py` 报告可写完成；否则只能按本地证据写 `blocked`、`failed` 或 `aborted`。
- 若整卡委派给子代理执行，子代理在业务工作前必须先写 `execution-cards/EXEC-007-indexer-fixture-spec.claude-review/handshake.json`，且其中 `agent_role` 必须是 `executor`（执行者）。
