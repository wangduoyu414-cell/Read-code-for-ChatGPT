# EXEC-011：ChatGPT 开发连接链路硬化

状态：complete（完成）。
依赖：EXEC-010 complete（完成）或本地人工确认 EXEC-010 的外部环境阻塞项已记录。

## 1. Objective（目标）

让当前 `ChatGPT`（聊天网页端）开发连接链路在仓库内达到可验证状态：本地服务必须明确区分 `/mcp`（模型上下文协议端点）、连接器发现端点、`OAuth`（开放授权）未接入端点和未知路径；开发者必须能从文档判断截图里的 `127.0.0.1`（本机地址）和 `OAuth`（开放授权）配置为何不适合作为最终连接方式。

## 2. Scope（范围）

Allowed files（允许修改）：
- `implementation/src/server.ts`
- `implementation/src/auth/oauth-metadata.ts`
- `implementation/tests/server-smoke.test.ts`
- `implementation/tests/connector-auth-discovery.test.ts`
- `implementation/docs/connector-auth-discovery.md`
- `implementation/docs/chatgpt-connector-setup.md`
- `execution-cards/index.md`
- `execution-cards/task-import-map.json`
- `execution-cards/EXEC-011-chatgpt-dev-connector-hardening.md`

Forbidden changes（禁止）：
- 不接真实生产 `IdP`（身份提供方）。
- 不保存真实 `OAuth`（开放授权）客户端密钥、用户令牌或回调凭据。
- 不把本地开发临时模式称为生产安全。
- 不用公网临时隧道读取真实私有仓库。
- 不改四个只读工具的仓库读取授权边界。

## 必交产物（Required Deliverables）

Primary deliverables（主产物；路径相对本项目根目录）：
- implementation/src/server.ts
- implementation/src/auth/oauth-metadata.ts
- implementation/tests/server-smoke.test.ts
- implementation/tests/connector-auth-discovery.test.ts
- implementation/docs/connector-auth-discovery.md
- implementation/docs/chatgpt-connector-setup.md
- execution-cards/index.md
- execution-cards/task-import-map.json
- execution-cards/EXEC-011-chatgpt-dev-connector-hardening.md

Closeout deliverables（收口产物；终止状态回写前必须存在）：
- execution-cards/EXEC-011-chatgpt-dev-connector-hardening.claude-review/cycle1.input.json
- execution-cards/EXEC-011-chatgpt-dev-connector-hardening.claude-review/cycle1.receipt.json
- execution-cards/EXEC-011-chatgpt-dev-connector-hardening.claude-review/closure.json
- execution-cards/EXEC-011-chatgpt-dev-connector-hardening.claude-review/validator_result.json
- execution-cards/EXEC-011-chatgpt-dev-connector-hardening.claude-review/handshake.json（仅整卡委派给子代理执行时必须先创建）

Artifact existence validation（产物存在性校验）：
- 终止状态回写前，执行器必须用 `Test-Path` 或等效方法确认每个必交产物存在。
- required artifact path missing（必交产物路径缺失）、路径仍为通配符且未列出实际文件、或产物无法从证据追踪时，不得写 `complete`（完成）。

## 3. Required Work（必须执行）

- 读取 `docs/design/task-card.md`、`docs/design/official-evidence.md`、`docs/design/test-matrix.md`、`docs/design/threat-model.md` 和 `tool-schemas.json`，保持只读、安全和端到端验收边界不漂移。
- 修正 `implementation/src/server.ts` 的路由边界：只有 `/mcp` 进入 `Streamable HTTP`（可流式 HTTP）传输；连接器发现、`OAuth`（开放授权）发现和未知路径必须直接返回明确 `HTTP`（网页协议）响应。
- 修正 stateless（无会话状态）传输生命周期：每个 `/mcp` 请求不得重复连接同一个 `McpServer`（模型上下文协议服务器）实例导致 `Already connected to a transport`（已连接传输）错误。
- 为 `/.well-known/oauth-protected-resource`（受保护资源发现）返回开发模式元数据；为 `/.well-known/oauth-authorization-server`（授权服务器发现）和 `/.well-known/openid-configuration`（开放身份连接发现）返回明确的开发模式不可用响应，不得挂起或误入 `/mcp` 传输。
- 更新 `implementation/docs/connector-auth-discovery.md`，说明当前 `dev_local`（本地开发）模式、`oauth2`（开放授权二点零）阻塞原因和发现端点行为。
- 新增或更新 `implementation/docs/chatgpt-connector-setup.md`，说明 `ChatGPT developer mode`（聊天网页端开发者模式）中服务器 `URL`（网址）必须使用可访问的 `HTTPS`（安全网页协议）或 `Secure MCP Tunnel`（安全 MCP 隧道），不能把 `http://127.0.0.1:3100/mcp` 当作最终服务器 `URL`（网址）。
- 补测试覆盖：发现端点必须返回预期状态码和结构化 `JSON`（结构化数据）；未知路径不得触发传输层；连续请求不得触发重复连接错误。

## 4. Acceptance Criteria（验收标准）

- AC-001：`/.well-known/oauth-protected-resource` 返回 `200` 和结构化开发模式元数据。
- AC-002：`/.well-known/oauth-authorization-server` 与 `/.well-known/openid-configuration` 返回明确不可用响应，不挂起、不返回 `MCP`（模型上下文协议）传输错误。
- AC-003：未知路径返回明确 `404`，不得进入 `Streamable HTTP`（可流式 HTTP）传输。
- AC-004：连续请求发现端点和 `/mcp` 路径时，不再触发 `Already connected to a transport`（已连接传输）错误。
- AC-005：文档明确区分本地开发、隧道连接和生产 `OAuth`（开放授权）/`OIDC`（开放身份连接）要求，不声称生产可用。
- AC-006：执行卡索引和 `task-import-map.json` 纳入 `EXEC-011`，结构校验通过。

## 5. Validation（校验）

Commands（命令）：
- `npm test`
- `npm run typecheck`
- `npm run build`
- `powershell -NoProfile -ExecutionPolicy Bypass -File ".\execution-cards\validate-execution-cards.ps1" -CardsDir ".\execution-cards"`（from `<repo-root>`）
- 本地端点级请求：`/connector-meta`、`/.well-known/oauth-protected-resource`、`/.well-known/oauth-authorization-server`、`/.well-known/openid-configuration`、未知路径。

## 6. Required Evidence（所需证据）

- 发现端点状态码和响应摘要。
- 连续请求不触发重复传输连接错误的测试输出。
- `npm test`、`npm run typecheck`、`npm run build` 的退出码和摘要。
- 执行卡结构校验输出。
- `chatgpt-connector-setup.md` 中对 `HTTPS`（安全网页协议）/隧道/本地地址/`OAuth`（开放授权）限制的说明。

## 7. Completion Writeback（完成回写）

changed files:
- implementation/src/server.ts
- implementation/src/auth/oauth-metadata.ts
- implementation/tests/server-smoke.test.ts
- implementation/tests/connector-auth-discovery.test.ts
- implementation/docs/connector-auth-discovery.md
- implementation/docs/chatgpt-connector-setup.md
- execution-cards/index.md
- execution-cards/task-import-map.json
- execution-cards/EXEC-011-chatgpt-dev-connector-hardening.md

created artifacts:
- execution-cards/EXEC-011-chatgpt-dev-connector-hardening.md
- implementation/docs/chatgpt-connector-setup.md
- execution-cards/EXEC-011-chatgpt-dev-connector-hardening.claude-review/cycle1.input.json
- execution-cards/EXEC-011-chatgpt-dev-connector-hardening.claude-review/cycle1.receipt.json
- execution-cards/EXEC-011-chatgpt-dev-connector-hardening.claude-review/cycle2.input.json
- execution-cards/EXEC-011-chatgpt-dev-connector-hardening.claude-review/cycle2.receipt.json
- execution-cards/EXEC-011-chatgpt-dev-connector-hardening.claude-review/closure.json
- execution-cards/EXEC-011-chatgpt-dev-connector-hardening.claude-review/validator_result.json
- execution-cards/EXEC-011-chatgpt-dev-connector-hardening.claude-review/handshake.json（未创建；本轮未整卡委派给子代理）

validation commands:
- `node --import tsx --test tests/*.test.ts`
- `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- `node ./node_modules/typescript/bin/tsc -p tsconfig.json`
- `powershell -NoProfile -ExecutionPolicy Bypass -File ".\execution-cards\validate-execution-cards.ps1" -CardsDir ".\execution-cards"`（from `<repo-root>`）
- `py -3 "$env:CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py" --closure "execution-cards/EXEC-011-chatgpt-dev-connector-hardening.claude-review/closure.json"`（from `<repo-root>`）

validation results, including exit code:
- `node --import tsx --test tests/*.test.ts`：128 tests（测试），128 pass（通过），0 fail（失败），exit code（退出码）0。
- `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`：PASS（通过），exit code（退出码）0。
- `node ./node_modules/typescript/bin/tsc -p tsconfig.json`：PASS（通过），exit code（退出码）0。
- `validate-execution-cards.ps1`：`PASS execution card validation`，`cards=12`，exit code（退出码）0。
- `validate_closure.py`：`status=passed`，`can_write_complete=true`，exit code（退出码）0。
- Claude closeout（Claude 收口复核）：cycle 1 `recommendation=concerns`，候选问题 R1-I1 已接受为阻塞并修复；cycle 2 `recommendation=support`，无新候选问题。

skipped validations and reason:
- live `ChatGPT developer mode`（聊天网页端开发者模式）网页点击验证可因账号/工作区/隧道能力不可用而跳过，但必须记录原因。
- production `OAuth`（开放授权）`IdP`（身份提供方）集成可跳过，但必须记录为本卡范围外。
- `npm test`、`npm run typecheck`、`npm run build`：UNC（网络共享路径）下 `cmd.exe`（命令外壳）会退回 Windows（视窗系统）目录，输出不是有效仓库验证；已运行等效直接 `node`（节点运行时）命令。

protected files unchanged:
- 未通过公网隧道读取真实私有仓库。
- 未保存真实 token（令牌）、client secret（客户端密钥）或 callback credential（回调凭据）。

remaining blockers:
- none（无）

completion status:
- complete（完成）

## 8. Non-Completion Rule（非完成规则）

通用规则：required artifact path missing（必交产物路径缺失）、终止状态缺少 Claude closeout（Claude 收口复核）侧车证据、`validate_closure.py` 未通过、或 Claude 候选问题未分类时，不得写 `complete`（完成）。

如果发现端点仍会挂起、未知路径仍进入 `MCP`（模型上下文协议）传输、连续请求仍触发重复连接错误、或文档仍暗示本地 `127.0.0.1`（本机地址）可直接作为 `ChatGPT`（聊天网页端）最终服务器 `URL`（网址），不得写 `complete`（完成）。

## Claude Closeout Review（终止回写前外部复核）

- 在写入 `complete`、`blocked`、`failed` 或 `aborted` 等终止状态前，必须调用 `claude-taskcard-review`（Claude 任务卡复核）并把输入、回执、`closure`（收口）和 `validator_result`（校验结果）写入同名 `.claude-review` 侧车目录。
- `closure.json` 必须通过 `$CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py`；若 `CODEX_HOME` 不可用，必须记录解析到的脚本路径或阻塞原因。
- `Claude findings`（Claude 候选问题）只作为 `advisory`（建议性）证据；执行器必须把每个候选问题分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`，并写明本地证据。
- `complete`（完成）要求最新 Claude receipt（回执）为 `call_status=ok`、所有 `accepted_blocking` 已解决、`validate_closure.py` 报告可写完成；否则只能按本地证据写 `blocked`、`failed` 或 `aborted`。
- 若整卡委派给子代理执行，子代理在业务工作前必须先写 `execution-cards/EXEC-011-chatgpt-dev-connector-hardening.claude-review/handshake.json`，且其中 `agent_role` 必须是 `executor`（执行者）。
