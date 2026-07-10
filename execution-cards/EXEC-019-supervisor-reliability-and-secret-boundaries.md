---
task_contract_version: 2
id: EXEC-019
status: implementation_complete_publish_pending
external_review_policy: optional
---

# EXEC-019：本地守护可靠性、凭据边界与跨 UNC 运维入口

状态：implementation_complete_publish_pending（本地实现与验证完成，等待远端发布凭据）。
依赖：EXEC-018 complete（完成）；用户已授权修复已复核的问题并发布到远端。

## 1. Objective

修复本地 `agent`（守护命令）在 Windows（视窗系统）网络共享路径、连续故障与凭据传入时的运行缺口：文档必须给出不依赖 npm（Node 包管理器）当前目录的入口；启动文件夹回退必须在守护异常退出后重启；受管子进程的退避必须跨重启尝试累积并在稳定健康后清零；用户配置不得保存或回显内联密钥/隧道令牌；`status`（状态）必须在守护仍存活时如实展示受管进程。

业务对象：登录后维持本地 MCP（模型上下文协议）与隧道链路的用户级守护。操作者：已授权的本机用户。工作流：绝对路径运行命令或登录自启 -> 守护读取无密钥配置 -> 探测、启动或观察 MCP/隧道 -> 异常时受控重试 -> 操作者通过状态与诊断确认所有权及健康。

## 2. Scope

Allowed files（允许修改）：
- `execution-cards/EXEC-019-supervisor-reliability-and-secret-boundaries.md`
- `execution-cards/index.md`
- `execution-cards/task-import-map.json`
- `docs/reports/validation-report.md`
- `README.md`
- `CONNECT_CHATGPT.md`
- `implementation/docs/agent-supervisor.md`
- `implementation/docs/exec-019-pre-generation-contract.md`
- `implementation/docs/exec-019-implementation-report.md`
- `implementation/docs/mcp-gateway-contract.md`
- `implementation/src/agent.ts`
- `implementation/src/agent/supervisor.ts`
- `implementation/src/agent/autostart.ts`
- `implementation/tests/agent-supervisor.test.ts`

Hard limits（硬边界）：
- 不新增 MCP 写入、shell（命令行外壳）、git（版本控制）或进程管理工具；`agent` 继续只作为本地 CLI（命令行工具）。
- 不放宽授权仓库、只读快照、敏感内容阻断或 MCP 工具预算边界。
- 守护仍只停止本次实例启动的子进程；健康外部进程与未知端口占用不得被终止。
- 不在仓库、用户配置、状态、日志或 CLI 输出中保存或回显 API Key（接口密钥）、隧道令牌或其值；仅允许保存环境变量名称和非机密文件路径。
- 不提交真实用户路径、隧道配置、密钥或日志。

## Required Deliverables

Primary deliverables（主产物）：
- `implementation/src/agent.ts`
- `implementation/src/agent/supervisor.ts`
- `implementation/src/agent/autostart.ts`
- `implementation/tests/agent-supervisor.test.ts`
- `implementation/docs/agent-supervisor.md`
- `README.md`
- `CONNECT_CHATGPT.md`

Closeout deliverables（收口产物）：
- `execution-cards/EXEC-019-supervisor-reliability-and-secret-boundaries.md`
- `implementation/docs/exec-019-pre-generation-contract.md`
- `implementation/docs/exec-019-implementation-report.md`
- 更新后的执行卡索引、发布状态报告与 MCP 网关契约。
- `execution-cards/EXEC-019-supervisor-reliability-and-secret-boundaries.claude-review/closure.json`（仅在实际发起可选 Claude（外部评审模型）复核时）。

Artifact existence validation（产物存在性校验）：
- 关闭前必须确认所有主产物存在；required artifact path missing（必交产物路径缺失）时不得写 `complete`（完成）。

模块边界：

| 模块 | 读取 | 写入/副作用 | 责任 |
|---|---|---|---|
| `agent.ts` | 显式 CLI 参数、用户配置 | 用户配置、受控错误输出 | 拒绝内联机密、保存无机密环境映射 |
| `supervisor.ts` | 用户配置、健康端点、状态 | 状态、日志、受管子进程 | 退避、稳定恢复、进程所有权状态 |
| `autostart.ts` | 已验证配置 | 用户启动项 | Windows 任务计划或具失败重启的启动文件夹回退；macOS 启动代理 |
| 文档 | 已验证运行契约 | 仓库文档 | 跨 UNC 命令、机密传入和故障语义 |

## 3. Required Work

1. 跨 UNC 运维入口与自启回退
   - 文档把守护操作命令改为以绝对 `dist/agent.js`（构建入口）运行，避免 Windows 网络共享路径中的 `npm run agent` 当前目录失效。
   - Windows 启动文件夹回退项在 `agent run` 非零退出后等待固定短延迟并重新启动；正常退出不重启。
   - Windows 任务计划与 macOS LaunchAgent（启动代理）既有用户级、最小权限边界保持不变。

2. 退避和状态真实性
   - 连续退出次数必须跨子进程重启保留，使用有上限的指数退避；仅在同一受管进程连续健康达到明确稳定阈值后清零。
   - 守护状态文件记录必要的守护所有权信息；独立 `agent status` 在守护仍存活时不得把受管进程误报为外部进程。
   - 端口由异常外部进程占用时继续只报告、不强杀。

3. 凭据边界
   - 拒绝在 MCP 或隧道命令参数中传入内联令牌、密钥、密码、Bearer（承载令牌）等值；拒绝值不得出现在错误、日志或配置中。
   - 支持仅由名称组成的隧道环境变量映射；启动时从现有进程环境取值并传给隧道子进程。缺失变量必须以无密钥诊断信息失败。
   - 既有仅含 profile（配置文件）路径的配置继续可读取和运行。

4. 文档与发布同步
   - 同步根说明、ChatGPT 接入说明、守护运维说明、MCP 网关契约、执行卡索引和验证报告。
   - 仅暂存 EXEC-018/EXEC-019 及本卡范围内可归属文件；保留并排除无法归属的用户既有改动。

## 4. Acceptance Criteria

- 在 Windows UNC（网络共享）路径中，以绝对 `node <implementation-root>/dist/agent.js status` 可调用；文档不再把 `npm run agent` 表述为该环境的可靠入口。
- Windows 启动文件夹脚本对非零 `agent run` 退出有重启循环，对零退出停止；任务计划仍保留原有失败重启配置。
- 连续两次受管子进程退出的退避比第一次更长，延迟不超过 60 秒；连续稳定健康后才恢复初始延迟。
- `agent status` 读取有效守护状态时正确返回 `healthy_managed` 或 `unhealthy_managed`；失效守护状态仍按外部/不可用状态报告。
- 令牌型 CLI 参数和配置被拒绝且不泄露值；环境变量映射只保存变量名，缺失变量由 `doctor`（诊断）与启动路径明确报告。
- 既有只读 MCP 工具注册表、外部健康进程只观察规则与 Windows/macOS 配置渲染不回归。
- 类型检查、全量测试、构建、执行卡校验、链路检查、敏感扫描、`git diff --check` 和当前平台启动项更新后状态检查通过。

## 5. Validation

必须执行：
- `powershell -NoProfile -ExecutionPolicy Bypass -File ".\execution-cards\validate-execution-cards.ps1" -CardsDir ".\execution-cards"`。
- 在 `implementation` 目录以直接 Node（节点运行时）命令运行 `node .\node_modules\typescript\bin\tsc --noEmit`、`node --import tsx --test tests/*.test.ts` 与 `node .\node_modules\typescript\bin\tsc`。
- 针对守护测试覆盖：启动文件夹异常重启脚本、连续退避、稳定健康重置、状态所有权、内联密钥拒绝、环境变量映射和缺失变量诊断。
- `node .\scripts\check-read-code-link.mjs --require-tunnel --tunnel-admin-url http://127.0.0.1:18080`。
- 以绝对入口运行 `agent doctor`、`agent status`、`agent install` 并检查当前平台启动项内容与健康端点。
- 对暂存候选运行敏感扫描、`git diff --check` 与 `git diff --cached --check`。

允许跳过：
- macOS（苹果系统）真实 `launchctl`（启动控制）安装；原因是当前宿主为 Windows（视窗系统），但渲染测试必须覆盖。
- ChatGPT 网页端人工点击；原因是本卡不改变 MCP 工具协议，链路自检足以证明本地合同。

## 6. Required Evidence

- UNC 绝对入口成功、`npm run agent` 不作为该入口的文档证据。
- 启动脚本与退避/所有权/机密边界测试输出。
- 当前平台 `agent install`、`doctor`、`status`、MCP 与隧道健康、link check（链路自检）输出。
- 类型检查、测试、构建、执行卡校验、敏感扫描、差异检查和发布前 Git（版本控制）状态输出。

## 7. Completion Writeback

changed files:
- 本卡 `Allowed files` 中实际变更的文件，完成时逐项填写。

created artifacts:
- `execution-cards/EXEC-019-supervisor-reliability-and-secret-boundaries.md`
- `implementation/docs/exec-019-pre-generation-contract.md`
- `implementation/docs/exec-019-implementation-report.md`
- `execution-cards/EXEC-019-supervisor-reliability-and-secret-boundaries.claude-review/closure.json`（仅在实际发起可选复核时）。

validation commands:
- 本卡第 5 节命令；实际执行的命令、退出码和证据摘要必须回写。
- `py -3 "<codex-home>/skills/claude-taskcard-review/scripts/validate_closure.py" --closure "execution-cards/EXEC-019-supervisor-reliability-and-secret-boundaries.claude-review/closure.json" --output "execution-cards/EXEC-019-supervisor-reliability-and-secret-boundaries.claude-review/validator_result.json"`（仅在实际发起可选复核时）。

validation results, including exit code:
- Task-card validation（任务卡结构校验）：exit code（退出码）0；`PASS execution card validation`；`cards=20`。
- TypeScript（类型脚本）类型检查：exit code（退出码）0；`node .\\node_modules\\typescript\\bin\\tsc --noEmit` 通过。
- Test suite（测试套件）：exit code（退出码）0；`node --import tsx --test tests/*.test.ts`：`tests=235`、`pass=234`、`fail=0`、`skipped=1`。覆盖 UNC（网络共享）无关的绝对入口、启动文件夹异常重启、连续退避、稳定健康重置、状态所有权、令牌拒绝和环境映射。
- Build（构建）：exit code（退出码）0；`node .\\node_modules\\typescript\\bin\\tsc` 通过。
- Link check（链路自检）：exit code（退出码）0；9 个 model-visible（模型可见）工具、6 个已配置仓库、`repo_files`、`repo_fetch` 与 tunnel admin（隧道管理端）健康检查通过。
- 本机守护：exit code（退出码）0；绝对 UNC（网络共享）入口的 `doctor`（诊断）、`status`（状态）和 `install`（安装）通过；当前 MCP（模型上下协议）与隧道为 `healthy_external`（健康外部）。任务计划仍被系统策略拒绝，已更新启动文件夹回退并验证它含非零退出重启循环。
- 内联机密拒绝：隔离用户目录中以测试 `--token`（令牌）参数运行 `configure`（配置）得到 exit code（退出码）1，错误不含测试值且未写入配置；外层验证命令 exit code（退出码）0。
- `git diff --check`：exit code（退出码）0；无 whitespace error（空白错误）。

skipped validations and reason:
- macOS（苹果系统）真实 `launchctl`（启动控制）安装：当前宿主为 Windows（视窗系统）；已有 LaunchAgent（启动代理）渲染自动测试。
- ChatGPT web manual click-through（网页端手动点击）：由远端网页客户端控制；本卡以 MCP SDK（模型上下协议开发包）链路自检证明本地合同。

protected files unchanged:
- MCP（模型上下文协议）工具注册表不新增写入、shell（命令行外壳）或进程管理能力；真实密钥、隧道令牌和用户路径不进入仓库。

remaining blockers:
- 远端发布前需要有效 GitHub（代码托管平台）登录状态；本地实现、文档和验证已完成。
- 通用仓库卫生校验器在 HEAD（当前提交）基线和候选中均把 `implementation/tests/foundation-guards.test.ts`（测试夹具）报为疑似机密；本卡候选路径敏感扫描通过，该基线误报不在本卡允许改动范围内。

completion status:
- implementation_complete_publish_pending（本地实现完成，等待远端发布）。

documentation impact:
- required（需要）：运行入口、启动回退、凭据边界与状态语义均是用户可见运维合同。

repository hygiene:
- baseline finding recorded（已记录基线发现）：最终任务卡校验、本卡候选敏感扫描和 `git diff --check` 已通过；通用卫生校验器在未修改的安全扫描测试夹具上失败，基线同样复现。用户本机 `server.config.json`（服务器配置）含本地授权路径，保留在工作区且不纳入发布暂存。

external review disposition:
- optional（可选）：本卡不以外部复核为完成阻塞；若执行复核，候选问题必须用本地证据分类。

## 8. Non-Completion Rule

不得写 `complete`（完成）：
- required artifact path missing（必交产物路径缺失）。
- UNC（网络共享）环境仍只提供会失效的 npm（Node 包管理器）守护入口。
- 启动文件夹回退在 `agent run` 异常退出后不重启，或正常停止后错误重启。
- 连续受管失败不累积退避、稳定健康前错误清零，或 `status`（状态）继续误报已知受管子进程。
- 内联 API Key（接口密钥）或隧道令牌可写入、回显或记录。
- 守护杀死健康外部进程，或 MCP（模型上下文协议）新增进程管理工具。
- 类型检查、测试、构建、任务卡校验、link check（链路自检）、敏感扫描或差异检查未执行且未诚实记录。

## Claude Closeout Review

- external_review_policy：optional（可选）。reviewer_workflow（评审流程）：若执行，Claude（外部评审模型）只做建议性复核；local_disposition_owner（本地处置负责人）：本任务执行者。
- evidence_path（证据路径）：`execution-cards/EXEC-019-supervisor-reliability-and-secret-boundaries.claude-review/closure.json`。
- blocking_rule（阻塞规则）：缺少可选复核回执本身不阻止完成；已接受且未解决的 `accepted_blocking`（已接受阻塞）问题会阻止完成。
- 每个 finding（候选问题）若存在，必须分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`；外部评审不取代本地验证。
