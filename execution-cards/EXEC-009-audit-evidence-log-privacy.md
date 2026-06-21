# EXEC-009：结构化审计、日志隐私与证据包

状态：ready_for_ai_execution（可由 AI 执行）。
依赖：EXEC-008 complete（完成）。

## 1. Objective（目标）

实现完整结构化审计、日志隐私和证据包生成，使所有工具成功、拒绝、截断、预算耗尽和提示注入负例都有可回放但不泄密的证据。

## 2. Scope（范围）

Allowed files（允许修改）：
- `implementation/src/audit/audit-log.ts`
- `implementation/src/audit/evidence-writer.ts`
- `implementation/src/audit/hash.ts`
- `implementation/src/audit/log-redaction.ts`
- `implementation/src/tools/tool-output.ts`
- `implementation/tests/audit-evidence.test.ts`
- `implementation/docs/evidence-package-contract.md`
- `implementation/docs/evidence-samples/*.md`

Forbidden changes（禁止）：
- 不记录原始代码正文。
- 不记录原始提示词。
- 不记录密钥、令牌、凭据。
- 不把审计当作访问控制替代品。
- 不加入 shell（命令行外壳）、git（版本控制）或网络代理能力。

## 必交产物（Required Deliverables）

Primary deliverables（主产物；路径相对本项目根目录）：
- implementation/src/audit/audit-log.ts
- implementation/src/audit/evidence-writer.ts
- implementation/src/audit/hash.ts
- implementation/src/audit/log-redaction.ts
- implementation/src/tools/tool-output.ts
- implementation/tests/audit-evidence.test.ts
- implementation/docs/evidence-package-contract.md
- implementation/docs/evidence-samples/*.md

Closeout deliverables（收口产物；终止状态回写前必须存在）：
- execution-cards/EXEC-009-audit-evidence-log-privacy.claude-review/cycle1.input.json
- execution-cards/EXEC-009-audit-evidence-log-privacy.claude-review/cycle1.receipt.json
- execution-cards/EXEC-009-audit-evidence-log-privacy.claude-review/closure.json
- execution-cards/EXEC-009-audit-evidence-log-privacy.claude-review/validator_result.json
- execution-cards/EXEC-009-audit-evidence-log-privacy.claude-review/handshake.json（仅整卡委派给子代理执行时必须先创建）

Artifact existence validation（产物存在性校验）：
- 终止状态回写前，执行器必须用 `Test-Path` 或等效方法确认每个必交产物存在。
- required artifact path missing（必交产物路径缺失）、路径仍为通配符且未列出实际文件、或产物无法从证据追踪时，不得写 `complete`（完成）。
## 3. Required Work（必须执行）

- 审计记录包含：audit_id、timestamp、user_id 摘要、grant_id、repo_id、snapshot_id、tool、decision、error_code、policy_version、budget_before/after。
- 证据包包含：request_hash、response_hash、tool_schema_version、snapshot_manifest_hash、policy_version、audit_id、validation_surface、retention_until、evidence_storage_path、tamper_check、retention_policy、redaction_profile。
- 实现 evidence retention（证据保留）与 purge（过期清理）策略：到达 `retention_until` 后证据不可读或必须清理；清理失败必须记录结构化错误并阻止 `complete`（完成）。
- 查询词、路径、错误信息、拒绝原因中若出现疑似密钥或令牌，日志必须脱敏或哈希化。
- 支持 Markdown（标记文本）证据样本。
- 工具成功、拒绝、截断、budget_exceeded、secret_detected、prompt-injection-denied 都必须有证据样本。

## 4. Acceptance Criteria（验收标准）

- AC-001：工具成功和失败都产生审计记录。
- AC-002：证据包可关联请求、响应、快照、策略、预算和审计。
- AC-003：审计和证据中没有原始代码正文、原始提示词、密钥、令牌或凭据。
- AC-004：查询词或路径含疑似密钥时，日志不保存原文。
- AC-005：证据样本覆盖 `docs/design/test-matrix.md` 中 T-029、T-030、T-031、T-032。
- AC-006：证据包必须包含 retention_until、evidence_storage_path、tamper_check、retention_policy、redaction_profile，且篡改校验失败必须返回结构化拒绝。
- AC-007：过期证据读取必须拒绝或显示已清理；purge（过期清理）失败必须写入 remaining blockers（剩余阻塞），不得写 `complete`（完成）。

## 5. Validation（校验）

Commands（命令）：
- `npm test -- audit-evidence`
- `npm test -- repo-tools`
- `npm test -- foundation-guards`
- `npm run typecheck`

## 6. Required Evidence（所需证据）

- 成功审计样本。
- 拒绝审计样本。
- 查询词含密脱敏样本。
- 提示注入拒绝证据样本。
- 证据包样本。
- retention_until、evidence_storage_path、tamper_check、retention_policy、redaction_profile 样本。
- evidence retention（证据保留）与 purge（过期清理）测试输出，包含过期后不可读/已清理样本和清理失败样本。

## 7. Completion Writeback（完成回写）

changed files:
- implementation/src/audit/audit-log.ts
- implementation/src/audit/evidence-writer.ts
- implementation/src/audit/hash.ts
- implementation/src/audit/log-redaction.ts
- implementation/src/tools/tool-output.ts
- implementation/tests/audit-evidence.test.ts
- implementation/docs/evidence-package-contract.md
- implementation/docs/evidence-samples/*.md

created artifacts:
- list actual files
- execution-cards/EXEC-009-audit-evidence-log-privacy.claude-review/cycle1.input.json
- execution-cards/EXEC-009-audit-evidence-log-privacy.claude-review/cycle1.receipt.json
- execution-cards/EXEC-009-audit-evidence-log-privacy.claude-review/closure.json
- execution-cards/EXEC-009-audit-evidence-log-privacy.claude-review/validator_result.json
- execution-cards/EXEC-009-audit-evidence-log-privacy.claude-review/handshake.json（仅整卡委派给子代理时）

validation commands:
- list exact commands

validation results, including exit code:
- include summary and exit code

skipped validations and reason:
- list skipped checks

protected files unchanged:
- confirm no raw code/prompt/secrets logged and no command/network proxy added

remaining blockers:
- list blockers or none

completion status:
- complete | blocked | failed

## 8. Non-Completion Rule（非完成规则）

通用规则：required artifact path missing（必交产物路径缺失）、终止状态缺少 Claude closeout（Claude 收口复核）侧车证据、`validate_closure.py` 未通过、或 Claude 候选问题未分类时，不得写 `complete`（完成）。

如果证据包无法关联 audit_id、snapshot_manifest_hash、policy_version、budget 状态，或日志包含原始敏感内容、原始代码正文、原始提示词，不得写 `complete`（完成）。
## Claude Closeout Review（终止回写前外部复核）

- 在写入 `complete`、`blocked`、`failed` 或 `aborted` 等终止状态前，必须调用 `claude-taskcard-review`（Claude 任务卡复核）并把输入、回执、`closure`（收口）和 `validator_result`（校验结果）写入同名 `.claude-review` 侧车目录。
- `closure.json` 必须通过 `$CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py`；若 `CODEX_HOME` 不可用，必须记录解析到的脚本路径或阻塞原因。
- `Claude findings`（Claude 候选问题）只作为 `advisory`（建议性）证据；执行器必须把每个候选问题分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`，并写明本地证据。
- `complete`（完成）要求最新 Claude receipt（回执）为 `call_status=ok`、所有 `accepted_blocking` 已解决、`validate_closure.py` 报告可写完成；否则只能按本地证据写 `blocked`、`failed` 或 `aborted`。
- 若整卡委派给子代理执行，子代理在业务工作前必须先写 `execution-cards/EXEC-009-audit-evidence-log-privacy.claude-review/handshake.json`，且其中 `agent_role` 必须是 `executor`（执行者）。
