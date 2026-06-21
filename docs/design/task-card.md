# CHATGPT-LOCAL-REPO-001：ChatGPT 网页端本地仓库只读代码上下文应用任务卡

状态：design_ready（设计就绪）；未授权实现。
目标日期：2026-06-21。
产物目录：`<repo-root>`（仓库根目录）。

## 1. Objective Capsule（目标胶囊）

Goal（目标）：
- 构建一套开发规格，让 `ChatGPT`（聊天网页端）通过 `MCP`（模型上下文协议）安全读取用户显式授权的本地仓库只读快照，用于代码搜索、片段读取、仓库树查看和符号定位。

Global intent（全局意图）：
- 把“读取本地仓库代码”设计为受控的只读上下文能力，而不是任意文件系统代理。
- 用服务端策略、只读快照、敏感数据过滤和审计日志保护本地代码资产。
- 先完成可审查的设计任务，再进入实现任务。

Non-goals（非目标）：
- 不实现代码、不运行服务、不声称运行通过。
- 不写文件、不运行命令、不调用 `shell`（命令行外壳）、不执行 `git`（版本控制）操作。
- 不读取任意本机路径、不读取未注册仓库、不读取实时工作目录。
- 不把公网临时隧道作为私有仓库生产方案。
- 不做跨用户缓存、不做团队版共享索引。
- 不做编辑、重构、自动修复、文件上传、文件下载或代码执行。

## 2. Authority（权威依据）

官方依据见 `docs/design/official-evidence.md`（官方证据表）。核心结论：

- `Apps SDK`（应用开发套件）应用需要一个必需的 `MCP server`（模型上下文协议服务器）来定义工具并暴露给 `ChatGPT`（聊天网页端）；`UI`（界面）组件可选。
- `MCP server`（模型上下文协议服务器）负责定义工具、执行鉴权、返回数据，并可指向界面资源。
- 工具是 `MCP server`（模型上下文协议服务器）与模型之间的契约，必须定义输入、输出、元数据和安全提示。
- `Secure MCP Tunnel`（安全 MCP 隧道）允许私有 `MCP server`（模型上下文协议服务器）通过出站 `HTTPS`（安全超文本传输协议）接入，私有服务器地址保持在客户环境内。
- `Developer mode`（开发者模式）和连接器权限不能替代服务端授权；读取信息可能自动发生，因此服务端必须逐次校验。
- `MCP roots`（模型上下文协议根目录）是提示性信息，不是访问控制；新设计不能把它作为安全边界。

## 3. Business Scenario（业务场景）

Actor（参与者）：
- 本地开发者，希望在 `ChatGPT`（聊天网页端）对话中询问本地仓库代码结构、定义位置、入口链路和实现差异。

Given（前置条件）：
- 用户在本地注册一个仓库快照。
- 本地 `MCP server`（模型上下文协议服务器）通过 `Secure MCP Tunnel`（安全 MCP 隧道）连接到 `ChatGPT`（聊天网页端）。
- 服务端策略只允许读取该快照内通过安全过滤的文本代码片段。

When（触发）：
- 用户在 `ChatGPT`（聊天网页端）中提问，例如“这个函数在哪里定义？”、“这个功能入口在哪？”、“这两个实现有什么差异？”。

Then（结果）：
- `ChatGPT`（聊天网页端）调用只读工具，返回带 `repo_id`（仓库标识）、`snapshot_id`（快照标识）、相对路径、行号范围、截断状态和策略版本的结构化结果。
- 越权、敏感内容、过量请求、提示注入和写请求被拒绝，并记录结构化审计元数据。

## 4. Scope（范围）

In scope（范围内）：
- 单用户、单本地工作区、单仓库、单只读快照。
- 本地私有 `MCP gateway`（协议网关）。
- 默认 `Secure MCP Tunnel`（安全 MCP 隧道）。
- 四个只读工具：`repo.search`（仓库搜索）、`repo.fetch`（片段读取）、`repo.tree`（仓库树）、`repo.symbols`（符号定位）。
- 路径规范化、快照一致性、敏感数据过滤、返回限额、结构化审计。
- `MCP Inspector`（协议检查器）、`ChatGPT developer mode`（开发者模式）、`API Playground`（接口调试台）验证计划。

Out of scope（范围外）：
- 实现代码、启动服务、发布应用、提交审核。
- 团队版、中心化索引、多用户、多仓库共享缓存。
- 实时工作目录混读。
- 任意本地文件访问、命令执行、网络代理、文件上传/下载。
- `resources/subscribe`（资源订阅）、动态工具热更新、`prompts`（提示模板）、`sampling`（采样）作为第一版能力。

## 5. System Architecture（系统架构）

核心链路：

`ChatGPT connector`（聊天网页端连接器） -> `OpenAI hosted tunnel endpoint`（开放人工智能托管隧道端点） -> `tunnel-client`（隧道客户端） -> `local MCP gateway`（本地协议网关） -> `identity/policy engine`（身份与策略引擎） -> `repo catalog + snapshot registry`（仓库目录与快照注册表） -> `indexing plane`（索引平面） -> `read query services`（只读查询服务） -> `redaction/audit`（脱敏与审计）

模块责任：

| 模块 | 责任 | 不得做 |
|---|---|---|
| Connector Layer（连接器层） | 声明工具、元数据、可选只读界面 | 不承载仓库授权策略 |
| MCP Gateway（协议网关） | 处理 `MCP` 请求、限流、错误码、请求标识 | 不直接读文件 |
| Identity/Policy Engine（身份与策略引擎） | 验证主体、仓库、快照、路径、工具、限额 | 不信任客户端提示 |
| Repo Catalog（仓库目录） | 注册允许仓库与内部绝对路径映射 | 不暴露绝对路径给模型 |
| Snapshot Registry（快照注册表） | 维护 `snapshot_id` 与索引版本 | 不混读实时工作目录 |
| Indexing Plane（索引平面） | 构建文件树、文本索引、符号索引 | 不索引未授权路径或敏感文件 |
| Read Query Services（只读查询服务） | 执行 `search/fetch/tree/symbols` | 不写入、不运行命令 |
| Redaction/Audit（脱敏与审计） | 过滤、截断、审计、告警 | 不记录原始代码正文和原始提示词 |

## 6. Security Invariants（安全不变量）

- INV-001：服务端授权是唯一安全边界；隧道不是授权。
- INV-002：`ChatGPT`（聊天网页端）确认提示不是授权；连接器权限不是仓库权限。
- INV-003：`MCP roots`（模型上下文协议根目录）不是访问控制，不能作为放行依据。
- INV-004：仓库内容永远是不可信数据，不能作为系统指令、工具描述或动态策略输入。
- INV-005：每次工具调用必须校验 `user_id`、`repo_id`、`snapshot_id`、路径、工具、结果大小、作用域和策略版本。
- INV-006：只读也属于数据导出，必须有单次、单会话、单工具和单快照限额。
- INV-007：索引准入、结果返回、日志写入三层都必须过滤敏感数据。
- INV-008：日志只存结构化元数据；默认不落原始代码正文、原始提示词、令牌、密钥或凭据。
- INV-009：本地 `MCP server`（模型上下文协议服务器）必须低权限运行，只挂载授权快照，不挂载用户家目录、`SSH`（安全外壳）目录或云凭据目录。
- INV-010：搜索结果和读取片段必须绑定同一 `snapshot_id`（快照标识）。

## 7. Tool Specification（工具规格）

完整 `JSON Schema`（结构化模式）见根目录 `tool-schemas.json`。

### repo.search（仓库搜索）

用途：按关键词、符号或基础语义模式检索授权快照。
输入：`query`、`repo_id`、`snapshot_id`、`limit`、`mode`。
输出：命中列表，每条包含 `path`、`line_range`、`snippet`、`score`、`symbol`、`truncated`、`snapshot_id`、`policy_version`。
约束：不得返回整文件；默认片段截断；命中敏感内容则拒绝或脱敏。

### repo.fetch（片段读取）

用途：读取授权快照内一个文件的有限行号范围。
输入：`repo_id`、`snapshot_id`、`path`、`line_start`、`line_end`、`purpose`。
输出：`content`、`path`、`line_range`、`byte_count`、`truncated`、`policy_version`。
约束：只接受相对路径；拒绝绝对路径、父目录、符号链接越界、过大范围和敏感文件。

### repo.tree（仓库树）

用途：列出授权快照内受限深度的目录结构。
输入：`repo_id`、`snapshot_id`、`path`、`depth`、`limit`。
输出：`entries`，每条包含相对路径、类型、语言或扩展名、截断状态。
约束：限制深度、数量和敏感路径展示。

### repo.symbols（符号定位）

用途：定位函数、类、模块、接口等符号定义。
输入：`repo_id`、`snapshot_id`、`query`、`language`、`limit`。
输出：符号列表，每条包含名称、类型、相对路径、定义行、签名摘要、置信度。
约束：符号摘要同样受敏感检测和返回限额约束。

所有工具必须：
- `annotations.readOnlyHint=true`（只读）。
- `annotations.destructiveHint=false`（非破坏性）。
- `annotations.openWorldHint=false`（不访问用户账户外世界）。
- 提供 `inputSchema`（输入模式）和 `outputSchema`（输出模式）。
- 返回 `structuredContent`（结构化内容）。
- 对业务拒绝返回 `isError=true` 或结构化错误对象，并写审计。

## 8. Path and Snapshot Rules（路径与快照规则）

- PATH-001：只读取 `repo catalog`（仓库目录）注册的仓库快照。
- PATH-002：外部接口只接受仓库相对路径；绝对路径仅允许服务端内部使用。
- PATH-003：拒绝 `..`、绝对路径、混合分隔符逃逸、编码变体、大小写别名、符号链接、目录联接、重解析点越界。
- PATH-004：拒绝 `.git`（版本控制内部目录）、`.env`（环境变量文件）、密钥、令牌、云凭据、`SSH`（安全外壳）目录、系统配置、二进制大文件和超大文件。
- SNAP-001：快照进入 `snapshot_ready`（快照就绪）前不能被查询。
- SNAP-002：`repo.search`（仓库搜索）与 `repo.fetch`（片段读取）必须使用同一 `snapshot_id`（快照标识）。
- SNAP-003：快照刷新创建新 `snapshot_id`（快照标识），不得原地改变旧快照含义。

## 9. Authentication and Authorization（认证与授权）

- AUTH-001：开发期可在本机私有环境中验证，但真实使用必须有 `OAuth 2.1`（授权协议 2.1）或等效短期主体绑定。
- AUTH-002：`MCP server`（模型上下文协议服务器）必须验证签名、issuer（签发者）、audience（受众）、expiry（过期时间）、scope（作用域）和 replay（重放）。
- AUTH-003：不得做 token passthrough（令牌透传）；服务端只接受发给自己的令牌。
- AUTH-004：`mTLS`（双向传输层安全）可确认客户端/隧道来源，但不能替代用户授权。
- AUTH-005：支持撤销、每仓库解绑、会话过期、策略版本更新。

## 10. State Flow（状态流）

正常状态：

`unregistered`（未注册） -> `registered`（已注册） -> `snapshot_indexing`（快照索引中） -> `snapshot_ready`（快照就绪） -> `query_allowed`（查询放行） -> `audit_recorded`（审计已记录）

拒绝或失败状态：

- `tunnel_unavailable`（隧道不可用）
- `auth_failed`（认证失败）
- `scope_denied`（作用域拒绝）
- `snapshot_not_ready`（快照未就绪）
- `access_denied`（访问拒绝）
- `secret_detected`（检测到敏感数据）
- `result_too_large`（结果过大）
- `rate_limited`（限流）
- `unsupported_file_type`（不支持文件类型）
- `internal_error`（内部错误）

每个失败状态都必须返回机器可读错误码、用户可理解摘要、审计关联编号。

## 11. Test Matrix（测试矩阵）

完整矩阵见 `docs/design/test-matrix.md`。

必须覆盖：
- 四个工具各一个正例和一个负例。
- 黄金问题集：定义位置、入口查找、实现差异。
- 越权路径：父目录、绝对路径、同级仓库、符号链接/目录联接/重解析点、编码变体、大小写别名。
- 敏感数据：`.env`（环境变量文件）、私钥、令牌、云凭据、`.git`（版本控制内部目录）、高熵疑似密钥。
- 提示注入：仓库正文诱导读取未授权路径、扩大权限、泄露密钥、忽略策略。
- 资源滥用：整仓枚举、过大结果、过深目录树、过多行读取、高频请求。
- 连接验证：`MCP Inspector`（协议检查器）、`ChatGPT developer mode`（开发者模式）、`API Playground`（接口调试台）至少两条独立证据链。

## 12. Evidence Requirements（证据要求）

证据模板见 `docs/design/evidence-template.md`。

每条证据必须包含：
- 时间戳。
- 验证入口：`MCP Inspector`（协议检查器）、`ChatGPT developer mode`（开发者模式）或 `API Playground`（接口调试台）。
- 请求摘要和响应摘要。
- `repo_id`（仓库标识）、`snapshot_id`（快照标识）、`policy_version`（策略版本）。
- 工具名、输入、输出、是否截断。
- 拒绝原因或放行原因。
- 审计关联编号。
- 是否含敏感数据原文：必须为否。
- 命令或手工步骤、结果和退出码；无命令时记录 `N/A`（不适用）和原因。

## 13. Design Done Criteria（设计完成条件）

设计任务只能在以下条件全部满足时关闭：
- `docs/design/task-card.md`（任务卡）已持久化。
- `docs/design/official-evidence.md`（官方证据表）已列出官方文档依据与链接。
- `docs/design/threat-model.md`（威胁模型）已覆盖认证、授权、路径越权、提示注入、敏感数据、日志、隧道、本地进程隔离。
- `tool-schemas.json`（工具模式）是合法 `JSON`（JavaScript 对象表示法）。
- `docs/design/test-matrix.md`（测试矩阵）覆盖正常路径、失败路径、安全负例和证据要求。
- `docs/design/evidence-template.md`（证据模板）可用于未来实现验收。
- 子代理和 `Claude`（外部评审模型）复核结果已记录在 `docs/reports/validation-report.md`（校验报告）。
- 所有实现期结论必须保留为 `待确认`，不得声称已运行或已通过。

## 14. Implementation Gate（实现准入门槛）

进入实现前必须另开实现任务，并补齐：
- 目标运行语言和 SDK 选择。
- 本地沙箱方案。
- 授权令牌方案。
- 真实快照创建方式。
- 敏感检测规则实现。
- 最小原型验收命令。
- 目标浏览器、目标 `ChatGPT`（聊天网页端）账号/组织能力确认。

## 15. Required Deliverables（必交产物）

- `docs/design/task-card.md`
- `docs/design/official-evidence.md`
- `docs/design/threat-model.md`
- `tool-schemas.json`
- `docs/design/test-matrix.md`
- `docs/design/evidence-template.md`
- `docs/reports/validation-report.md`
- `README.md`

## 16. Completion Writeback Format（完成回写格式）

changed files（变更文件）：
- 列出共享目录内新增或更新的文件。

created artifacts（创建产物）：
- 列出任务卡和配套产物路径。

validation commands（校验命令）：
- 列出文件存在性、`JSON`（JavaScript 对象表示法）解析、子代理复核、`Claude`（外部评审模型）复核。

validation results, including exit code（校验结果和退出码）：
- 记录每条命令结果。

skipped validations and reason（跳过校验及原因）：
- 未实现运行时，所以跳过 `MCP`（模型上下文协议）运行验证。

protected scope unchanged（保护范围未变）：
- 未读取本地仓库、未写当前仓库、未运行实现服务。

remaining blockers（剩余阻塞）：
- 目标 `ChatGPT`（聊天网页端）工作区是否可用 `Secure MCP Tunnel`（安全 MCP 隧道）需在实现期确认。

completion status（完成状态）：
- `design_ready`（设计就绪） / `needs_changes`（需要修改） / `blocked`（阻塞）。

## 17. Reviewer-Driven Revisions（复核驱动修订）

本节根据安全、架构、验收子代理复核补充。未补齐本节前，本任务不得进入实现授权。

### 17.1 Authorization Grant Record（授权授予记录）

每个可读仓库快照必须有服务端持久化授权授予记录，不得只依赖会话或连接状态。

授权记录至少包含：
- `grant_id`（授权编号）。
- `user_id`（用户标识）。
- `client_id`（客户端/连接器标识）。
- `repo_id`（仓库标识）。
- `snapshot_id`（快照标识）。
- allowed_tools（允许工具）：只能为 `repo.search`、`repo.fetch`、`repo.tree`、`repo.symbols` 的子集。
- allowed_paths（允许路径集合）：第一版为快照内全部非敏感文本路径或更小集合。
- data_budget（数据预算）：单次字节、单会话字节、单授权累计字节、调用次数、树深、结果条数。
- expiry（过期时间）。
- revoked_at（撤销时间）。
- policy_version（策略版本）。

授权校验规则：任何工具调用必须同时绑定 `grant_id/user_id/client_id/repo_id/snapshot_id/tool/scope/budget/policy_version`。任一字段不匹配，返回 `access_denied`。

### 17.2 Snapshot Manifest（快照清单）

快照不是实时目录指针；快照必须有不可变清单。

清单至少包含：
- `snapshot_id`（快照标识）。
- `repo_id`（仓库标识）。
- created_at（创建时间）。
- source_root_hash（源根摘要，不能暴露绝对路径）。
- manifest_hash（清单摘要）。
- files：相对路径、文件哈希、字节数、语言/扩展名、行数、敏感检测状态、索引准入状态。
- excluded_files：排除原因，不含敏感正文。
- index_version（索引版本）。
- policy_version（策略版本）。
- expires_at（过期时间）。

快照生命周期拆分：
- Repo binding（仓库绑定）：`unbound -> binding_requested -> bound -> revoked`。
- Snapshot lifecycle（快照生命周期）：`snapshot_requested -> manifest_building -> filtering -> indexing -> ready -> expired/revoked`。
- Request lifecycle（请求生命周期）：`received -> authenticated -> authorized -> budget_checked -> executed -> response_filtered -> audit_recorded`。

旧快照过期或撤销后，所有工具必须拒绝旧 `snapshot_id`，并触发索引/缓存清除流程。

### 17.3 Parser and Indexer Isolation（解析器与索引器隔离）

索引器和符号提取器处理的是不可信仓库内容，必须：
- 低权限运行。
- 无网络或仅允许必要本地 IPC（进程间通信）。
- 只读访问快照，不访问实时工作目录。
- 禁止执行仓库代码、构建脚本、宏、插件、语言服务器扩展、包安装、测试命令。
- 超时、内存、文件大小和文件数量限制。
- 解析失败必须降级为 `unsupported_file_type` 或 `index_failed`，不得绕过安全策略。

### 17.4 Data Exfiltration Budget（数据外泄预算）

只读不是无限导出。第一版必须定义并测试以下预算：
- single_response_max_bytes（单响应最大字节）。
- single_file_line_window_max（单文件最大行窗口）。
- session_total_bytes（单会话累计字节）。
- grant_total_bytes（单授权累计字节）。
- tool_call_count（工具调用次数）。
- tree_max_depth（目录树最大深度）。
- search_hit_max（搜索命中最大数）。
- symbol_hit_max（符号命中最大数）。
- throttle_window（限流窗口）。

预算耗尽返回 `rate_limited` 或 `budget_exceeded`，不得通过多次小请求继续导出。

### 17.5 Prompt-Injection Isolation Contract（提示注入隔离契约）

所有代码片段、注释、README、测试数据、文件名和符号名都必须作为不可信数据包装：
- 返回结构必须显式标记 `content_origin=repository_snapshot`。
- 返回结构必须包含 `instruction_trust=untrusted`。
- 不得把仓库正文拼入系统提示、工具描述、授权策略或动态服务端配置。
- 对模型展示时必须保留来源标识，不允许把代码正文解释为操作指令。
- 提示注入测试必须验证：仓库正文要求扩大读取范围、读取密钥、忽略策略时，服务端仍拒绝。

### 17.6 Error Response Contract（错误响应契约）

所有工具的错误返回必须结构化，至少包含：

```json
{
  "isError": true,
  "error_code": "access_denied",
  "message": "Request denied by repository access policy.",
  "repo_id": "repo_x",
  "snapshot_id": "snap_x",
  "policy_version": "policy_x",
  "audit_id": "audit_x",
  "retryable": false
}
```

错误码集合：`auth_failed`、`scope_denied`、`snapshot_not_ready`、`access_denied`、`secret_detected`、`result_too_large`、`budget_exceeded`、`rate_limited`、`unsupported_file_type`、`index_failed`、`tunnel_unavailable`、`internal_error`。

### 17.7 Evidence Integrity（证据完整性）

未来证据包必须可回放、可校验、可比对：
- 记录请求摘要哈希，不保存敏感全文。
- 记录响应摘要哈希，不保存敏感全文。
- 记录工具 schema 版本、策略版本、快照清单哈希。
- 记录证据文件路径、保留期、创建者、修改时间。
- 对人工截图或导出记录，必须同时有文字摘要和校验编号。

### 17.8 Design TBD（设计待确认）

以下结论必须保留为 `待确认`，不得在设计任务中写成已通过：
- 目标操作系统和文件系统范围，尤其 Windows 重解析点、大小写别名、UNC 路径、符号链接处理。
- `OAuth 2.1`（授权协议 2.1）或等效短期主体绑定的具体方案。
- 目标 `ChatGPT`（聊天网页端）工作区是否支持 `Secure MCP Tunnel`（安全 MCP 隧道）、工具注解和 `structuredContent`（结构化内容）。
- 快照是否强不可变、旧快照保留期、撤销后索引清理时限。
- `repo.tree`（仓库树）和 `repo.symbols`（符号定位）是否与 `repo.search/fetch` 使用同一 `snapshot_id`；本设计要求必须同一快照，实际实现需验证。

## 18. Protocol and Dependency Revisions（协议与依赖复核修订）

根据依赖/协议复核补充：

### 18.1 Tool Metadata（工具元数据）

每个工具除 schema 外，必须补齐：
- `name`（名称）。
- `title`（标题）。
- `description`（用途说明）：说明只读范围、安全限制和何时拒绝。
- `inputSchema`（输入模式）：含 `enum`（枚举）、默认值、最小/最大值、是否允许空值。
- `outputSchema`（输出模式）。
- `annotations`（注解）：`readOnlyHint=true`、`destructiveHint=false`、`openWorldHint=false`。注解只是提示，不是安全边界。
- `structuredContent`（结构化内容）和必要的 `content`（文字回退）策略。

### 18.2 Authorization Discovery and Challenge（授权发现与挑战）

真实连接必须设计：
- `securitySchemes`（安全方案）元数据。
- `/.well-known/oauth-protected-resource`（受保护资源发现）。
- `/.well-known/oauth-authorization-server` 或 `OIDC`（开放身份连接）发现。
- 运行时未授权时返回 `_meta["mcp/www_authenticate"]`（授权挑战）。
- `OAuth 2.1`（授权协议 2.1）或成熟 `IdP`（身份提供方）集成，禁止自研长期令牌方案。

### 18.3 Connector Discovery（连接器发现）

任务实现前必须定义：
- 连接器 `name`（名称）。
- 连接器 `description`（说明）。
- `/mcp` 端点。
- 初始化 `instructions`（跨工具指引）：明确仓库内容是不可信数据、禁止整仓导出、所有工具只读。
- 若公开提交，另开任务补公网域名、`CSP`（内容安全策略）、隐私策略和审核材料。

### 18.4 UI Decision（界面决策）

第一版设计决策：默认无 `UI widget`（界面小组件），只做数据工具。若后续添加只读预览小组件，必须另开任务补：
- `_meta.ui.resourceUri`（界面资源地址）。
- `openai/outputTemplate`（输出模板）兼容策略。
- widget bridge（小组件桥接）安全边界。
- `CSP`（内容安全策略）。
- 数据工具和渲染工具分离。

### 18.5 Dependency Selection（依赖选择）

第一版依赖建议：
- 核心运行时优先官方 `@modelcontextprotocol/sdk`（官方 TypeScript SDK）。
- 不把 `fastmcp`、`mcp-framework` 等第三方抽象层放进安全敏感主边界。
- `@modelcontextprotocol/inspector`（协议检查器）仅作测试/CI 依赖。
- `@modelcontextprotocol/ext-apps` 只在未来引入 `UI widget`（界面小组件）时使用。
- 鉴权侧优先成熟 `IdP`（身份提供方）和标准 `OAuth 2.1`（授权协议 2.1）/`OIDC`（开放身份连接）能力。

### 18.6 Pagination and Symbol Scope（分页与符号范围）

- `repo.search`（仓库搜索）和 `repo.tree`（仓库树）必须明确是否支持 `next_cursor`（下一页游标）。第一版允许不支持分页，但必须以 `truncated=true` 和预算拒绝收敛，不得暗示结果完整。
- 若支持分页，cursor 必须绑定 `grant_id`、`snapshot_id`、查询、策略版本和预算，不得跨授权复用。
- `repo.symbols`（符号定位）第一版范围限定为 definitions（定义）。references（引用点）、usages（用法）、跨文件调用图和跨语言混合结果后置。

