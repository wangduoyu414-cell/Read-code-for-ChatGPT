# EXEC-013：文档归类与 ChatGPT 接入前链路打通

状态：complete（完成）。
依赖：EXEC-012 complete（完成）。

## 1. Objective（目标）

把仓库文档按责任归类，让根目录只保留入口说明和全局权威文件；同时重新验证从本地实现到 ChatGPT（聊天式GPT）接入前的完整链路，最后在根目录写出一份新接入人员可直接照做的说明书。

本卡只证明本地 MCP server（模型上下文协议服务器）到接入前检查已打通：构建、类型检查、测试、服务启动、发现端点、MCP initialize（初始化）、initialized notification（初始化通知）和 `repo.tree` 真实工具调用。不声明 live ChatGPT web（网页端）实际点击、生产 OAuth（开放授权）或真实私有仓库公网读取完成。

## 2. Scope（范围）

Allowed files（允许修改）：
- `README.md`
- `CONNECT_CHATGPT.md`
- `docs/README.md`
- `docs/design/*`
- `docs/reports/*`
- `implementation/src/tools/read-only-tools.ts`
- `implementation/tests/read-only-tools.test.ts`
- `execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.md`
- `execution-cards/EXEC-000-design-baseline-coverage-gate.md`
- `execution-cards/EXEC-009-audit-evidence-log-privacy.md`
- `execution-cards/EXEC-010-e2e-validation-chatgpt-connector.md`
- `execution-cards/EXEC-011-chatgpt-dev-connector-hardening.md`
- `execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.md`
- `execution-cards/index.md`
- `execution-cards/task-import-map.json`
- `execution-cards/execution-validation-report.md`
- `execution-cards/validate-execution-cards.ps1`
- `docs/reports/validation-report.md`
- `implementation/docs/*.md`

Forbidden changes（禁止）：
- 不修改运行时代码和测试代码，除非验证发现阻塞且另行记录。
- 不移动 `tool-schemas.json`，它仍是根目录工具模式权威。
- 不接入生产 OAuth（开放授权）或真实 IdP（身份提供方）。
- 不把 `http://127.0.0.1:3100/mcp` 写成 ChatGPT（聊天式GPT）网页端最终可用地址；它只适合本机和隧道目标。
- 不通过公网临时隧道读取真实私有仓库。
- 不删除既有执行卡、回执或历史证据。

## 必交产物（Required Deliverables）

Primary deliverables（主产物；路径相对本项目根目录）：
- `README.md`
- `CONNECT_CHATGPT.md`
- `docs/README.md`
- `docs/design/task-card.md`
- `docs/design/official-evidence.md`
- `docs/design/threat-model.md`
- `docs/design/test-matrix.md`
- `docs/design/evidence-template.md`
- `docs/reports/validation-report.md`
- `docs/reports/claude-cycle2.receipt.json`
- `implementation/src/tools/read-only-tools.ts`
- `implementation/tests/read-only-tools.test.ts`
- `execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.md`
- `execution-cards/index.md`
- `execution-cards/task-import-map.json`
- `execution-cards/execution-validation-report.md`
- `execution-cards/validate-execution-cards.ps1`

Closeout deliverables（收口产物；终止状态回写前必须存在）：
- `execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/cycle1.input.json`
- `execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/cycle1.receipt.json`
- `execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/closure.json`
- `execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/validator_result.json`
- `execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/runtime-preconnect-chain.json`
- `execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/handshake.json`（仅整卡委派给子代理执行时必须先创建）

Artifact existence validation（产物存在性校验）：
- 终止状态回写前，执行器必须用 `Test-Path` 或等效方法确认每个必交产物存在。
- required artifact path missing（必交产物路径缺失）、路径仍为通配符且未列出实际文件、或产物无法从证据追踪时，不得写 `complete`（完成）。

## 3. Required Work（必须执行）

- 读取 `docs/design/task-card.md`、`docs/design/official-evidence.md`、`docs/design/test-matrix.md`、`docs/design/threat-model.md`、`tool-schemas.json` 和 `implementation/docs/chatgpt-connector-setup.md`，保持只读、安全和接入边界不漂移。
- 建立 `docs/` 文档分类入口，区分 design（设计权威）、reports（报告与回执）、implementation docs（实现文档）和 execution-cards（执行任务卡）。
- 把根目录历史设计/报告文档移动到 `docs/design/` 和 `docs/reports/`，并更新活动文档中的引用。
- 保持 `tool-schemas.json` 留在根目录，避免破坏校验脚本和工具模式权威位置。
- 新增根目录 `CONNECT_CHATGPT.md`，写清本地准备、验证命令、服务端点、Secure MCP Tunnel（安全 MCP 隧道）接入方式、ChatGPT（聊天式GPT）侧填写项、真实仓库限制和失败排查。
- 重新执行本地接入前链路验证，并把运行态 `initialize`、`notifications/initialized`、`tools/call repo.tree` 请求/响应摘要写入同名 `.claude-review` 侧车证据。
- 更新执行卡索引、导入映射和验证报告，把本卡作为 EXEC-012 之后的正式整理与接入前验证卡。

## 4. Acceptance Criteria（验收标准）

- AC-001：根目录只保留入口说明、根级工具模式文件和主目录；设计与报告文档已归入 `docs/`。
- AC-002：活动文档引用不再把已移动的设计/报告文件描述为根目录文件；历史回执和归档文件可保留原始引用。
- AC-003：`CONNECT_CHATGPT.md` 可让新接入人员理解从安装依赖、构建验证、启动服务、隧道目标到 ChatGPT（聊天式GPT）配置的完整步骤。
- AC-004：说明书明确 `127.0.0.1` 只作为本机服务地址或隧道目标，ChatGPT（聊天式GPT）最终连接需要 HTTPS（安全超文本传输）可访问 MCP endpoint（模型上下文协议端点）或 Secure MCP Tunnel（安全 MCP 隧道）。
- AC-005：本地 `tool-schemas.json` 解析、TypeScript（类型脚本）类型检查、测试、构建、执行卡结构校验均通过。
- AC-006：启动本地服务后，`/connector-meta`、`/.well-known/oauth-protected-resource`、`POST /mcp initialize`、`POST /mcp notifications/initialized`、`POST /mcp tools/call repo.tree` 验证通过，且 `repo.tree` 请求省略 `repo_id` 和 `snapshot_id`。
- AC-007：终止回写前完成 Claude closeout（Claude 收口复核），候选问题已本地分类，`validate_closure.py` 报告可写完成。

## 5. Validation（校验）

Commands（命令）：
- `node -e "JSON.parse(require('fs').readFileSync('../tool-schemas.json','utf8')); console.log('tool-schemas json ok')"`
- `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- `node --import tsx --test tests/*.test.ts`
- `node ./node_modules/typescript/bin/tsc -p tsconfig.json`
- `node dist/startup.js --port 3100`
- `GET http://127.0.0.1:3100/connector-meta`
- `GET http://127.0.0.1:3100/.well-known/oauth-protected-resource`
- `POST http://127.0.0.1:3100/mcp initialize`
- `POST http://127.0.0.1:3100/mcp notifications/initialized`
- `POST http://127.0.0.1:3100/mcp tools/call repo.tree`，arguments（参数）只包含 `path`、`depth`、`limit`。
- `powershell -NoProfile -ExecutionPolicy Bypass -File ".\execution-cards\validate-execution-cards.ps1" -CardsDir ".\execution-cards"`（from `<repo-root>`）
- `py -3 "$env:CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py" --closure "execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/closure.json"`（from `<repo-root>`）

## 6. Required Evidence（所需证据）

- 文档归类前后文件清单摘要。
- `CONNECT_CHATGPT.md` 存在并包含接入前验证、ChatGPT（聊天式GPT）侧设置、隧道边界和真实仓库限制。
- `tool-schemas.json` 解析结果。
- TypeScript（类型脚本）检查、测试和构建输出摘要及退出码。
- 本地服务启动与停止证据。
- 发现端点、MCP initialize（初始化）、initialized notification（初始化通知）和省略 repo/snapshot（仓库/快照）的 `tools/call repo.tree` 响应摘要。
- 执行卡结构校验输出。
- Claude closeout（Claude 收口复核）回执、候选问题分类和 closure validation（收口校验）结果。

## 7. Completion Writeback（完成回写）

changed files:
- README.md
- CONNECT_CHATGPT.md
- docs/README.md
- docs/design/task-card.md
- docs/design/official-evidence.md
- docs/design/threat-model.md
- docs/design/test-matrix.md
- docs/design/evidence-template.md
- docs/reports/validation-report.md
- implementation/src/tools/read-only-tools.ts
- implementation/tests/read-only-tools.test.ts
- execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.md
- execution-cards/index.md
- execution-cards/task-import-map.json
- execution-cards/execution-validation-report.md
- execution-cards/validate-execution-cards.ps1
- implementation/docs/chatgpt-connector-setup.md
- implementation/docs/design-baseline-read-receipt.md
- implementation/docs/requirement-coverage-map.md
- implementation/docs/implementation-decisions.md
- implementation/docs/mcp-gateway-contract.md

created artifacts:
- CONNECT_CHATGPT.md
- docs/README.md
- docs/design/task-card.md
- docs/design/official-evidence.md
- docs/design/threat-model.md
- docs/design/test-matrix.md
- docs/design/evidence-template.md
- docs/reports/validation-report.md
- docs/reports/claude-cycle2.receipt.json
- execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.md
- execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/runtime-preconnect-chain.json
- execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/cycle1.input.json
- execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/cycle1.receipt.json
- execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/cycle2.input.json
- execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/cycle2.receipt.json
- execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/closure.json
- execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/validator_result.json
- execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/handshake.json（未整卡委派时可记录为未创建）

validation commands:
- `node --import tsx --test tests/read-only-tools.test.ts`
- `node -e "JSON.parse(require('fs').readFileSync('../tool-schemas.json','utf8')); console.log('tool-schemas json ok')"`
- `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`
- `node --import tsx --test tests/*.test.ts`
- `node ./node_modules/typescript/bin/tsc -p tsconfig.json`
- `powershell -NoProfile -ExecutionPolicy Bypass -File ".../execution-cards/validate-execution-cards.ps1" -CardsDir ".../execution-cards"`
- `node dist/startup.js --port 3100`
- `GET /connector-meta`
- `GET /.well-known/oauth-protected-resource`
- `POST /mcp initialize`
- `POST /mcp notifications/initialized`
- `POST /mcp tools/call repo.tree` with arguments only `path='.'`、`depth=1`、`limit=10`
- `py -3 "$env:CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py" --closure "execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/closure.json"`（from `<repo-root>`）

validation results, including exit code:
- `node --import tsx --test tests/read-only-tools.test.ts`：PASS（通过），16 tests（测试），6 suites（测试套件），exit code（退出码）0。
- `tool-schemas.json` 解析：PASS（通过），exit code（退出码）0。
- `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`：PASS（通过），exit code（退出码）0。
- `node --import tsx --test tests/*.test.ts`：PASS（通过），132 tests（测试），24 suites（测试套件），exit code（退出码）0。
- `node ./node_modules/typescript/bin/tsc -p tsconfig.json`：PASS（通过），exit code（退出码）0。
- `validate-execution-cards.ps1`：`PASS execution card validation`，`cards=14`，exit code（退出码）0。
- 本地服务启动：PASS（通过），`http://127.0.0.1:3100/mcp` ready（就绪），fixture（测试夹具）仓库。
- `GET /connector-meta`：status（状态）200。
- `GET /.well-known/oauth-protected-resource`：status（状态）200。
- `POST /mcp initialize`：status（状态）200。
- `POST /mcp notifications/initialized`：status（状态）202。
- `POST /mcp tools/call repo.tree`：status（状态）200；请求省略 `repo_id` 和 `snapshot_id`；响应 `repo_id=repo-384c0d3e-861`、`snapshot_id=snap-1782066527170`、`entries_count=1`，包含 `README.md`，未返回 `isError=true`。
- 停止验证：已停止 `node dist/startup.js --port 3100`，`http://127.0.0.1:3100/connector-meta` 不再监听。
- Claude closeout（Claude 收口复核）：cycle 1 `recommendation=concerns`，R1-I1 接受为阻塞并修复，R1-I2 接受为非阻塞并修复；cycle 2 `recommendation=support`，无新候选问题。
- `validate_closure.py`：`status=passed`，`can_write_complete=true`，exit code（退出码）0。

skipped validations and reason:
- live ChatGPT web（聊天式GPT网页端）实际点击验证未执行，原因：需要用户账号、工作区和隧道界面能力。
- production OAuth 2.1/OIDC（开放授权二点一/开放身份连接）未执行，原因：本卡范围外。
- 真实私有仓库隧道验证未执行，原因：本卡只验证 fixture（测试夹具）仓库和本地链路。
- `handshake.json` 未创建，原因：本卡由主窗口执行，未整卡委派给子代理。

protected files unchanged:
- 未接入生产 OAuth（开放授权）或真实 IdP（身份提供方）。
- 未移动 `tool-schemas.json`。
- 未读取真实私有仓库。
- 未通过公网临时隧道暴露仓库代码。
- 最小运行时代码修复仅限 `repo.tree` 对 `path='.'` 的根路径归一化；未扩大工具权限或读取范围。

remaining blockers:
- none（无；live ChatGPT web、production OAuth 和真实私有仓库验证均为本卡范围外事项）

completion status:
- complete（完成）

## 8. Non-Completion Rule（非完成规则）

通用规则：required artifact path missing（必交产物路径缺失）、终止状态缺少 Claude closeout（Claude 收口复核）侧车证据、`validate_closure.py` 未通过、或 Claude 候选问题未分类时，不得写 `complete`（完成）。

如果本地服务未成功启动、接入前 MCP（模型上下文协议）链路没有真实 `tools/call repo.tree` 证据、说明书把 `127.0.0.1` 误写成 ChatGPT（聊天式GPT）最终 server URL（服务器网址）、或文档移动后活动引用明显断裂，不得写 `complete`（完成）。

## Claude Closeout Review（终止回写前外部复核）

- 在写入 `complete`、`blocked`、`failed` 或 `aborted` 等终止状态前，必须调用 `claude-taskcard-review`（Claude 任务卡复核）并把输入、回执、`closure`（收口）和 `validator_result`（校验结果）写入同名 `.claude-review` 侧车目录。
- `closure.json` 必须通过 `$CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py`；若 `CODEX_HOME` 不可用，必须记录解析到的脚本路径或阻塞原因。
- `Claude findings`（Claude 候选问题）只作为 `advisory`（建议性）证据；执行器必须把每个候选问题分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`，并写明本地证据。
- `complete`（完成）要求最新 Claude receipt（回执）为 `call_status=ok`、所有 `accepted_blocking` 已解决、`validate_closure.py` 报告可写完成；否则只能按本地证据写 `blocked`、`failed` 或 `aborted`。
- 若整卡委派给子代理执行，子代理在业务工作前必须先写 `execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/handshake.json`，且其中 `agent_role` 必须是 `executor`（执行者）。
