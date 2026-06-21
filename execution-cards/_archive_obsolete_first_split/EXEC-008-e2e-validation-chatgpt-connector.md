# EXEC-008：端到端验收与 ChatGPT 连接器验证

状态：ready_for_ai_execution（可由 AI 执行）。
依赖：EXEC-007 complete（完成）。

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

## 3. Required Work（必须执行）

- 启动本地 MCP server（模型上下文协议服务器）。
- 用 `MCP Inspector` 调用四个工具正例和负例。
- 用 `API Playground` 或等效原始请求方式验证至少一个正例和一个负例。
- 用 `ChatGPT developer mode` 连接本地服务或记录目标环境阻塞。
- 若 `Secure MCP Tunnel` 可用，验证隧道连接；不可用则记录 blocked（阻塞），不得使用公网临时隧道替代私有方案。
- 生成 e2e（端到端）证据包。

## 4. Acceptance Criteria（验收标准）

- AC-001：至少两条独立验证链通过，且结果一致。
- AC-002：四个工具至少各一个正例和一个负例有证据。
- AC-003：黄金问题集至少覆盖定义位置、入口查找、实现差异。
- AC-004：越权路径、敏感文件、提示注入、写请求、整仓枚举、过量结果全部拒绝或截断。
- AC-005：证据包无原始敏感正文，包含 request_hash、response_hash、audit_id、snapshot_manifest_hash、policy_version。

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

如果没有至少两条独立验证链、没有负例证据、或用公网临时隧道代替私有仓库 `Secure MCP Tunnel`，不得写 complete（完成）。
