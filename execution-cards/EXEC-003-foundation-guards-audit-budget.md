# EXEC-003：横切基础守卫、错误契约、预算模型与最小审计

状态：ready_for_ai_execution（可由 AI 执行）。
依赖：EXEC-002 complete（完成）。

## 1. Objective（目标）

在任何仓库读取工具实现前，建立最小横切安全基础：`audit_id`（审计标识）生成、统一错误对象、路径守卫接口、预算模型接口、敏感过滤接口。此卡只做接口和基础负例，不读取真实仓库。

## 2. Scope（范围）

Allowed files（允许修改）：
- `implementation/src/errors.ts`
- `implementation/src/audit/audit-id.ts`
- `implementation/src/security/path-guard.ts`
- `implementation/src/security/budget.ts`
- `implementation/src/security/redaction.ts`
- `implementation/src/security/secret-scanner.ts`
- `implementation/src/policy/policy-types.ts`
- `implementation/tests/foundation-guards.test.ts`
- `implementation/docs/foundation-guard-contract.md`

Forbidden changes（禁止）：
- 不实现完整工具。
- 不读取用户仓库。
- 不记录代码正文或提示词。

## 必交产物（Required Deliverables）

Primary deliverables（主产物；路径相对本项目根目录）：
- implementation/src/errors.ts
- implementation/src/audit/audit-id.ts
- implementation/src/security/path-guard.ts
- implementation/src/security/budget.ts
- implementation/src/security/redaction.ts
- implementation/src/security/secret-scanner.ts
- implementation/src/policy/policy-types.ts
- implementation/tests/foundation-guards.test.ts
- implementation/docs/foundation-guard-contract.md

Closeout deliverables（收口产物；终止状态回写前必须存在）：
- execution-cards/EXEC-003-foundation-guards-audit-budget.claude-review/cycle1.input.json
- execution-cards/EXEC-003-foundation-guards-audit-budget.claude-review/cycle1.receipt.json
- execution-cards/EXEC-003-foundation-guards-audit-budget.claude-review/closure.json
- execution-cards/EXEC-003-foundation-guards-audit-budget.claude-review/validator_result.json
- execution-cards/EXEC-003-foundation-guards-audit-budget.claude-review/handshake.json（仅整卡委派给子代理执行时必须先创建）

Artifact existence validation（产物存在性校验）：
- 终止状态回写前，执行器必须用 `Test-Path` 或等效方法确认每个必交产物存在。
- required artifact path missing（必交产物路径缺失）、路径仍为通配符且未列出实际文件、或产物无法从证据追踪时，不得写 `complete`（完成）。
## 3. Required Work（必须执行）

- 定义统一错误响应结构，包含 `isError`、`error_code`、`message`、`repo_id`、`snapshot_id`、`policy_version`、`audit_id`、`retryable`。
- 实现 `audit_id` 生成器和最小审计事件类型。
- 实现 path guard（路径守卫）接口和基础拒绝测试。
- 实现 budget model（预算模型）接口：单响应、单会话、单授权、调用次数、命中数、树深。
- 实现 redaction/secret scanner（脱敏/敏感扫描）接口和默认拒绝语义。

## 4. Acceptance Criteria（验收标准）

- AC-001：错误响应契约可被所有后续卡复用。
- AC-002：路径守卫基础负例返回结构化拒绝和 `audit_id`。
- AC-003：预算模型能在测试中触发 `budget_exceeded`。
- AC-004：敏感扫描不确定样本默认拒绝。

## 5. Validation（校验）

Commands（命令）：
- `npm test -- foundation-guards`
- `npm run typecheck`

## 6. Required Evidence（所需证据）

- 错误响应样本。
- 预算拒绝样本。
- 路径拒绝样本。

## 7. Completion Writeback（完成回写）

changed files:
- implementation/src/errors.ts
- implementation/src/audit/audit-id.ts
- implementation/src/security/path-guard.ts
- implementation/src/security/budget.ts
- implementation/src/security/redaction.ts
- implementation/src/security/secret-scanner.ts
- implementation/src/policy/policy-types.ts
- implementation/tests/foundation-guards.test.ts
- implementation/docs/foundation-guard-contract.md

created artifacts:
- list actual files
- execution-cards/EXEC-003-foundation-guards-audit-budget.claude-review/cycle1.input.json
- execution-cards/EXEC-003-foundation-guards-audit-budget.claude-review/cycle1.receipt.json
- execution-cards/EXEC-003-foundation-guards-audit-budget.claude-review/closure.json
- execution-cards/EXEC-003-foundation-guards-audit-budget.claude-review/validator_result.json
- execution-cards/EXEC-003-foundation-guards-audit-budget.claude-review/handshake.json（仅整卡委派给子代理时）

validation commands:
- list exact commands

validation results, including exit code:
- include summary and exit code

skipped validations and reason:
- list skipped checks

protected files unchanged:
- confirm no user repository source was read

remaining blockers:
- list blockers or none

completion status:
- complete | blocked | failed

## 8. Non-Completion Rule（非完成规则）

通用规则：required artifact path missing（必交产物路径缺失）、终止状态缺少 Claude closeout（Claude 收口复核）侧车证据、`validate_closure.py` 未通过、或 Claude 候选问题未分类时，不得写 `complete`（完成）。

如果后续工具无法复用统一错误、预算、路径守卫或 audit_id，不得写 `complete`（完成）。
## Claude Closeout Review（终止回写前外部复核）

- 在写入 `complete`、`blocked`、`failed` 或 `aborted` 等终止状态前，必须调用 `claude-taskcard-review`（Claude 任务卡复核）并把输入、回执、`closure`（收口）和 `validator_result`（校验结果）写入同名 `.claude-review` 侧车目录。
- `closure.json` 必须通过 `$CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py`；若 `CODEX_HOME` 不可用，必须记录解析到的脚本路径或阻塞原因。
- `Claude findings`（Claude 候选问题）只作为 `advisory`（建议性）证据；执行器必须把每个候选问题分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`，并写明本地证据。
- `complete`（完成）要求最新 Claude receipt（回执）为 `call_status=ok`、所有 `accepted_blocking` 已解决、`validate_closure.py` 报告可写完成；否则只能按本地证据写 `blocked`、`failed` 或 `aborted`。
- 若整卡委派给子代理执行，子代理在业务工作前必须先写 `execution-cards/EXEC-003-foundation-guards-audit-budget.claude-review/handshake.json`，且其中 `agent_role` 必须是 `executor`（执行者）。
