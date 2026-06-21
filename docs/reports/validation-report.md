# Validation Report（校验报告）

状态：implementation_complete_with_exec013_doc_preconnect（实现已完成，并补充 EXEC-013 文档归类与接入前链路复验）。

跨电脑说明：本报告保留历史验证摘要。历史 `.claude-review`（Claude 复核）回执和 validator（校验器）结果中的绝对路径属于当时运行证据，不是新接入人员要复制的路径；新接入说明以根目录 `CONNECT_CHATGPT.md` 和 `<repo-root>`（仓库根目录）占位符为准。

## 本地静态校验计划

- 文件存在性：确认必交产物全部落盘。
- JSON 格式：确认 `tool-schemas.json` 可解析。
- 范围保护：确认本次未读取本地仓库、未写当前仓库、未实现代码。

## 外部复核计划

- 子代理安全复核：安全、隐私、授权、提示注入、泄露风险。
- 子代理架构复核：模块边界、责任划分、演进路径。
- 子代理验收复核：证据、测试矩阵、任务闭环。
- 子代理依赖复核：官方协议兼容、依赖取舍、待确认能力。
- Claude 外部复核：任务卡完整性、证据闭环、状态诚实性。

## 待更新

第二轮复核完成后记录：
- call_status（调用状态）。
- recommendation（建议）。
- accepted_blocking（接受的阻塞问题）。
- accepted_non_blocking（接受的非阻塞问题）。
- rejected_false_positive（判定为误报）。
- final_status（最终状态）。

## First Subagent Review Triage（第一轮子代理复核归并）

接受为阻塞并已回写任务卡：
- 授权授予对象与工具调用绑定关系未定义。
- 索引器/符号解析器隔离未定义。
- 单次大小限制不足，缺少累计外泄预算。
- 提示注入仅有原则，缺少结构化隔离契约。
- 仓库注册/解绑与快照生命周期未闭环。
- 工具错误/拒绝响应契约未统一。
- 证据包缺少哈希、保留期和可回放字段。

已修改文件：
- docs/design/task-card.md：新增第 17 节复核驱动修订。
- docs/design/test-matrix.md：新增 T-023 到 T-032。
- docs/design/threat-model.md：新增复核威胁控制。
- docs/design/evidence-template.md：新增完整性字段。

仍待确认：
- 依赖/协议子代理第二轮结果。
- Claude 第二轮基于持久化产物的复核。

## Dependency Review Triage（依赖/协议复核归并）

接受并已回写任务卡：
- 工具 metadata 不足，需要 description、schema 默认值/枚举、structuredContent 和 content fallback 策略。
- readOnlyHint/destructiveHint/openWorldHint 只是提示，不能当安全边界。
- 授权契约需补 securitySchemes、well-known discovery 和 `_meta["mcp/www_authenticate"]`。
- connector discovery 需补 name、description、/mcp endpoint、server instructions。
- UI 路径需二选一；第一版决策为无 UI widget，仅数据工具。
- 核心依赖建议锁定官方 @modelcontextprotocol/sdk；inspector 仅测试；ext-apps 后置到 UI 任务。
- repo.search/repo.tree 分页游标为待确认；repo.symbols 第一版只做 definitions。

## Final Review Closure（最终复核闭环）

状态：design_ready（设计就绪）；未授权实现。

### Subagent review status（子代理复核状态）

- security-reviewer（安全复核）：completed（完成）。结论：初稿风险高；授权绑定、索引隔离、累计外泄预算、提示注入隔离为阻塞项。处理：已接受为阻塞并写入 `docs/design/task-card.md` 第 17 节、`docs/design/test-matrix.md` T-023 到 T-032、`docs/design/threat-model.md` 和 `docs/design/evidence-template.md`。
- architect（架构复核）：completed（完成）。结论：状态机混层、模块责任不清、仓库注册/快照清单/授权存储/提示注入包装缺失。处理：已接受并写入第 17 节。
- verifier（验收复核）：completed（完成）。结论：快照生命周期、错误契约、上限规则、证据完整性不足。处理：已接受并写入第 17 节和测试矩阵。
- dependency-expert（依赖/协议复核）：completed（完成）。结论：需补工具 metadata、授权 discovery/challenge、connector discovery、UI 决策、官方 SDK 依赖、分页与符号范围。处理：已接受并写入 `docs/design/task-card.md` 第 18 节、`docs/design/official-evidence.md` OE-012 到 OE-014。

### Claude review status（Claude 外部复核状态）

- cycle 1：call_status=ok；recommendation=insufficient_evidence。主要问题：草案未持久化、验证证据不足、设计任务与实现任务完成条件混淆。处理：已创建共享目录内持久化产物，并区分 Design Done 与 Implementation Gate。
- cycle 2：call_status=ok；recommendation=concerns。主要问题：`docs/reports/validation-report.md` 仍为 pending，任务卡状态仍为待复核。处理：本节完成最终回写，`docs/design/task-card.md` 状态已改为 `design_ready`。
- Claude candidate issues disposition：
  - R1-I1 validation-report intermediate state：accepted_blocking，已修复。
  - R1-I2 task-card status mismatch：accepted_non_blocking，已修复。

### Local validation（本地静态校验）

- 必交产物存在性：pass。
- `tool-schemas.json` JSON 解析：pass。
- 本地仓库读取：skipped，原因：用户明确要求不要读取本地仓库。
- 运行时 MCP/ChatGPT 验证：skipped，原因：本任务为设计任务，未授权实现或启动服务。

### Final status（最终状态）

`design_ready`（设计就绪）。

此状态仅表示设计任务卡和配套规格已形成并经过交叉复核；不表示 MCP 服务已实现、ChatGPT 已连接、工具已运行或安全测试已通过。

## EXEC-013 Documentation And Preconnect Closure（文档归类与接入前链路闭环）

状态：`implementation_complete_with_exec013_doc_preconnect`（实现已完成，并补充文档归类与接入前链路复验）。

本次已把根目录历史设计/报告文档归入 `docs/`：
- 设计权威：`docs/design/task-card.md`、`docs/design/official-evidence.md`、`docs/design/threat-model.md`、`docs/design/test-matrix.md`、`docs/design/evidence-template.md`。
- 报告与历史回执：`docs/reports/validation-report.md`、`docs/reports/claude-cycle2.receipt.json`。
- 根目录保留 `README.md`、`CONNECT_CHATGPT.md`、`tool-schemas.json` 和主目录。

新增 `CONNECT_CHATGPT.md` 作为新接入人员主入口，覆盖本地验证、Secure MCP Tunnel（安全 MCP 隧道）、ChatGPT（聊天式GPT）配置、真实仓库限制和失败排查。

Claude（外部评审模型）cycle 1 指出运行态 `repo.tree` 返回空条目，已接受为阻塞并修复：`implementation/src/tools/read-only-tools.ts` 现在把 `path='.'`、`path='./'`、空字符串和缺省路径统一为仓库根路径；`implementation/tests/read-only-tools.test.ts` 新增根路径和越权路径覆盖。

验证摘要：
- `tool-schemas.json` 解析：PASS，exit code（退出码）0。
- `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`：PASS，exit code（退出码）0。
- `node --import tsx --test tests/read-only-tools.test.ts`：PASS，16 tests（测试）通过，exit code（退出码）0。
- `node --import tsx --test tests/*.test.ts`：PASS，132 tests（测试）通过，exit code（退出码）0。
- `node ./node_modules/typescript/bin/tsc -p tsconfig.json`：PASS，exit code（退出码）0。
- `validate-execution-cards.ps1`：PASS，`cards=14`，exit code（退出码）0。
- 本地运行态：`node dist/startup.js --port 3100` 启动成功，`GET /connector-meta` 返回 200，`GET /.well-known/oauth-protected-resource` 返回 200，`POST /mcp initialize` 返回 200，`POST /mcp notifications/initialized` 返回 202。
- 真实工具调用：`POST /mcp tools/call repo.tree` 请求省略 `repo_id`（仓库标识）和 `snapshot_id`（快照标识），响应 `repo_id=repo-384c0d3e-861`、`snapshot_id=snap-1782066527170`、`toolCallStatus=200`，`entries_count=1`，包含安全条目 `README.md`，未返回 `isError=true`。原始证据见 `execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/runtime-preconnect-chain.json`。
- 停止验证：服务已停止，`http://127.0.0.1:3100/connector-meta` 不再监听。
- Claude closeout（Claude 收口复核）：cycle 1 `recommendation=concerns`，R1-I1 接受为阻塞并修复，R1-I2 接受为非阻塞并修复；cycle 2 `recommendation=support`，无新候选问题。`closure.json` 已通过 `validate_closure.py`，`status=passed`，`can_write_complete=true`。

跳过项保持边界：
- live ChatGPT web（聊天式GPT网页端）实际点击验证未执行。
- production OAuth 2.1/OIDC（开放授权二点一/开放身份连接）未执行。
- 真实私有仓库隧道验证未执行。

## Execution Card Closure（执行卡拆分闭环）

状态：`implementation_complete_with_exec013_doc_preconnect`（实现已完成，并补充 EXEC-013 文档归类与接入前链路复验）。

以下 `EXEC-000` 到 `EXEC-012` 段落为 EXEC-013 之前的历史闭环记录；当前活动执行卡数量以本报告上方 EXEC-013 摘要和 `execution-cards/task-import-map.json` 为准，即 14 张。

本次已把设计拆为 13 张活动执行卡：`EXEC-000` 到 `EXEC-012`。增强校验命令：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File ".\execution-cards\validate-execution-cards.ps1" -CardsDir ".\execution-cards"
```

结果：`PASS execution card validation`，`cards=13`，exit code（退出码）`0`。

子代理复核已归并并修复：架构覆盖、证据完整性、旧 Claude 回执、工具模式安全字段、快照不可变语义、显式授权、证据保留清理、validator 过浅问题。

Claude 外部复核：`execution-cards/execution-cards.claude-review/cycle1.receipt.json`，`call_status=ok`，`recommendation=support`。收口文件 `execution-cards/execution-cards.claude-review/closure.json` 已通过 `validate_closure.py`，`can_write_complete=true`。

补充执行：`EXEC-011` 已完成仓库内开发连接链路硬化，验证命令 `node --import tsx --test tests/*.test.ts` 通过 128 项测试，`node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` 和 `node ./node_modules/typescript/bin/tsc -p tsconfig.json` 均为 exit code（退出码）`0`。

`EXEC-011` Claude closeout（Claude 收口复核）已完成两轮：cycle 1 `recommendation=concerns`，候选问题 R1-I1 已接受为阻塞并补测；cycle 2 `recommendation=support`，无新候选问题。`execution-cards/EXEC-011-chatgpt-dev-connector-hardening.claude-review/closure.json` 已通过 `validate_closure.py`，`can_write_complete=true`。

补充接入修正：开发模式工具调用已支持缺省 `repo_id`（仓库标识）和 `snapshot_id`（快照标识），由当前 runtime manifest/session（运行态清单/会话）默认绑定；显式错误仓库或快照仍拒绝。验证命令 `node --import tsx --test tests/*.test.ts` 通过 130 项测试，`node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`、`node ./node_modules/typescript/bin/tsc -p tsconfig.json` 均通过；本地 `node dist/startup.js --port 3100` 启动后 `/connector-meta` 返回 200，`/.well-known/oauth-protected-resource` 返回 200，`/.well-known/oauth-authorization-server` 返回 501，`POST /mcp initialize` 返回 200。服务已停止，3100 端口不再监听。

`EXEC-012` 已作为正式补强卡加入执行链并完成，`validate-execution-cards.ps1` 返回 `PASS execution card validation`，`cards=13`。补充真实 MCP `tools/call repo.tree`（模型上下文协议工具调用）验证：请求省略 `repo_id`（仓库标识）和 `snapshot_id`（快照标识），响应返回当前 runtime repo/snapshot（运行态仓库/快照）`repo-620d9f23-882` / `snap-1782062016790`，`toolCallStatus=200`，未返回 `isError=true`；原始请求/响应证据见 `execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/runtime-repo-tree-call.json`。

`EXEC-012` Claude closeout（Claude 收口复核）已完成两轮：cycle 1 `recommendation=concerns`，R2-I1 接受为阻塞并修复；cycle 2 `recommendation=support`，低风险 traceability（可追踪性）建议已本地修复。`execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/closure.json` 已通过 `validate_closure.py`，`status=passed`，`can_write_complete=true`。

注意：此状态表示任务卡拆分、本地开发连接端点硬化和 EXEC-012 默认上下文接入就绪补强已完成；不表示真实仓库读取完成、ChatGPT 网页端实际连接完成、生产 OAuth 2.1/OIDC（开放授权二点一/开放身份连接）接入完成或生产安全验证完成。
