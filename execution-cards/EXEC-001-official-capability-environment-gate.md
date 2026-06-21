# EXEC-001：官方能力与目标环境确认

状态：ready_for_ai_execution（可由 AI 执行）。

## 1. Objective（目标）

确认目标 `ChatGPT`（聊天网页端）环境是否具备实现本地只读仓库 `MCP`（模型上下文协议）应用所需能力，并产出不可绕过的环境准入报告。

## 2. Scope（范围）

Allowed files（允许产物）：
- `implementation/docs/environment-capability-report.md`
- `implementation/docs/official-capability-checklist.md`
- `implementation/docs/implementation-decisions.md`

Forbidden changes（禁止）：
- 不写代码实现。
- 不启动本地仓库读取。
- 不读取用户仓库源码。
- 不创建真实连接器或发布应用。

## 必交产物（Required Deliverables）

Primary deliverables（主产物；路径相对本项目根目录）：
- implementation/docs/environment-capability-report.md
- implementation/docs/official-capability-checklist.md
- implementation/docs/implementation-decisions.md

Closeout deliverables（收口产物；终止状态回写前必须存在）：
- execution-cards/EXEC-001-official-capability-environment-gate.claude-review/cycle1.input.json
- execution-cards/EXEC-001-official-capability-environment-gate.claude-review/cycle1.receipt.json
- execution-cards/EXEC-001-official-capability-environment-gate.claude-review/closure.json
- execution-cards/EXEC-001-official-capability-environment-gate.claude-review/validator_result.json
- execution-cards/EXEC-001-official-capability-environment-gate.claude-review/handshake.json（仅整卡委派给子代理执行时必须先创建）

Artifact existence validation（产物存在性校验）：
- 终止状态回写前，执行器必须用 `Test-Path` 或等效方法确认每个必交产物存在。
- required artifact path missing（必交产物路径缺失）、路径仍为通配符且未列出实际文件、或产物无法从证据追踪时，不得写 `complete`（完成）。
## 3. Required Work（必须执行）

- 查证目标账号是否能打开 `ChatGPT developer mode`（开发者模式）。
- 查证是否能使用 `Secure MCP Tunnel`（安全隧道）。
- 查证 `MCP Inspector`（协议检查器）安装和运行方式。
- 确认目标平台：操作系统、文件系统、浏览器、`Node.js`（节点运行时）版本。
- 确认第一版是否只支持 Windows（视窗操作系统）路径安全；若跨平台，列出差异。
- 明确 `OAuth 2.1`（授权协议 2.1）/`OIDC`（开放身份连接）/`mTLS`（双向传输层安全）/本地开发临时授权的实现期选择。
- 记录 `Developer mode`（开发者模式）仅用于开发验收，不得作为生产安全边界；远程生产连接必须有正式鉴权方案。

## 4. Acceptance Criteria（验收标准）

- AC-001：报告列出每个官方能力的状态：available（可用）/ unavailable（不可用）/ TBD（待确认）。
- AC-002：任何 TBD 都有确认方法和阻塞影响。
- AC-003：实现期不得开始，除非 `Developer mode`、`MCP Inspector`、本地 Node.js 工具链至少可用。
- AC-004：若 `Secure MCP Tunnel` 不可用，任务必须转为 blocked（阻塞），不得用公网临时隧道替代私有仓库方案。
- AC-005：报告必须明确 `Developer mode` 风险、远程服务器 `OAuth`/`mTLS` 选择、token（令牌）校验责任和生产不可用条件。

## 5. Validation（校验）

Commands（命令）：
- `node --version`
- `npm --version`
- `npx @modelcontextprotocol/inspector --version` 或记录不可用原因
- 手工打开 `ChatGPT developer mode` 并记录截图/文字证据

## 6. Required Evidence（所需证据）

- 命令输出和退出码。
- 官方能力页面或设置页面截图/文字摘要。
- 不含密钥、不含仓库源码。

## 7. Completion Writeback（完成回写）

changed files:
- implementation/docs/environment-capability-report.md
- implementation/docs/official-capability-checklist.md
- implementation/docs/implementation-decisions.md

created artifacts:
- list actual created files
- execution-cards/EXEC-001-official-capability-environment-gate.claude-review/cycle1.input.json
- execution-cards/EXEC-001-official-capability-environment-gate.claude-review/cycle1.receipt.json
- execution-cards/EXEC-001-official-capability-environment-gate.claude-review/closure.json
- execution-cards/EXEC-001-official-capability-environment-gate.claude-review/validator_result.json
- execution-cards/EXEC-001-official-capability-environment-gate.claude-review/handshake.json（仅整卡委派给子代理时）

validation commands:
- list commands exactly

validation results, including exit code:
- include output summary and exit code

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

不得在 `Secure MCP Tunnel` 或 `Developer mode` 能力未确认且未记录阻塞影响时写 complete（完成）。

## 9. Business Scenario（业务场景）

- Actor（参与者）：实现代理或开发者。
- Given（前置）：设计任务卡已处于 `design_ready`（设计就绪）。
- When（触发）：准备进入实现阶段。
- Then（结果）：明确目标账号/组织、浏览器、`Developer mode`（开发者模式）、`Secure MCP Tunnel`（安全隧道）、`MCP Inspector`（协议检查器）、`API Playground`（接口调试台）是否可用。
## Claude Closeout Review（终止回写前外部复核）

- 在写入 `complete`、`blocked`、`failed` 或 `aborted` 等终止状态前，必须调用 `claude-taskcard-review`（Claude 任务卡复核）并把输入、回执、`closure`（收口）和 `validator_result`（校验结果）写入同名 `.claude-review` 侧车目录。
- `closure.json` 必须通过 `$CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py`；若 `CODEX_HOME` 不可用，必须记录解析到的脚本路径或阻塞原因。
- `Claude findings`（Claude 候选问题）只作为 `advisory`（建议性）证据；执行器必须把每个候选问题分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`，并写明本地证据。
- `complete`（完成）要求最新 Claude receipt（回执）为 `call_status=ok`、所有 `accepted_blocking` 已解决、`validate_closure.py` 报告可写完成；否则只能按本地证据写 `blocked`、`failed` 或 `aborted`。
- 若整卡委派给子代理执行，子代理在业务工作前必须先写 `execution-cards/EXEC-001-official-capability-environment-gate.claude-review/handshake.json`，且其中 `agent_role` 必须是 `executor`（执行者）。
