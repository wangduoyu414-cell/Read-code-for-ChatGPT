# CHATGPT-LOCAL-REPO-001 Execution Cards（执行任务卡索引）

状态：implementation_ready_with_exec014_latency_optimization（实现已完成基础链路，并新增 ChatGPT 调用耗时优化任务卡）。

本目录把 `docs/design/task-card.md` 的设计拆成可执行任务卡。执行前必须先确认执行根目录：

- 默认执行根目录：`<repo-root>/implementation`
- 技术栈默认：`Node.js`（节点运行时） + `TypeScript`（类型脚本） + 官方 `@modelcontextprotocol/sdk`（模型上下文协议官方开发包）。
- 第一版决策：无 `UI widget`（界面小组件），仅数据工具。
- 当前实现范围：单用户、多仓库白名单、只读快照；`EXEC-014` 进一步收紧 ChatGPT（聊天模型）的低成本读取路径，减少大 `repo.tree` 和重复大包返回。

## 执行顺序

| 顺序 | 任务卡 | 目标 | 依赖 |
|---|---|---|---|
| 0 | `EXEC-000-design-baseline-coverage-gate.md` | 读取父设计产物并建立覆盖映射 | 无 |
| 1 | `EXEC-001-official-capability-environment-gate.md` | 确认目标环境和官方能力 | EXEC-000 |
| 2 | `EXEC-002-project-scaffold-mcp-gateway.md` | 建立项目骨架和 MCP 网关 | EXEC-001 |
| 3 | `EXEC-003-foundation-guards-audit-budget.md` | 建立最小 audit_id、路径守卫、预算模型和错误契约 | EXEC-002 |
| 4 | `EXEC-004-auth-policy-grant-store.md` | 实现授权授予记录和策略引擎 | EXEC-003 |
| 5 | `EXEC-005-connector-auth-discovery.md` | 实现连接器最小鉴权发现/挑战契约 | EXEC-004 |
| 6 | `EXEC-006-repo-binding-snapshot-manifest.md` | 实现仓库绑定、快照创建入口和 manifest 清单 | EXEC-005 |
| 7 | `EXEC-007-indexer-fixture-spec.md` | 实现隔离索引器和 fixture 规格 | EXEC-006 |
| 8 | `EXEC-008-read-only-tools.md` | 实现四个只读工具 | EXEC-007 |
| 9 | `EXEC-009-audit-evidence-log-privacy.md` | 完成结构化审计、日志隐私和证据包 | EXEC-008 |
| 10 | `EXEC-010-e2e-validation-chatgpt-connector.md` | 完成 MCP Inspector、ChatGPT developer mode、API Playground 验收 | EXEC-009 |
| 11 | `EXEC-011-chatgpt-dev-connector-hardening.md` | 硬化 ChatGPT 开发连接端点、传输生命周期和配置说明 | EXEC-010 |
| 12 | `EXEC-012-chatgpt-default-context-connect-readiness.md` | 补齐 ChatGPT 开发接入默认 repo/snapshot 上下文和真实工具调用验证 | EXEC-011 |
| 13 | `EXEC-013-doc-taxonomy-and-preconnect-chain.md` | 归类仓库文档、补根目录接入说明并重新验证 ChatGPT 接入前链路 | EXEC-012 |
| 14 | `EXEC-014-chatgpt-call-latency-optimization.md` | 优化 ChatGPT 调用轮次、`repo.tree` 输出体积和 MCP 返回重复大包 | EXEC-013 |

## 全局硬边界

- 每张卡执行前必须读取 `EXEC-000` 的 coverage map。
- `tool-schemas.json` 是工具模式权威。
- `docs/design/threat-model.md` 是安全威胁权威。
- `docs/design/test-matrix.md` 是端到端验收权威。
- `docs/design/official-evidence.md` 是官方能力和协议依据。
- 不允许读取本机任意路径，只能读取已注册快照或测试 fixture。
- 不允许写用户仓库、运行 shell（命令行外壳）、执行 git（版本控制）、安装依赖到用户仓库。
- 不允许把 `readOnlyHint`（只读提示）当安全边界；服务端策略必须强制。
- 不允许把 `MCP roots`（模型上下文协议根目录）当访问控制。
- 不允许在日志或证据中保存原始代码正文、原始提示词、密钥或凭据。

## 非完成规则

任何任务卡不得在以下情况写 `complete（完成）`：

- 必交产物缺失。
- 没有验证命令或手工验证证据。
- 失败路径未覆盖。
- 触碰了禁止范围。
- 运行时结果声称通过但没有请求/响应/退出码/审计证据。


## 校验脚本运行方式

共享路径上的 PowerShell（命令外壳）脚本在部分 Windows（视窗操作系统）环境会因执行策略被拒绝。支持的门禁调用方式为：

```powershell
# from <repo-root>
powershell -NoProfile -ExecutionPolicy Bypass -File ".\execution-cards\validate-execution-cards.ps1" -CardsDir ".\execution-cards"
```

该命令只校验任务卡结构，不代表实现、运行时连接或安全测试已经通过。

## 最终关闭要求

- `EXEC-012` 已按当时 13 张卡刷新 Claude（外部评审模型）复核回执，旧的 8-card（八卡）或 12-card（十二卡）回执不得作为当前闭环证据。
- `EXEC-012` 已把子代理复核、Claude 复核、本地校验命令、跳过项和剩余阻塞写入 `execution-cards/execution-validation-report.md`。
- `EXEC-013` 关闭前必须证明当时 14 张卡结构校验通过、文档归类后活动引用未断裂，并重新记录本地 MCP（模型上下文协议）接入前链路证据。
- `EXEC-014` 关闭前必须证明当前 15 张卡结构校验通过，并用 MCP SDK（模型上下文协议开发包）证明单仓库省略 `repo_path`、多仓库拒绝省略 `repo_path`、`repo.tree` 目录摘要、`content` 短摘要与 `structuredContent` 完整结果分离均生效。
- 父级 `docs/reports/validation-report.md` 必须同步记录执行卡拆分状态，区分 `ready_for_ai_execution_gated`（任务可执行门禁就绪）与 runtime complete（运行时完成）。
