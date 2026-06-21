# EXEC-004：授权授予记录与策略引擎

状态：ready_for_ai_execution（可由 AI 执行）。
依赖：EXEC-003 complete（完成）。

## 1. Objective（目标）

实现服务端授权授予记录、策略校验和撤销流程，使每次工具调用都绑定用户、客户端、仓库、快照、工具、预算和过期时间，并复用 EXEC-003 的错误、预算和审计基础。

## 2. Scope（范围）

Allowed files（允许修改）：
- `implementation/src/auth/grants.ts`
- `implementation/src/auth/tokens.ts`
- `implementation/src/policy/policy-engine.ts`
- `implementation/src/policy/policy-types.ts`
- `implementation/tests/auth-policy.test.ts`
- `implementation/docs/auth-policy-contract.md`

Forbidden changes（禁止）：
- 不实现真实生产 IdP（身份提供方）接入。
- 不存储真实密钥。
- 不读取仓库内容。
- 不把会话标识当认证凭据。

## 必交产物（Required Deliverables）

Primary deliverables（主产物；路径相对本项目根目录）：
- implementation/src/auth/grants.ts
- implementation/src/auth/tokens.ts
- implementation/src/policy/policy-engine.ts
- implementation/src/policy/policy-types.ts
- implementation/tests/auth-policy.test.ts
- implementation/docs/auth-policy-contract.md

Closeout deliverables（收口产物；终止状态回写前必须存在）：
- execution-cards/EXEC-004-auth-policy-grant-store.claude-review/cycle1.input.json
- execution-cards/EXEC-004-auth-policy-grant-store.claude-review/cycle1.receipt.json
- execution-cards/EXEC-004-auth-policy-grant-store.claude-review/closure.json
- execution-cards/EXEC-004-auth-policy-grant-store.claude-review/validator_result.json
- execution-cards/EXEC-004-auth-policy-grant-store.claude-review/handshake.json（仅整卡委派给子代理执行时必须先创建）

Artifact existence validation（产物存在性校验）：
- 终止状态回写前，执行器必须用 `Test-Path` 或等效方法确认每个必交产物存在。
- required artifact path missing（必交产物路径缺失）、路径仍为通配符且未列出实际文件、或产物无法从证据追踪时，不得写 `complete`（完成）。
## 3. Required Work（必须执行）

- 定义 `grant_id/user_id/client_id/repo_id/snapshot_id/allowed_tools/allowed_paths/data_budget/expiry/revoked_at/policy_version`。
- 实现开发 grant store（授权存储），标明仅开发使用。
- 实现 explicit consent（显式授权）创建流程：授权只能由用户可审计动作创建，必须记录 `consent_id`、`consent_actor`、`consent_at`、`consent_surface`、`approved_repo_id`、`approved_snapshot_id`、`approved_paths`、`approved_tools`、`approved_budget`、`expires_at`。
- 实现 consent renewal（授权续期）与 re-consent（重新授权）规则：策略版本、路径范围、工具范围、预算或快照发生扩大时，必须重新授权；不得静默升级旧授权。
- 实现 `authorizeToolCall`，调用 EXEC-003 预算模型和错误契约。
- 实现撤销函数，撤销后旧 grant 必须拒绝。
- 拒绝响应必须包含 EXEC-003 的 `audit_id`。

## 4. Acceptance Criteria（验收标准）

- AC-001：合法 grant 允许对应工具调用。
- AC-002：错误 repo_id、snapshot_id、tool、过期 grant、撤销 grant 全部拒绝。
- AC-003：预算耗尽会通过 policy engine 拒绝。
- AC-004：文档说明生产环境必须接入 OAuth 2.1/OIDC 或成熟 IdP。
- AC-005：没有 explicit consent（显式授权）记录时不得创建 grant；授权续期、撤销、策略扩大再授权均有正负例。

## 5. Validation（校验）

Commands（命令）：
- `npm test -- auth-policy`
- `npm test -- foundation-guards`
- `npm run typecheck`

## 6. Required Evidence（所需证据）

- 授权正例和负例测试输出。
- 撤销和预算拒绝响应样本。
- explicit consent（显式授权）创建、续期、撤销、再授权触发证据。
- 文档说明不含真实密钥。

## 7. Completion Writeback（完成回写）

changed files:
- implementation/src/auth/grants.ts
- implementation/src/auth/tokens.ts
- implementation/src/policy/policy-engine.ts
- implementation/src/policy/policy-types.ts
- implementation/tests/auth-policy.test.ts
- implementation/docs/auth-policy-contract.md

created artifacts:
- list actual files
- execution-cards/EXEC-004-auth-policy-grant-store.claude-review/cycle1.input.json
- execution-cards/EXEC-004-auth-policy-grant-store.claude-review/cycle1.receipt.json
- execution-cards/EXEC-004-auth-policy-grant-store.claude-review/closure.json
- execution-cards/EXEC-004-auth-policy-grant-store.claude-review/validator_result.json
- execution-cards/EXEC-004-auth-policy-grant-store.claude-review/handshake.json（仅整卡委派给子代理时）

validation commands:
- list exact commands

validation results, including exit code:
- include summary and exit code

skipped validations and reason:
- production OAuth live integration may be skipped with reason

protected files unchanged:
- confirm no real secrets and no repository source read

remaining blockers:
- list blockers or none

completion status:
- complete | blocked | failed

## 8. Non-Completion Rule（非完成规则）

通用规则：required artifact path missing（必交产物路径缺失）、终止状态缺少 Claude closeout（Claude 收口复核）侧车证据、`validate_closure.py` 未通过、或 Claude 候选问题未分类时，不得写 `complete`（完成）。

撤销、过期、跨仓库、跨快照、预算耗尽负例未通过时，不得写 `complete`（完成）。

## 9. Security Addendum（安全补充）

本卡必须把父设计中的授权硬边界落成执行验收：

- `authorizeToolCall` 必须校验 `grant_id/user_id/client_id/repo_id/snapshot_id/tool/allowed_paths/scope/budget/policy_version/expiry/revoked_at`。
- 必须拒绝 token passthrough（令牌透传）：服务端只接受 audience（受众）指向本 MCP server（模型上下文协议服务器）的令牌。
- 必须有 issuer（签发者）、audience（受众）、expiry（过期）、scope（作用域）、replay（重放）负例测试或明确 blocked（阻塞）原因。
- policy_version（策略版本）不匹配时必须拒绝，避免旧策略继续授权。
- allowed_paths（允许路径）必须参与授权，不能只依赖 repo_id（仓库标识）和 snapshot_id（快照标识）。

额外验收：
- 错误 audience token 被拒绝。
- 缺少 scope token 被拒绝。
- policy_version 过期被拒绝。
- allowed_paths 外路径被拒绝。
## Claude Closeout Review（终止回写前外部复核）

- 在写入 `complete`、`blocked`、`failed` 或 `aborted` 等终止状态前，必须调用 `claude-taskcard-review`（Claude 任务卡复核）并把输入、回执、`closure`（收口）和 `validator_result`（校验结果）写入同名 `.claude-review` 侧车目录。
- `closure.json` 必须通过 `$CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py`；若 `CODEX_HOME` 不可用，必须记录解析到的脚本路径或阻塞原因。
- `Claude findings`（Claude 候选问题）只作为 `advisory`（建议性）证据；执行器必须把每个候选问题分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`，并写明本地证据。
- `complete`（完成）要求最新 Claude receipt（回执）为 `call_status=ok`、所有 `accepted_blocking` 已解决、`validate_closure.py` 报告可写完成；否则只能按本地证据写 `blocked`、`failed` 或 `aborted`。
- 若整卡委派给子代理执行，子代理在业务工作前必须先写 `execution-cards/EXEC-004-auth-policy-grant-store.claude-review/handshake.json`，且其中 `agent_role` 必须是 `executor`（执行者）。
