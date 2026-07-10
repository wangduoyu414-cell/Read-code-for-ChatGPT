# 本地自启动与保活

`agent`（本地守护命令）只在本机管理 MCP（模型上下文协议）服务和安全隧道的连接健康。它不是 MCP 工具，ChatGPT（聊天模型）无法调用它，也无法借此启动进程、执行命令或写入仓库。

## 设计边界

- 仅用户登录后自启动：Windows（视窗系统）使用任务计划程序；macOS（苹果系统）使用 LaunchAgent（启动代理）。不需要管理员权限，也不安装系统级服务。
- 每 30 秒检查 MCP `GET /connector-meta`，以及隧道 `GET /healthz` 和 `GET /readyz`。
- 只有当前守护实例启动的子进程会被停止或重启。健康的外部进程只观察；异常但不属于守护的端口占用进程也只报告，不会强杀。
- 配置、状态和日志只写入用户目录 `~/.read-code-chatgpt/`，不写入本仓库，不记录密钥、隧道令牌值或代码正文。配置只可保存环境变量名称和非机密 profile（配置文件）路径。
- MCP 重启时，守护会停止并重新拉起它自身管理的隧道，避免旧隧道继续指向失效服务。

## 配置

先构建，再从 `implementation` 目录运行。守护入口使用 Node（节点运行时）绝对脚本路径，不依赖 npm（Node 包管理器）启动脚本的当前目录；这在 Windows UNC（网络共享）路径中同样有效。以下 PowerShell（命令行外壳）示例中的变量只保存路径和环境变量名称：

```powershell
$implementationRoot = (Resolve-Path .).Path
$agentEntry = Join-Path $implementationRoot "dist\agent.js"
node (Join-Path $implementationRoot "node_modules\typescript\bin\tsc")
node $agentEntry configure --working-directory $implementationRoot --tunnel-command "<tunnel-client-path>" --tunnel-args-json '["run","--profile-file","<profile-file>"]' --tunnel-env-json '{"TUNNEL_TOKEN":"READ_CODE_TUNNEL_TOKEN"}'
node $agentEntry doctor
```

在 macOS（苹果系统）终端中，使用同一绝对入口形式：`node "<implementation-root>/dist/agent.js" status`。配置文件位于 `~/.read-code-chatgpt/agent.json`。常用命令：

```text
node <absolute-agent-entry> status
node <absolute-agent-entry> run
node <absolute-agent-entry> install
node <absolute-agent-entry> uninstall
```

`run`（运行）是前台守护循环；`install`（安装）创建当前用户的登录启动项。任务计划由操作系统在失败时重启；启动文件夹回退项会在 `agent run`（守护运行）非零退出后等待 5 秒再启动，零退出表示操作者已正常停止，因此不会拉起新的循环。

### 凭据传入

不要传入 `--token`（令牌）、`--api-key`（接口密钥）、`--password`（密码）、Bearer（承载令牌）或同类内联值。`agent configure`（配置）会拒绝这些参数，不会把值写入配置、日志或错误输出。

如隧道客户端支持环境变量，先在操作系统的用户级私有环境或该客户端的凭据机制中提供值，再用 `--tunnel-env-json`（隧道环境变量映射）保存“隧道进程变量名 -> 已有来源变量名”。例如上例的 `TUNNEL_TOKEN -> READ_CODE_TUNNEL_TOKEN` 只保存两个名称。若客户端支持 profile（配置文件）或系统凭据存储，优先使用其路径/引用；不要把凭据正文放入 `agent.json`。

## 平台差异

| 平台 | 启动方式 | 生成位置 |
|---|---|---|
| Windows（视窗系统） | 登录触发的 `ReadCodeChatGPTSupervisor` 任务计划，失败时重试；若系统策略拒绝任务计划，则使用当前用户启动文件夹回退 | `~/.read-code-chatgpt/autostart/ReadCodeChatGPTSupervisor.xml` 或用户启动文件夹的 `ReadCodeChatGPTSupervisor.cmd` |
| macOS（苹果系统） | `com.read-code-chatgpt.supervisor` LaunchAgent，`RunAtLoad` + `KeepAlive` | `~/Library/LaunchAgents/com.read-code-chatgpt.supervisor.plist` |

Windows（视窗系统）任务计划通过 `pushd`（切换到网络路径）支持 UNC（网络共享）工作目录；启动文件夹回退直接运行绝对 Node（节点运行时）入口，由用户配置提供工作目录，因此不依赖 UNC 当前目录。不要把隧道令牌、API Key（接口密钥）或个人路径提交到 `server.config.json`、任务 XML（可扩展标记语言）或仓库文档。

## 故障判断

- `healthy_external`（健康外部）：端点健康，但不是当前守护启动；保持观察。
- `healthy_managed`（健康受管）：端点健康，进程由当前守护启动。
- `unhealthy_external`（异常外部）：端口已被未知进程占用；守护不终止它。先人工处理冲突。
- `unhealthy_managed`（异常受管）：守护仍存活且其子进程仍存在，但健康检查失败；守护会停止并在退避后重建该子进程。
- `unavailable`（不可用）：端口未占用且健康失败；守护会按有上限的指数退避启动配置的受管进程。连续失败的下一次可启动延迟为 2、4、8 秒并上限 60 秒；同一受管进程连续两个健康轮询后才清零。

独立执行 `agent status`（状态）会读取新鲜且仍存活的守护状态，以免把已知受管子进程误报为外部进程；过期状态不被信任。若 `doctor`（诊断）提示 MCP、隧道路径或配置的隧道来源环境变量不存在，先修正本机环境或 `agent.json`，再执行 `install` 或重启 `run`（运行）循环。
