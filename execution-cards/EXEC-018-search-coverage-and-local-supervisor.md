---
task_contract_version: 2
id: EXEC-018
status: complete
external_review_policy: optional
---

# EXEC-018：检索覆盖、快照一致性与跨平台本地自启动保活

状态：complete（完成）。
依赖：EXEC-017 complete（完成）；用户已明确授权本卡实现。

## 1. Objective

让 ChatGPT（聊天模型）对已授权仓库的检索结果可解释、优先覆盖代码审查所需内容，并避免把旧搜索结果和已变更磁盘文件混在同一快照中。同时提供一个不暴露给 MCP（模型上下文协议）的本地守护 CLI（命令行工具），使 Windows（视窗系统）和 macOS（苹果系统）在用户登录后均能启动并观察 MCP 服务与安全隧道；它只重启自己启动的进程，绝不终止健康的外部进程。

业务对象：已授权的本地仓库快照及其本地连接进程。操作者：已授权的本机用户。工作流：启动守护 -> 检查 MCP 与隧道健康 -> 观察或按退避策略启动受管理子进程 -> ChatGPT 使用带覆盖说明的搜索 -> 按快照一致性读取文件。

## 2. Scope

Allowed files（允许修改）：
- `execution-cards/EXEC-018-search-coverage-and-local-supervisor.md`
- `execution-cards/index.md`
- `execution-cards/task-import-map.json`
- `docs/reports/validation-report.md`
- `README.md`
- `CONNECT_CHATGPT.md`
- `tool-schemas.json`
- `implementation/package.json`
- `implementation/src/config.ts`
- `implementation/src/errors.ts`
- `implementation/src/indexer/*.ts`
- `implementation/src/snapshot/*.ts`
- `implementation/src/tools/read-only-tools.ts`
- `implementation/src/tools/registry.ts`
- `implementation/src/agent.ts`
- `implementation/src/agent/*.ts`
- `implementation/tests/*.test.ts`
- `implementation/docs/agent-supervisor.md`
- `implementation/docs/exec-018-pre-generation-contract.md`
- `implementation/docs/exec-018-implementation-report.md`
- `implementation/docs/mcp-gateway-contract.md`

Hard limits（硬边界）：
- 不新增可从 ChatGPT 调用的写文件、shell（命令行外壳）、git（版本控制）、进程管理、整仓导出、文件监听或自动刷新工具。
- 不放宽授权仓库白名单、敏感路径/内容阻断、相对路径约束、预算或只读契约。
- `repo_fetch`（读取）只读取 manifest（清单）中的文件，且内容哈希、真实路径和普通文件状态必须仍与快照一致；不一致时拒绝并提示刷新。
- 守护只安装用户级登录自启动：Windows 使用任务计划程序，macOS 使用 LaunchAgent（启动代理）；不请求管理员权限、不注册系统级服务。
- 守护只终止自己的受管理子进程；端口上已有健康外部服务时只观察，端口上有异常外部服务时报告而不强杀。
- 不提交真实 API Key（接口密钥）、Tunnel ID（隧道标识）、本机绝对路径、UNC（网络共享）路径、用户级守护配置或日志。

## Required Deliverables

Primary deliverables（主产物）：
- `execution-cards/EXEC-018-search-coverage-and-local-supervisor.md`
- `implementation/src/indexer/index-policy.ts`
- `implementation/src/snapshot/snapshot-file.ts`
- `implementation/src/tools/read-only-tools.ts`
- `implementation/src/agent.ts`
- `implementation/src/agent/supervisor.ts`
- `implementation/src/agent/autostart.ts`
- `implementation/docs/agent-supervisor.md`

Closeout deliverables（收口产物）：
- `implementation/docs/exec-018-pre-generation-contract.md`
- `implementation/docs/exec-018-implementation-report.md`
- 测试、任务卡、文档和工具模式更新的本地验证输出（不写入真实用户配置、日志或凭据）。
- `execution-cards/EXEC-018-search-coverage-and-local-supervisor.claude-review/closure.json`（仅在实际发起可选 Claude（外部评审模型）复核时）。

Artifact existence validation（产物存在性校验）：
- 关闭前必须确认所有主产物存在；required artifact path missing（必交产物路径缺失）时不得写 `complete`（完成）。
- 用户目录的自启动配置只作为本机运行证据，不纳入仓库交付物，也不得含在提交内容中。

模块边界：

| 模块 | 读取 | 写入/副作用 | 责任 |
|---|---|---|---|
| 快照/索引模块 | manifest 与受控文件 | 进程内索引 | 索引准入、优先级、快照一致读取 |
| MCP 只读工具 | 内存索引与 manifest | 无本机写入 | 搜索模式、覆盖说明、只读响应 |
| 本地守护 CLI | 用户级配置与健康端点 | 用户目录配置、日志、子进程、用户启动项 | 启动/观察/恢复本机连接链路 |

## 3. Required Work

1. 索引准入与排序
   - 保留 `fetchable`（可读取）与 `index_admitted`（允许索引）的区别；`.pytest_tmp` 等临时运行输出默认可发现、可按路径读取，但默认不消耗全文/符号索引额度。
   - 让根元数据、`src`、`app`、`tools`、`tests`、`config(s)`、文档等在固定索引额度前排序；运行产物和历史报告后置。
   - `repo_files`（文件列表）必须继续展示未索引文件及其可解释原因。

2. 检索模式与覆盖契约
   - `repo_search`（仓库搜索）的 `text`、`symbol`、`hybrid` 三种模式必须分别执行文本、符号、组合检索，而非忽略 mode（模式）。
   - 文本命中按符号、文件名、核心目录、精确文本、文档与运行产物的稳定相关性规则排序。
   - 返回 `coverage`（覆盖说明），明确已索引、可读取未索引、限定前缀按需扫描和未扫描的数量；空结果不得暗示文件不存在。
   - 支持仅对显式相对前缀的、数量受限的按需扫描；不扫描 manifest 外内容。
   - `repo_symbols language`（符号语言过滤）接受语言名和扩展名别名，例如 `python` 与 `py`。

3. 快照一致读取
   - 为索引器、按需扫描和 `repo_fetch` 建立同一受控文件读取边界，拒绝符号链接/重解析点逃逸、非普通文件和内容哈希变更。
   - 变更后的文件返回可重试的 `snapshot_stale`（快照已过期）错误，提示 `repo_refresh`（刷新）；旧搜索命中不得与新磁盘内容混读。

4. 本地守护与自启动
   - 新增 `agent configure|run|status|doctor|install|uninstall` 命令；配置和日志仅写入用户目录 `~/.read-code-chatgpt/`。
   - 每 30 秒检查 MCP `/connector-meta` 和隧道 `/healthz`、`/readyz`；启动失败应用有上限退避并将状态写入用户目录。
   - Windows 生成并安装登录触发、失败重启的任务计划 XML（支持 UNC 工作目录包装）；macOS 生成并安装 `RunAtLoad` + `KeepAlive` 的 LaunchAgent plist（属性列表）。
   - 守护的 CLI 参数必须允许配置节点运行时、MCP 配置、隧道可执行文件和参数，禁止硬编码某台机器的路径或隧道凭据。

## 4. Acceptance Criteria

- 低索引额度下，临时 `.pytest_tmp` 文件不占额度，`src`、`tests`、`configs` 等核心文件优先进入索引；未索引的 manifest 文件仍能 `repo_files`（文件列表）发现并 `repo_fetch`（读取）。
- `repo_search mode=text|symbol|hybrid` 返回相应不同检索面，且响应有覆盖说明和稳定排序；显式前缀可扫描可读取未索引内容但不会越过 manifest。
- `repo_symbols language=python` 与 `language=py` 一致；其他受支持语言名和扩展名别名同样一致。
- 文件在快照后修改、替换为符号链接或解析到授权根外时，`repo_fetch` 拒绝且不返回新内容；未变更文件正常读取。
- 守护配置渲染测试覆盖 Windows 任务计划 XML 和 macOS LaunchAgent plist；守护只观察健康外部服务、异常外部端口不强杀、仅重启其自身子进程。
- 当前 Windows（视窗系统）机器完成用户级安装并证明守护状态、MCP `/connector-meta`、隧道 `/healthz`、`/readyz` 与 MCP link check（链路自检）通过。
- Task-card validation（任务卡结构校验）、TypeScript（类型脚本）类型检查、测试、构建、敏感扫描和 `git diff --check` 通过。

## 5. Validation

必须执行：
- `powershell -NoProfile -ExecutionPolicy Bypass -File ".\execution-cards\validate-execution-cards.ps1" -CardsDir ".\execution-cards"`
- `cmd /d /c 'pushd "<repo-root>/implementation" && npm run typecheck && npm test && npm run build && popd'`
- `cmd /d /c 'pushd "<repo-root>/implementation" && node scripts/check-read-code-link.mjs --require-tunnel --tunnel-admin-url http://127.0.0.1:18080 && popd'`
- 聚焦运行探针：实际调用三种 `repo_search`（仓库搜索）模式；修改临时 fixture（夹具）后验证 `repo_fetch`（读取）拒绝。
- 守护 probe（探针）：`agent doctor`、`agent status`、当前平台 `agent install` 后检查计划任务和健康端点。
- Sensitive scan（敏感扫描）与 `git diff --check`。

允许跳过：
- macOS（苹果系统）真实 `launchctl`（启动控制）安装；原因是当前执行环境为 Windows（视窗系统），但必须由纯渲染单元测试覆盖。
- ChatGPT 网页端人工点击；原因是本卡通过 MCP SDK（模型上下文协议开发包）与本地链路检查证明服务契约，网页端元数据刷新由用户界面控制。

## 6. Required Evidence

- 索引准入、排序、搜索模式、覆盖状态、语言别名和快照漂移测试输出。
- Windows（视窗系统）任务 XML 与 macOS（苹果系统）plist 渲染测试输出。
- 本机 `agent status`、MCP 和隧道健康检查、link check（链路自检）输出。
- TypeScript（类型脚本）类型检查、测试、构建、任务卡校验、敏感扫描与 `git diff --check` 的退出码。

## 7. Completion Writeback

changed files:
- 本卡 `Allowed files` 中实际变更的文件，完成时逐项填写。

created artifacts:
- `execution-cards/EXEC-018-search-coverage-and-local-supervisor.md`
- `implementation/src/agent.ts`
- `implementation/src/agent/supervisor.ts`
- `implementation/src/agent/autostart.ts`
- `implementation/src/indexer/index-policy.ts`
- `implementation/src/snapshot/snapshot-file.ts`
- `implementation/docs/agent-supervisor.md`
- `execution-cards/EXEC-018-search-coverage-and-local-supervisor.claude-review/closure.json`（仅在实际发起可选复核时）

validation commands:
- 本卡第 5 节命令；实际执行的命令与退出码必须回写。
- `py -3 "<codex-home>/skills/claude-taskcard-review/scripts/validate_closure.py" --closure "execution-cards/EXEC-018-search-coverage-and-local-supervisor.claude-review/closure.json" --output "execution-cards/EXEC-018-search-coverage-and-local-supervisor.claude-review/validator_result.json"`（仅在实际发起可选复核时）。

validation results, including exit code:
- Task-card validation（任务卡结构校验）：exit code（退出码）0；`PASS execution card validation`；`cards=19`。
- TypeScript（类型脚本）类型检查：exit code（退出码）0；`node ./node_modules/typescript/bin/tsc --noEmit` 通过。
- Test suite（测试套件）：exit code（退出码）0；`node --import tsx --test tests/*.test.ts`：`tests=231`、`pass=230`、`fail=0`、`skipped=1`。覆盖临时目录索引排除、核心目录索引优先、三种搜索模式、限定前缀补扫、语言别名、快照内容漂移/符号链接拒绝、Windows（视窗系统）/macOS（苹果系统）自启动配置渲染和守护配置校验。
- Build（构建）：exit code（退出码）0；`node ./node_modules/typescript/bin/tsc` 通过。
- Link check（链路自检）：exit code（退出码）0；9 个 model-visible（模型可见）工具、首次调用导览、6 个已配置仓库、`repo_files`、`repo_fetch` 和 tunnel admin（隧道管理端）健康检查通过。
- 聚焦运行探针：exit code（退出码）0；真实 `视频理解`（仓库）快照有 `manifest_files_total=43206`、`indexed_files_total=1286`、`fetchable_unindexed_files_total=41920`；`repo_search mode=text` 返回 text（文本）命中、`mode=symbol` 返回 symbol（符号）命中、`mode=hybrid` 返回组合检索结果；`.pytest_tmp` 前缀按需扫描 `scanned_files=65`。
- 本机守护：exit code（退出码）0；`agent configure`、`doctor`、`status`、前台 `run` 均通过；状态为 MCP 与 tunnel（隧道）`healthy_external`（健康外部），证明守护没有停止已有健康进程。当前账户被系统策略禁止创建任务计划，`install` 成功安装当前用户启动文件夹回退项；Windows（视窗系统）任务 XML 和 macOS（苹果系统）LaunchAgent（启动代理）plist 均由自动测试覆盖。
- Sensitive scan（敏感扫描）：exit code（退出码）0；EXEC-018（执行卡）、新增操作文档、契约和根接入文档未命中真实 `sk-proj` key（项目密钥）、tunnel token（隧道令牌）、当前用户路径或当前 UNC（网络共享）路径。
- `git diff --check`：exit code（退出码）0；无 whitespace error（空白错误）；仅有现存文本文件 CRLF（回车换行）规范化 warning（警告）。

skipped validations and reason:
- ChatGPT web manual click-through（网页端手动点击）：跳过。原因：连接器元数据刷新和工具选择由网页端控制；本卡使用 MCP SDK（模型上下文协议开发包）链路自检与真实 MCP 调用验证本地契约。
- macOS（苹果系统）真实 `launchctl`（启动控制）安装：跳过。原因：当前执行环境为 Windows（视窗系统）；LaunchAgent（启动代理）XML（可扩展标记语言）渲染与字段由自动测试覆盖。
- Windows（视窗系统）任务计划真实安装：系统策略拒绝当前账户创建任何任务计划，已用无害用户级探针确认；`install` 自动安装当前用户启动文件夹回退项，守护前台运行与健康观察已验证。

protected files unchanged:
- MCP（模型上下文协议）仍无进程管理或写入工具；真实密钥、隧道令牌和用户路径不进入仓库。

remaining blockers:
- none（无）。

completion status:
- complete（完成）。

documentation impact:
- required（需要）：新增本地守护操作说明，并同步根目录接入说明和运行时契约。

repository hygiene:
- complete（完成）：任务卡校验、发布候选敏感扫描和 `git diff --check` 已通过；用户已有未提交改动未被回退。

external review disposition:
- optional（可选）：本卡不以外部复核为完成阻塞；若执行复核，候选问题必须用本地证据分类。

## 8. Non-Completion Rule

不得写 `complete`（完成）：
- required artifact path missing（必交产物路径缺失）。
- 搜索仍忽略 `mode`（模式），或结果没有说明索引覆盖与未索引范围。
- `repo_fetch`（读取）能返回快照后已变更、符号链接逃逸或 manifest 外内容。
- 守护会终止健康外部进程，或把本地进程管理暴露为 MCP 工具。
- Windows（视窗系统）和 macOS（苹果系统）任一自启动配置没有渲染测试，或当前平台没有实际安装/状态证据。
- TypeScript（类型脚本）类型检查、测试、构建、任务卡校验、link check（链路自检）、敏感扫描或 `git diff --check` 未执行且未诚实记录。

## Claude Closeout Review

- external_review_policy：optional（可选）。reviewer_workflow（评审流程）：若执行，Claude（外部评审模型）只做建议性复核；local_disposition_owner（本地处置负责人）：本任务执行者。
- evidence_path（证据路径）：`execution-cards/EXEC-018-search-coverage-and-local-supervisor.claude-review/closure.json`。
- blocking_rule（阻塞规则）：缺少可选复核回执本身不阻止完成；已接受且未解决的 `accepted_blocking`（已接受阻塞）问题会阻止完成。
- 每个 finding（候选问题）若存在，必须分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`；外部评审不取代本地验证。
