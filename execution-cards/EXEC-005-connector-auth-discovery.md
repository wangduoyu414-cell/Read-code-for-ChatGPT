# EXEC-005：连接器鉴权发现与运行时授权挑战

状态：ready_for_ai_execution（可由 AI 执行）。
依赖：EXEC-004 complete（完成）。

## 1. Objective（目标）

实现或明确本地开发模式下的连接器鉴权发现契约，使 ChatGPT developer mode 接入不会在 EXEC-009 才发现鉴权链路缺失。

## 2. Scope（范围）

Allowed files（允许修改）：
- `implementation/src/auth/oauth-metadata.ts`
- `implementation/src/server.ts`
- `implementation/src/tools/registry.ts`
- `implementation/tests/connector-auth-discovery.test.ts`
- `implementation/docs/connector-auth-discovery.md`

Forbidden changes（禁止）：
- 不接真实生产 IdP。
- 不保存真实 token。
- 不把本地开发临时模式称为生产安全。

## 必交产物（Required Deliverables）

Primary deliverables（主产物；路径相对本项目根目录）：
- implementation/src/auth/oauth-metadata.ts
- implementation/src/server.ts
- implementation/src/tools/registry.ts
- implementation/tests/connector-auth-discovery.test.ts
- implementation/docs/connector-auth-discovery.md

Closeout deliverables（收口产物；终止状态回写前必须存在）：
- execution-cards/EXEC-005-connector-auth-discovery.claude-review/cycle1.input.json
- execution-cards/EXEC-005-connector-auth-discovery.claude-review/cycle1.receipt.json
- execution-cards/EXEC-005-connector-auth-discovery.claude-review/closure.json
- execution-cards/EXEC-005-connector-auth-discovery.claude-review/validator_result.json
- execution-cards/EXEC-005-connector-auth-discovery.claude-review/handshake.json（仅整卡委派给子代理执行时必须先创建）

Artifact existence validation（产物存在性校验）：
- 终止状态回写前，执行器必须用 `Test-Path` 或等效方法确认每个必交产物存在。
- required artifact path missing（必交产物路径缺失）、路径仍为通配符且未列出实际文件、或产物无法从证据追踪时，不得写 `complete`（完成）。
## 3. Required Work（必须执行）

- 定义 connector name（连接器名称）、description（说明）、`/mcp` 端点和 server instructions（服务器指引）。
- 定义 `securitySchemes`（安全方案）占位或开发模式说明，明确 `OAuth 2.1`（授权协议 2.1）与 `mTLS`（双向传输层安全）适用边界。
- 定义 well-known discovery（发现）路径预期：受保护资源和授权服务器。
- 未授权时返回 `_meta["mcp/www_authenticate"]` 或明确开发模式阻塞原因。
- 明确 token（令牌）验证：issuer（签发者）、audience（受众）、expiry（过期）、scope（作用域）、replay（重放）和 token passthrough（令牌透传）拒绝。
- 文档说明：生产模式必须 OAuth 2.1/OIDC 或成熟 IdP。

## 4. Acceptance Criteria（验收标准）

- AC-001：连接器 metadata（元数据）可被测试读取。
- AC-002：未授权请求返回结构化授权挑战或明确 blocked（阻塞）。
- AC-003：文档明确本地开发模式和生产模式差异。
- AC-004：不得把 readOnlyHint 当授权边界。
- AC-005：未授权挑战必须能被测试覆盖；若只处于本地开发临时模式，必须写 blocked（阻塞）或非生产限制，不得声称生产可用。

## 5. Validation（校验）

Commands（命令）：
- `npm test -- connector-auth-discovery`
- `npm run typecheck`

## 6. Required Evidence（所需证据）

- metadata 样本。
- 未授权挑战样本。
- 开发/生产差异说明。

## 7. Completion Writeback（完成回写）

changed files:
- implementation/src/auth/oauth-metadata.ts
- implementation/src/server.ts
- implementation/src/tools/registry.ts
- implementation/tests/connector-auth-discovery.test.ts
- implementation/docs/connector-auth-discovery.md

created artifacts:
- list actual files
- execution-cards/EXEC-005-connector-auth-discovery.claude-review/cycle1.input.json
- execution-cards/EXEC-005-connector-auth-discovery.claude-review/cycle1.receipt.json
- execution-cards/EXEC-005-connector-auth-discovery.claude-review/closure.json
- execution-cards/EXEC-005-connector-auth-discovery.claude-review/validator_result.json
- execution-cards/EXEC-005-connector-auth-discovery.claude-review/handshake.json（仅整卡委派给子代理时）

validation commands:
- list exact commands

validation results, including exit code:
- include summary and exit code

skipped validations and reason:
- live OAuth provider integration may be skipped with reason

protected files unchanged:
- confirm no real token or secret stored

remaining blockers:
- list blockers or none

completion status:
- complete | blocked | failed

## 8. Non-Completion Rule（非完成规则）

通用规则：required artifact path missing（必交产物路径缺失）、终止状态缺少 Claude closeout（Claude 收口复核）侧车证据、`validate_closure.py` 未通过、或 Claude 候选问题未分类时，不得写 `complete`（完成）。

未定义连接器 metadata、未授权挑战或开发/生产鉴权边界时，不得写 `complete`（完成）。
## Claude Closeout Review（终止回写前外部复核）

- 在写入 `complete`、`blocked`、`failed` 或 `aborted` 等终止状态前，必须调用 `claude-taskcard-review`（Claude 任务卡复核）并把输入、回执、`closure`（收口）和 `validator_result`（校验结果）写入同名 `.claude-review` 侧车目录。
- `closure.json` 必须通过 `$CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py`；若 `CODEX_HOME` 不可用，必须记录解析到的脚本路径或阻塞原因。
- `Claude findings`（Claude 候选问题）只作为 `advisory`（建议性）证据；执行器必须把每个候选问题分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`，并写明本地证据。
- `complete`（完成）要求最新 Claude receipt（回执）为 `call_status=ok`、所有 `accepted_blocking` 已解决、`validate_closure.py` 报告可写完成；否则只能按本地证据写 `blocked`、`failed` 或 `aborted`。
- 若整卡委派给子代理执行，子代理在业务工作前必须先写 `execution-cards/EXEC-005-connector-auth-discovery.claude-review/handshake.json`，且其中 `agent_role` 必须是 `executor`（执行者）。
