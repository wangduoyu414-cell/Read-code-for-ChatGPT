# EXEC-010：端到端验收与 ChatGPT 连接器验证

状态：ready_for_ai_execution（可由 AI 执行）。
依赖：EXEC-009 complete（完成）。

## 1. Objective（目标）

完成 `MCP Inspector`（协议检查器）、`ChatGPT developer mode`（开发者模式）和 `API Playground`（接口调试台）至少两条独立验证链，证明只读工具、授权拒绝、快照一致性和证据包闭环。

## 2. Scope（范围）

Allowed files（允许修改）：
- `implementation/scripts/run-mcp-inspector-smoke.*`
- `implementation/scripts/run-api-playground-smoke.*`
- `implementation/docs/e2e-validation-plan.md`
- `implementation/docs/e2e-validation-results.md`
- `implementation/docs/chatgpt-connector-setup.md`
- `implementation/docs/evidence-samples/e2e-*.md`

Forbidden changes（禁止）：
- 不提交公开应用。
- 不用公网临时隧道读取私有仓库。
- 不读取真实敏感仓库；端到端先使用 fixture（测试夹具）仓库。
- 不声称生产可用。

## 必交产物（Required Deliverables）

Primary deliverables（主产物；路径相对本项目根目录）：
- implementation/scripts/run-mcp-inspector-smoke.*
- implementation/scripts/run-api-playground-smoke.*
- implementation/docs/e2e-validation-plan.md
- implementation/docs/e2e-validation-results.md
- implementation/docs/chatgpt-connector-setup.md
- implementation/docs/evidence-samples/e2e-*.md

Closeout deliverables（收口产物；终止状态回写前必须存在）：
- execution-cards/EXEC-010-e2e-validation-chatgpt-connector.claude-review/cycle1.input.json
- execution-cards/EXEC-010-e2e-validation-chatgpt-connector.claude-review/cycle1.receipt.json
- execution-cards/EXEC-010-e2e-validation-chatgpt-connector.claude-review/closure.json
- execution-cards/EXEC-010-e2e-validation-chatgpt-connector.claude-review/validator_result.json
- execution-cards/EXEC-010-e2e-validation-chatgpt-connector.claude-review/handshake.json（仅整卡委派给子代理执行时必须先创建）

Artifact existence validation（产物存在性校验）：
- 终止状态回写前，执行器必须用 `Test-Path` 或等效方法确认每个必交产物存在。
- required artifact path missing（必交产物路径缺失）、路径仍为通配符且未列出实际文件、或产物无法从证据追踪时，不得写 `complete`（完成）。
## 3. Required Work（必须执行）

- 执行前读取 `docs/design/test-matrix.md`，覆盖 T-001 到 T-032 或记录未覆盖阻塞项。
- 启动本地 MCP server（模型上下文协议服务器）。
- 用 `MCP Inspector` 调用四个工具正例和负例。
- 用 `API Playground` 或等效原始请求方式验证至少一个正例和一个负例。
- 用 `ChatGPT developer mode` 连接本地服务或记录目标环境阻塞。
- 验证 explicit consent（显式授权）创建链路：without consent（无授权）必须拒绝，用户显式授权后才允许对应 repo/snapshot/path/tool/budget，策略扩大或快照刷新后必须触发 re-consent（重新授权）。
- 若 `Secure MCP Tunnel` 可用，验证隧道连接；不可用则记录 blocked（阻塞），不得使用公网临时隧道替代私有方案。
- 生成 e2e（端到端）证据包。
- 生成 `execution-cards/execution-validation-report.md`，写入当前 11 张卡的子代理复核、Claude 复核、本地校验、跳过项、剩余阻塞和最终判定。
- 更新父级 `docs/reports/validation-report.md`，明确执行卡拆分状态，不得把任务卡就绪写成运行时完成。

## 4. Acceptance Criteria（验收标准）

- AC-001：至少两条独立验证链通过，且结果一致。
- AC-002：四个工具至少各一个正例和一个负例有证据。
- AC-003：黄金问题集至少覆盖定义位置、入口查找、实现差异。
- AC-004：越权路径、敏感文件、提示注入、写请求、整仓枚举、过量结果全部拒绝或截断。
- AC-005：证据包无原始敏感正文，包含 request_hash、response_hash、audit_id、snapshot_manifest_hash、policy_version。
- AC-006：`execution-validation-report.md` 和父级 `docs/reports/validation-report.md` 已写回最新 11-card（十一卡）复核状态，旧 8-card（八卡）回执不得作为通过证据。
- AC-007：端到端结果必须包含 tool schema diff（工具模式差异）证据，证明四个工具的成功/拒绝输出符合 `tool-schemas.json` 安全字段。
- AC-008：端到端结果必须包含显式授权、再授权、撤销、无授权拒绝的证据链。

## 5. Validation（校验）

Commands（命令）：
- `npm test`
- `npm run typecheck`
- `npm run build`
- `node dist/server.js` 或等效启动命令
- MCP Inspector 调用记录
- API Playground 调用记录
- ChatGPT developer mode 手工验证记录

## 6. Required Evidence（所需证据）

- 服务启动输出。
- Inspector 调用日志。
- API Playground 请求/响应摘要。
- ChatGPT developer mode 会话摘要或阻塞证据。
- e2e-validation-results.md。
- execution-cards/execution-validation-report.md。
- 父级 docs/reports/validation-report.md 写回摘要。
- tool schema diff（工具模式差异）证据。
- explicit consent（显式授权）端到端证据。

## 7. Completion Writeback（完成回写）

changed files:
- implementation/scripts/run-mcp-inspector-smoke.*
- implementation/scripts/run-api-playground-smoke.*
- implementation/docs/e2e-validation-plan.md
- implementation/docs/e2e-validation-results.md
- implementation/docs/chatgpt-connector-setup.md
- implementation/docs/evidence-samples/e2e-*.md

created artifacts:
- list actual files
- execution-cards/EXEC-010-e2e-validation-chatgpt-connector.claude-review/cycle1.input.json
- execution-cards/EXEC-010-e2e-validation-chatgpt-connector.claude-review/cycle1.receipt.json
- execution-cards/EXEC-010-e2e-validation-chatgpt-connector.claude-review/closure.json
- execution-cards/EXEC-010-e2e-validation-chatgpt-connector.claude-review/validator_result.json
- execution-cards/EXEC-010-e2e-validation-chatgpt-connector.claude-review/handshake.json（仅整卡委派给子代理时）

validation commands:
- list exact commands

validation results, including exit code:
- include output summary and exit code

skipped validations and reason:
- list skipped checks

protected files unchanged:
- confirm no private real repo source was used without explicit authorization

remaining blockers:
- list blockers or none

completion status:
- complete | blocked | failed

## 8. Non-Completion Rule（非完成规则）

通用规则：required artifact path missing（必交产物路径缺失）、终止状态缺少 Claude closeout（Claude 收口复核）侧车证据、`validate_closure.py` 未通过、或 Claude 候选问题未分类时，不得写 `complete`（完成）。

如果没有至少两条独立验证链、没有负例证据、或用公网临时隧道代替私有仓库 `Secure MCP Tunnel`，不得写 `complete`（完成）。
## Claude Closeout Review（终止回写前外部复核）

- 在写入 `complete`、`blocked`、`failed` 或 `aborted` 等终止状态前，必须调用 `claude-taskcard-review`（Claude 任务卡复核）并把输入、回执、`closure`（收口）和 `validator_result`（校验结果）写入同名 `.claude-review` 侧车目录。
- `closure.json` 必须通过 `$CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py`；若 `CODEX_HOME` 不可用，必须记录解析到的脚本路径或阻塞原因。
- `Claude findings`（Claude 候选问题）只作为 `advisory`（建议性）证据；执行器必须把每个候选问题分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`，并写明本地证据。
- `complete`（完成）要求最新 Claude receipt（回执）为 `call_status=ok`、所有 `accepted_blocking` 已解决、`validate_closure.py` 报告可写完成；否则只能按本地证据写 `blocked`、`failed` 或 `aborted`。
- 若整卡委派给子代理执行，子代理在业务工作前必须先写 `execution-cards/EXEC-010-e2e-validation-chatgpt-connector.claude-review/handshake.json`，且其中 `agent_role` 必须是 `executor`（执行者）。
