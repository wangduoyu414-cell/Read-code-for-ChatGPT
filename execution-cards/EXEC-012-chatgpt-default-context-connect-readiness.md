# EXEC-012：ChatGPT 默认上下文接入就绪补强

状态：complete（完成）。
依赖：EXEC-011 complete（完成）。

## 1. Objective（目标）

让 `ChatGPT`（聊天网页端）开发连接器在接入当前 MCP server（模型上下文协议服务器）后，可以直接调用四个只读工具，不需要用户从启动日志里手动复制 `repo_id`（仓库标识）和 `snapshot_id`（快照标识）。

本卡只完成开发接入就绪补强：默认绑定当前已初始化的 repo/snapshot（仓库/快照）、补文档照填步骤、补运行态工具调用验证。不声明生产 `OAuth`（开放授权）或真实私有仓库读取完成。

## 2. Scope（范围）

Allowed files（允许修改）：
- `implementation/src/tools/registry.ts`
- `implementation/src/server.ts`
- `implementation/tests/server-smoke.test.ts`
- `implementation/docs/chatgpt-connector-setup.md`
- `README.md`
- `tool-schemas.json`
- `execution-cards/index.md`
- `execution-cards/task-import-map.json`
- `execution-cards/execution-validation-report.md`
- `docs/reports/validation-report.md`
- `execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.md`

Forbidden changes（禁止）：
- 不接真实生产 `IdP`（身份提供方）。
- 不把 `dev_local`（本地开发）鉴权写成生产安全。
- 不用公网临时隧道读取真实私有仓库。
- 不取消路径守卫、敏感文件拦截、预算限制或只读约束。
- 不要求用户手动提供内部 `repo_id` 或 `snapshot_id` 才能完成开发态基本工具调用。

## 必交产物（Required Deliverables）

Primary deliverables（主产物；路径相对本项目根目录）：
- implementation/src/tools/registry.ts
- implementation/src/server.ts
- implementation/tests/server-smoke.test.ts
- implementation/docs/chatgpt-connector-setup.md
- README.md
- tool-schemas.json
- execution-cards/index.md
- execution-cards/task-import-map.json
- execution-cards/execution-validation-report.md
- docs/reports/validation-report.md
- execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.md

Closeout deliverables（收口产物；终止状态回写前必须存在）：
- execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/cycle1.input.json
- execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/cycle1.receipt.json
- execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/cycle2.input.json（仅第一轮存在 accepted_blocking 后需要）
- execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/cycle2.receipt.json（仅第一轮存在 accepted_blocking 后需要）
- execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/closure.json
- execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/validator_result.json
- execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/handshake.json（仅整卡委派给子代理执行时必须先创建）

Artifact existence validation（产物存在性校验）：
- 终止状态回写前，执行器必须用 `Test-Path` 或等效方法确认每个必交产物存在。
- required artifact path missing（必交产物路径缺失）、路径仍为通配符且未列出实际文件、或产物无法从证据追踪时，不得写 `complete`（完成）。

## 3. Required Work（必须执行）

- 读取 `docs/design/task-card.md`、`docs/design/official-evidence.md`、`docs/design/test-matrix.md`、`docs/design/threat-model.md` 和 `tool-schemas.json`，保持只读、安全和端到端验收边界不漂移。
- 让 `repo_id` 和 `snapshot_id` 在 MCP tool input（模型上下文协议工具输入）中成为可选字段；缺省时必须使用当前 runtime manifest/session（运行态清单/会话）中的 repo/snapshot。
- 显式传入错误 `repo_id` 时必须拒绝；显式传入错误 `snapshot_id` 时必须沿用跨工具快照一致性拒绝逻辑。
- `server.ts` 不得把缺省 `repo_id` 或 `snapshot_id` 预填成 `"unknown"`（未知）后传入工具调度层。
- 更新 `tool-schemas.json`，让设计 schema（结构模式）与运行态输入契约一致。
- 更新 `chatgpt-connector-setup.md`，给出本地构建、启动、Tunnel（隧道）目标、ChatGPT connector（聊天网页端连接器）字段和真实仓库限制。
- 启动本地服务后，执行一次真实 MCP `tools/call`（工具调用）请求，调用 `repo.tree` 且省略 `repo_id` 和 `snapshot_id`，证明运行态默认绑定生效。
- 更新执行卡索引、导入映射和验证报告，把本卡作为 EXEC-011 之后的正式补强卡。

## 4. Acceptance Criteria（验收标准）

- AC-001：`repo.tree`、`repo.search`、`repo.fetch`、`repo.symbols` 的 input schema（输入结构模式）不再要求 `repo_id` 和 `snapshot_id`。
- AC-002：省略 `repo_id` 和 `snapshot_id` 调用 `repo.tree` 时，响应包含当前 runtime（运行态）的真实 `repo_id` 和 `snapshot_id`，且 `isError` 不是 `true`。
- AC-003：显式错误 `repo_id` 返回结构化拒绝；显式错误 `snapshot_id` 仍返回快照不匹配或未就绪拒绝。
- AC-004：`tool-schemas.json` 可解析，且与可选 repo/snapshot 契约一致。
- AC-005：`chatgpt-connector-setup.md` 给出无需内部标识的开发接入步骤，并明确 `127.0.0.1` 不能直接作为 ChatGPT 网页端最终 server URL（服务器网址）。
- AC-006：执行卡索引和 `task-import-map.json` 纳入 `EXEC-012`，结构校验通过。

## 5. Validation（校验）

Commands（命令）：
- `node -e "JSON.parse(require('fs').readFileSync('../tool-schemas.json','utf8')); console.log('tool-schemas json ok')"`
- `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- `node --import tsx --test tests/*.test.ts`
- `node ./node_modules/typescript/bin/tsc -p tsconfig.json`
- `node dist/startup.js --port 3100`
- `POST http://127.0.0.1:3100/mcp initialize`
- `POST http://127.0.0.1:3100/mcp notifications/initialized`
- `POST http://127.0.0.1:3100/mcp tools/call repo.tree`，arguments（参数）只包含 `path`、`depth`、`limit`。
- `powershell -NoProfile -ExecutionPolicy Bypass -File ".\execution-cards\validate-execution-cards.ps1" -CardsDir ".\execution-cards"`（from `<repo-root>`）
- `py -3 "$env:CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py" --closure "execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/closure.json"`（from `<repo-root>`）

## 6. Required Evidence（所需证据）

- 省略 repo/snapshot 的 `tools/call repo.tree` 响应摘要，必须包含响应中的 `repo_id`、`snapshot_id`、`entries` 和错误状态。
- 单元测试输出摘要和退出码。
- TypeScript（类型脚本）检查与构建退出码。
- `tool-schemas.json` 解析结果。
- 执行卡结构校验输出。
- 本地服务启动与停止证据。
- Claude closeout（Claude 收口复核）回执、候选问题分类和 closure validation（收口校验）结果。

## 7. Completion Writeback（完成回写）

changed files:
- implementation/src/tools/registry.ts
- implementation/src/server.ts
- implementation/tests/server-smoke.test.ts
- implementation/docs/chatgpt-connector-setup.md
- README.md
- tool-schemas.json
- execution-cards/index.md
- execution-cards/task-import-map.json
- execution-cards/execution-validation-report.md
- docs/reports/validation-report.md
- execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.md

created artifacts:
- execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.md
- execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/cycle1.input.json
- execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/cycle1.receipt.json
- execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/cycle2.input.json（如运行）
- execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/cycle2.receipt.json（如运行）
- execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/closure.json
- execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/validator_result.json
- execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/handshake.json（未整卡委派时可记录为未创建）

validation commands:
- `node -e "JSON.parse(require('fs').readFileSync('../tool-schemas.json','utf8')); console.log('tool-schemas json ok')"`
- `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- `node --import tsx --test tests/*.test.ts`
- `node ./node_modules/typescript/bin/tsc -p tsconfig.json`
- `node dist/startup.js --port 3100`
- `POST /mcp initialize`
- `POST /mcp notifications/initialized`
- `POST /mcp tools/call repo.tree` with arguments only `path='.'`、`depth=1`、`limit=10`
- `powershell -NoProfile -ExecutionPolicy Bypass -File ".../execution-cards/validate-execution-cards.ps1" -CardsDir ".../execution-cards"`
- `py -3 "$env:CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py" --closure "execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/closure.json"`（from `<repo-root>`）

validation results, including exit code:
- `tool-schemas.json` 解析：PASS（通过），exit code（退出码）0。
- `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`：PASS（通过），exit code（退出码）0。
- `node --import tsx --test tests/*.test.ts`：130 tests（测试），130 pass（通过），24 suites（测试套件），exit code（退出码）0。
- `node ./node_modules/typescript/bin/tsc -p tsconfig.json`：PASS（通过），exit code（退出码）0。
- 本地服务启动：PASS（通过），`http://127.0.0.1:3100/mcp` ready（就绪），fixture（测试夹具）仓库。
- `POST /mcp initialize`：`initializeStatus=200`。
- `POST /mcp notifications/initialized`：`initializedStatus=202`。
- `POST /mcp tools/call repo.tree`：`toolCallStatus=200`；请求省略 `repo_id` 和 `snapshot_id`；响应 `structuredContent.repo_id=repo-620d9f23-882`，`structuredContent.snapshot_id=snap-1782062016790`，`entries=[]`，未返回 `isError=true`。
- `validate-execution-cards.ps1`：`PASS execution card validation`，`cards=13`，exit code（退出码）0。
- Claude closeout（Claude 收口复核）：cycle 1 `recommendation=concerns`，R2-I1 接受为阻塞并修复；R2-I2/R2-I3 接受为非阻塞并修复。cycle 2 `recommendation=support`，R3-I1/R3-I2 为低风险 traceability（可追踪性）建议，已本地修复。
- `validate_closure.py`：`status=passed`，`can_write_complete=true`，exit code（退出码）0。

skipped validations and reason:
- live `ChatGPT developer mode`（聊天网页端开发者模式）网页点击验证未执行，原因：需要用户账号、工作区和 Tunnel（隧道）界面能力。
- production `OAuth 2.1/OIDC`（开放授权二点一/开放身份连接）未执行，原因：本卡范围外且当前模式明确 blocked（阻塞）。
- 真实私有仓库隧道验证未执行，原因：本卡只使用 fixture（测试夹具）仓库，避免通过公网临时隧道暴露敏感代码。
- `handshake.json` 未创建，原因：本卡由主窗口执行，未整卡委派给子代理。

protected files unchanged:
- 未通过公网隧道读取真实私有仓库。
- 未保存真实 token（令牌）、client secret（客户端密钥）或 callback credential（回调凭据）。
- production OAuth（生产开放授权）仍为 blocked（阻塞），未声称完成。

remaining blockers:
- none（无；生产 OAuth、真实仓库和 ChatGPT 网页点击验证均为本卡范围外事项）

completion status:
- complete（完成）

## 8. Non-Completion Rule（非完成规则）

通用规则：required artifact path missing（必交产物路径缺失）、终止状态缺少 Claude closeout（Claude 收口复核）侧车证据、`validate_closure.py` 未通过、或 Claude 候选问题未分类时，不得写 `complete`（完成）。

如果省略 `repo_id`/`snapshot_id` 的真实 `tools/call` 未执行、未返回当前 runtime repo/snapshot（运行态仓库/快照）、或文档仍要求用户手动填写内部标识才能完成开发态基本工具调用，不得写 `complete`（完成）。

## Claude Closeout Review（终止回写前外部复核）

- 在写入 `complete`、`blocked`、`failed` 或 `aborted` 等终止状态前，必须调用 `claude-taskcard-review`（Claude 任务卡复核）并把输入、回执、`closure`（收口）和 `validator_result`（校验结果）写入同名 `.claude-review` 侧车目录。
- `closure.json` 必须通过 `$CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py`；若 `CODEX_HOME` 不可用，必须记录解析到的脚本路径或阻塞原因。
- `Claude findings`（Claude 候选问题）只作为 `advisory`（建议性）证据；执行器必须把每个候选问题分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`，并写明本地证据。
- `complete`（完成）要求最新 Claude receipt（回执）为 `call_status=ok`、所有 `accepted_blocking` 已解决、`validate_closure.py` 报告可写完成；否则只能按本地证据写 `blocked`、`failed` 或 `aborted`。
- 若整卡委派给子代理执行，子代理在业务工作前必须先写 `execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/handshake.json`，且其中 `agent_role` 必须是 `executor`（执行者）。
