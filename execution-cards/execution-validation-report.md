# Execution Validation Report（执行校验报告）

状态：implementation_complete_with_exec013_doc_preconnect（实现已完成，并补充 EXEC-013 文档归类与接入前链路复验）。

## EXEC-013 文档归类与接入前链路复验（2026-06-21）

目标：整理仓库文档结构，让根目录保留入口说明和全局工具模式文件；补充 `CONNECT_CHATGPT.md`，并重新验证直到接入 ChatGPT（聊天式GPT）之前的本地 MCP（模型上下文协议）链路。

文档归类结果：
- 根目录保留：`README.md`、`CONNECT_CHATGPT.md`、`tool-schemas.json`、`docs/`、`execution-cards/`、`implementation/`。
- 设计权威移动到 `docs/design/`：`task-card.md`、`official-evidence.md`、`threat-model.md`、`test-matrix.md`、`evidence-template.md`。
- 报告与旧回执移动到 `docs/reports/`：`validation-report.md`、`claude-cycle2.receipt.json`。
- `docs/README.md` 新增文档分类索引；`implementation/docs/chatgpt-connector-setup.md` 指向根目录主接入说明。
- Claude（外部评审模型）cycle 1 指出运行态 `repo.tree` 返回 `entries=[]`，与 fixture（测试夹具）非空不一致；已接受为阻塞并修复 `repo.tree` 对 `path='.'` 的根路径归一化，同时新增路径覆盖测试。

接入说明：
- 新增 `CONNECT_CHATGPT.md`，覆盖本地准备、直接 `node`（节点运行时）验证命令、本地端点验证、Secure MCP Tunnel（安全 MCP 隧道）目标、ChatGPT（聊天式GPT）连接器填写项、真实仓库限制和常见失败处理。
- 说明书明确 `http://127.0.0.1:3100/mcp` 只可作为本机验证地址或隧道本地目标，ChatGPT（聊天式GPT）最终连接需要 HTTPS（安全超文本传输）可访问 `/mcp` 地址或 Secure MCP Tunnel（安全 MCP 隧道）。

验证结果：
- `node -e "JSON.parse(require('fs').readFileSync('../tool-schemas.json','utf8')); console.log('tool-schemas json ok')"`：PASS，exit code（退出码）0。
- `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`：PASS，exit code（退出码）0。
- `node --import tsx --test tests/read-only-tools.test.ts`：PASS，16 tests（测试）通过，6 suites（测试套件）通过，exit code（退出码）0。
- `node --import tsx --test tests/*.test.ts`：PASS，132 tests（测试）通过，24 suites（测试套件）通过，exit code（退出码）0。
- `node ./node_modules/typescript/bin/tsc -p tsconfig.json`：PASS，exit code（退出码）0。
- `validate-execution-cards.ps1`：PASS，`cards=14`，exit code（退出码）0。
- 必交产物存在性：`README.md`、`CONNECT_CHATGPT.md`、`docs/README.md`、`docs/design/task-card.md`、`docs/reports/validation-report.md` 均存在。
- 本地服务启动：`node dist/startup.js --port 3100`，生成 `repo_id=repo-384c0d3e-861`、`snapshot_id=snap-1782066527170`。
- 端点验证：`GET /connector-meta` 返回 200；`GET /.well-known/oauth-protected-resource` 返回 200；`POST /mcp initialize` 返回 200；`POST /mcp notifications/initialized` 返回 202。
- 真实工具调用烟测：`POST /mcp tools/call repo.tree` 请求省略 `repo_id` 和 `snapshot_id`，只包含 `path='.'`、`depth=1`、`limit=10`；结果 `toolCallStatus=200`，响应 `structuredContent.repo_id=repo-384c0d3e-861`，`structuredContent.snapshot_id=snap-1782066527170`，`entries_count=1`，包含安全条目 `README.md`，未返回 `isError=true`。
- 原始运行证据：`execution-cards/EXEC-013-doc-taxonomy-and-preconnect-chain.claude-review/runtime-preconnect-chain.json`。
- 停止验证：已停止 `node dist/startup.js --port 3100`，`http://127.0.0.1:3100/connector-meta` 不再监听。
- Claude closeout（Claude 收口复核）：cycle 1 `recommendation=concerns`，R1-I1 接受为阻塞并修复，R1-I2 接受为非阻塞并修复；cycle 2 `recommendation=support`，无新候选问题。`closure.json` 已通过 `validate_closure.py`，`status=passed`，`can_write_complete=true`。

跳过项：
- live ChatGPT web（聊天式GPT网页端）实际点击验证未执行，原因：需要用户账号、工作区和隧道界面能力。
- production OAuth 2.1/OIDC（开放授权二点一/开放身份连接）未执行，原因：本卡范围外。
- 真实私有仓库隧道验证未执行，原因：本卡只使用 fixture（测试夹具）仓库，避免通过公网临时隧道暴露敏感代码。

结论：仓库文档已按责任边界归类，根目录说明书已补齐；本地接入前链路已打通到 MCP（模型上下文协议）真实工具调用，且运行态 `repo.tree` 已证明返回非空安全条目。仍不表示 ChatGPT（聊天式GPT）网页端实际连接、生产 OAuth（开放授权）或真实私有仓库读取已经完成。

## EXEC-012 默认上下文接入就绪补强（2026-06-21）

目标：让 ChatGPT connector（聊天网页端连接器）在开发模式下接入后，可以直接调用 `repo.tree`、`repo.search`、`repo.fetch`、`repo.symbols`，不需要用户从启动日志里手动复制 `repo_id`（仓库标识）和 `snapshot_id`（快照标识）。

变更摘要：
- `implementation/src/tools/registry.ts`：工具输入中的 `repo_id` 和 `snapshot_id` 改为可选；缺省时使用当前已初始化 runtime manifest/session（运行态清单/会话）中的仓库与快照；显式传错 `repo_id` 或 `snapshot_id` 仍拒绝。
- `implementation/src/server.ts`：MCP HTTP adapter（模型上下文协议网页适配层）不再把缺省 `repo_id`/`snapshot_id` 预填成 `"unknown"`（未知），保留调度层的上下文默认化能力。
- `implementation/tests/server-smoke.test.ts`：新增缺省 repo/snapshot（仓库/快照）自动绑定、显式仓库不匹配拒绝、快照不匹配拒绝覆盖。
- `tool-schemas.json`：升级为 `2026-06-21-design-v2`，同步工具 schema（结构模式）里 repo/snapshot 可省略的开发接入契约。
- `implementation/docs/chatgpt-connector-setup.md` 与 `README.md`：补充照填式接入步骤、Tunnel（隧道）设置、OAuth（开放授权）边界和真实仓库注意事项。
- `execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.md`、`execution-cards/index.md`、`execution-cards/task-import-map.json`：将本次补强正式纳入 EXEC-011 之后的任务链，当前活动执行卡为 13 张。

验证结果：
- `node -e "JSON.parse(require('fs').readFileSync('../tool-schemas.json','utf8')); console.log('tool-schemas json ok')"`：PASS。
- `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`：PASS。
- `node --import tsx --test tests/*.test.ts`：PASS，130 tests（测试）通过，24 suites（测试套件）通过。
- `node ./node_modules/typescript/bin/tsc -p tsconfig.json`：PASS。
- `node dist/startup.js --port 3100`：PASS，本地服务启动并生成 `http://127.0.0.1:3100/mcp`。
- 手动端点烟测：`/connector-meta` 返回 200；`/.well-known/oauth-protected-resource` 返回 200；`/.well-known/oauth-authorization-server` 返回 501；`POST /mcp initialize` 返回 200。
- 真实工具调用烟测：启动 `node dist/startup.js --port 3100` 后，依次执行 `initialize`、`notifications/initialized`、`tools/call repo.tree`，其中 `arguments` 只包含 `path='.'`、`depth=1`、`limit=10`；结果 `toolCallStatus=200`，响应 `structuredContent.repo_id=repo-620d9f23-882`，`structuredContent.snapshot_id=snap-1782062016790`，`entries=[]`，未返回 `isError=true`。
- `validate-execution-cards.ps1`：PASS，`cards=13`。
- 原始工具调用证据：`execution-cards/EXEC-012-chatgpt-default-context-connect-readiness.claude-review/runtime-repo-tree-call.json` 记录 `initialize`、`notifications/initialized` 和省略 repo/snapshot 的 `tools/call repo.tree` 请求/响应。
- Claude closeout（Claude 收口复核）：cycle 1 `recommendation=concerns`，任务卡状态、复核链路说明、`handshake.json` 处置均已修复；cycle 2 `recommendation=support`，两个低风险 traceability（可追踪性）建议已本地修复。`closure.json` 已通过 `validate_closure.py`，`status=passed`，`can_write_complete=true`。
- 停止验证：已停止 `node dist/startup.js --port 3100`，`http://127.0.0.1:3100/connector-meta` 不再监听。

结论：开发接入路径已达到可连接状态；仍不表示生产 OAuth 2.1/OIDC（开放授权二点一/开放身份连接）完成，也不表示真实私有仓库已授权接入。

## EXEC-011 补充验证（2026-06-21）

目标：修正 ChatGPT developer mode（聊天网页端开发者模式）开发连接前的本地服务端点边界、OAuth（开放授权）未接入响应和无会话传输生命周期。

变更摘要：
- 新增 `execution-cards/EXEC-011-chatgpt-dev-connector-hardening.md`，并更新 `execution-cards/index.md` 与 `execution-cards/task-import-map.json`，当前活动执行卡为 12 张。
- `server.ts`：只有 `/mcp` 进入 Streamable HTTP（可流式 HTTP）传输；发现端点和未知路径由 HTTP（网页协议）路由层直接响应；每个无会话 `/mcp` 请求使用独立 McpServer（模型上下文协议服务器）实例。
- `oauth-metadata.ts`：新增 protected resource metadata（受保护资源元数据）和 OAuth authorization server unavailable（开放授权服务器不可用）响应构造。
- `connector-auth-discovery.md` 与 `chatgpt-connector-setup.md`：明确 `127.0.0.1`（本机地址）只用于本机验证，ChatGPT 网页端最终连接必须使用 HTTPS（安全网页协议）或 Secure MCP Tunnel（安全 MCP 隧道）；生产 OAuth（开放授权）仍为 blocked（阻塞）。
- Claude（外部评审模型）cycle 1 指出 AC-004 缺少连续 `/mcp`（模型上下文协议端点）请求证据；已接受为阻塞并补充 `server-smoke.test.ts` 连续两次 `POST /mcp` 的回归测试。
- Claude（外部评审模型）cycle 2 结果为 `recommendation=support`，无新候选问题；`closure.json` 已通过 `validate_closure.py`，`can_write_complete=true`。

验证结果：
- `node --import tsx --test tests/*.test.ts`：PASS，128 tests（测试）通过，exit code（退出码）0。
- `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json`：PASS，exit code（退出码）0。
- `node ./node_modules/typescript/bin/tsc -p tsconfig.json`：PASS，exit code（退出码）0。
- `powershell -NoProfile -ExecutionPolicy Bypass -File ".../execution-cards/validate-execution-cards.ps1" -CardsDir ".../execution-cards"`：PASS，`cards=12`，exit code（退出码）0。
- 端点级请求：`/connector-meta` 返回 200；`/.well-known/oauth-protected-resource` 返回 200；`/.well-known/oauth-authorization-server` 返回 501；`/.well-known/openid-configuration` 返回 501；未知路径返回 404。

跳过项：
- `npm test`、`npm run typecheck`、`npm run build` 在 UNC（网络共享路径）下会被 `cmd.exe`（命令外壳）退回到 Windows（视窗系统）目录，不能作为有效验证证据；已改用等效直接 `node`（节点运行时）命令。
- live ChatGPT developer mode（聊天网页端开发者模式）网页点击验证未执行，原因：需要用户账号/工作区/隧道能力。
- 生产 OAuth 2.1/OIDC IdP（开放授权二点一/开放身份连接身份提供方）未接入，仍为范围外阻塞项。

## 审计发现的断链与修复

### 5 条断链 — 全部修复

| 断链 | 描述 | 修复 |
|---|---|---|
| BROKEN CHAIN-001 | `authorizeToolCall()` 未接入工具执行 | `registry.ts`: handleToolCall 调用 authorizeToolCall 校验 token + grant_id |
| BROKEN CHAIN-002 | 真实工具实现未接入 server | `registry.ts`: handleToolCall dispatch 到 read-only-tools.ts 四个函数 |
| BROKEN CHAIN-003 | `evidence.ts` 未接入执行路径 | `registry.ts`: 每次工具调用后记录 evidenceFromToolCall |
| BROKEN CHAIN-004 | OAuth 发现/挑战未接入 HTTP | `server.ts`: 未授权时返回 www-authenticate 挑战; 添加 well-known 端点 |
| BROKEN CHAIN-005 | `checkGrantBudget()` 未调用 | `read-only-tools.ts`: 所有工具添加 checkGrantBudget 调用 |

### 5 个缺口 — 全部修复

| 缺口 | 描述 | 修复 |
|---|---|---|
| GAP-005 | server 返回 not_implemented | `registry.ts`: 替换 scaffold 为真实工具 dispatch |
| GAP-007 | 路径守卫缺 URL-decode | `path-guard.ts`: decodeURIComponent 检测编码变体 (如 %2e%2e) |
| GAP-010 | indexer 修改 manifest | `indexer.ts`: 创建浅拷贝 indexableManifest，不修改原始对象 |
| GAP-008 | 日志隐私纸面声明 | `evidence.ts`: 结构化证据记录不含敏感正文（仅哈希） |
| GAP-009 | 跨工具快照一致性 | `registry.ts`: RuntimeState.sessionSnapshotId 强制绑定 |

### 测试覆盖补全

新增测试：
- URL-encoded path traversal 拒绝 (%2e%2e)
- 跨工具 snapshot_id 一致性
- Session budget 累计执行
- Grant budget 累计执行

## 最终验证

### TypeScript
```
tsc --noEmit: PASS (0 errors)
```

### 测试
```
24 suites, 128 tests, 128 pass, 0 fail
exit code: 0
```

### 测试覆盖矩阵 (T-001 ~ T-032)

| ID | 覆盖 | ID | 覆盖 | ID | 覆盖 | ID | 覆盖 |
|---|---|---|---|---|---|---|---|
| T-001 | ✓ | T-009 | E2E | T-017 | ✓ | T-025 | ✓ |
| T-002 | ✓ | T-010 | E2E | T-018 | ✓ | T-026 | ✓ |
| T-003 | ✓ | T-011 | E2E | T-019 | ✓ | T-027 | partial |
| T-004 | ✓ | T-012 | ✓ | T-020 | E2E | T-028 | ✓ |
| T-005 | ✓ | T-013 | partial | T-021 | E2E | T-029 | ✓ |
| T-006 | ✓ | T-014 | partial | T-022 | E2E | T-030 | ✓ |
| T-007 | ✓ | T-015 | ✓ | T-023 | ✓ | T-031 | ✓ |
| T-008 | ✓ | T-016 | ✓ | T-024 | ✓ | T-032 | partial |

E2E (6 cases): 需运行时 MCP Inspector/ChatGPT Developer Mode 验证
Partial (4 cases): 符号链接/重解析点/日志脱敏 需 OS 级测试环境

## 剩余边界
- MCP Inspector / ChatGPT Developer Mode 运行时验证待执行
- 真实私有仓库读取未授权
- 生产 OAuth 2.1 IdP 未接入
- 持久化存储仍是内存实现
- Windows 符号链接/重解析点/大小写别名 需 OS 级测试
