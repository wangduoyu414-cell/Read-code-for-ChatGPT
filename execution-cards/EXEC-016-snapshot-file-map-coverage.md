# EXEC-016：快照文件地图覆盖与源码优先读取

状态：complete（完成）。
依赖：EXEC-015 complete（完成）。

## 1. Objective

修复真实大仓库中 ChatGPT（聊天网页端）读不全源码的问题：当 `reports`（报告目录）、`archive`（归档目录）或临时输出目录在遍历顺序中先消耗 `maxEntries`（最大遍历条目）时，`src`（源码目录）、`tests`（测试目录）、`tools`（工具目录）可能没有进入 snapshot manifest（快照清单），导致 `repo_tree`（目录树）、`repo_search`（搜索）和 `repo_fetch`（读取）都看不到源码。

本卡目标是让 ChatGPT 先拿到授权快照内稳定、可分页、可解释的文件地图，并让代码审查常用目录优先进入快照清单。不得通过直接读取实时工作目录绕过 snapshot（快照）边界。

## 2. Scope

Allowed files（允许修改）：
- `CONNECT_CHATGPT.md`
- `README.md`
- `docs/SECURITY.md`
- `implementation/src/config.ts`
- `implementation/src/server.ts`
- `implementation/src/auth/oauth-metadata.ts`
- `implementation/src/snapshot/manifest.ts`
- `implementation/src/snapshot/snapshot-ingest.ts`
- `implementation/src/tools/read-only-tools.ts`
- `implementation/src/tools/registry.ts`
- `implementation/src/snapshot/refresh.ts`（仅当刷新响应需要暴露覆盖率摘要）
- `implementation/scripts/check-read-code-link.mjs`
- `implementation/tests/*.test.ts`
- `implementation/docs/snapshot-manifest-contract.md`
- `implementation/docs/chatgpt-connector-setup.md`
- `implementation/package.json`（仅当需要注册本地链路自检脚本）
- `tool-schemas.json`
- `execution-cards/index.md`
- `execution-cards/task-import-map.json`
- `execution-cards/EXEC-016-snapshot-file-map-coverage.md`

Hard limits（硬边界）：
- 不新增写文件、shell（命令行外壳）、git（版本控制）、代码执行、整仓导出、向量库、embedding（向量嵌入）或文件监听能力。
- `repo_fetch`（读取）不得读取 snapshot manifest（快照清单）之外的真实文件。
- 不放宽 `.env`、key（密钥）、token（令牌）、credentials（凭据）、private key（私钥）等敏感文件阻断。
- 不把 `reports`（报告目录）或 `archive`（归档目录）永久禁止读取；本卡只要求默认代码审查场景优先扫描源码目录，并解释被排除或延后原因。
- 不把 `repo_tree`（目录树）分页、`repo_overview`（仓库概览）或 workspace discovery（工作区发现）纳入本卡完成范围。
- 不提交真实 API Key（接口密钥）、Tunnel ID（隧道标识）、本机绝对路径或 UNC（网络共享路径）。

## Required Deliverables

Primary deliverables（主产物）：
- `execution-cards/EXEC-016-snapshot-file-map-coverage.md`
- `implementation/src/snapshot/manifest.ts`
- `implementation/src/snapshot/snapshot-ingest.ts`
- `implementation/src/tools/read-only-tools.ts`
- `implementation/src/tools/registry.ts`
- `implementation/src/config.ts`
- `tool-schemas.json`

Closeout deliverables（收口产物）：
- `execution-cards/EXEC-016-snapshot-file-map-coverage.claude-review/cycle1.input.json`
- `execution-cards/EXEC-016-snapshot-file-map-coverage.claude-review/cycle1.receipt.json`
- `execution-cards/EXEC-016-snapshot-file-map-coverage.claude-review/closure.json`
- `execution-cards/EXEC-016-snapshot-file-map-coverage.claude-review/validator_result.json`

Artifact existence validation（产物存在性校验）：
- 关闭前必须确认主产物存在。
- required artifact path missing（必交产物路径缺失）时不得写 `complete`（完成）。

## 3. Required Work

1. 快照扫描优先级
   - `snapshot-ingest`（快照扫描）必须使用确定性排序。
   - 代码审查常用目录和根元数据优先：`src`、`tests`、`tools`、`config`、`.github`、主要文档和构建配置。
   - 历史证据和大量输出目录延后：`reports`、`archive`、`.multica-import`、`.omx`、临时目录、缓存目录。
   - 当 `maxEntries`（最大遍历条目）触发时，源码目录应优先于历史输出进入 manifest（清单）。

2. 文件状态模型
   - snapshot manifest（快照清单）必须区分文件是否 `fetchable`（可读取）和是否 `index_admitted`（允许索引）。
   - `repo_fetch`（读取）只要求文件在 manifest（清单）内且 `fetchable=true`，不得要求文件已进入搜索索引。
   - `repo_tree`（目录树）可继续以 `index_admitted` 或 fetchable（可读取）文件派生，但不得成为完整文件地图的唯一入口。

3. 新增 `repo_files`（文件列表）工具
   - 返回授权快照内的文件地图，不返回文件正文。
   - 支持 `repo_path`（仓库路径）、`snapshot_id`（快照标识）、`prefix`（路径前缀）、`suffixes`（后缀列表）、`languages`（语言列表）、`states`（状态列表）、`cursor`（游标）、`limit`（数量上限）。
   - 支持分页，游标必须绑定 `snapshot_id`、`repo_path`、过滤条件和排序方式。
   - 返回 counts（计数）、items（条目）、has_more（是否还有更多）和 next_cursor（下一页游标）。
   - 每个条目必须说明 `fetchable`（可读取）、`indexed`（已索引或允许索引）、`state`（状态）和 `exclusion_reason`（排除原因，若有）。

4. 文档与契约同步
   - `tool-schemas.json` 必须新增 `repo_files` 并与 runtime registry（运行时注册表）保持一致。
   - README（说明文档）和 ChatGPT 接入说明必须告诉使用者：陌生仓库先 `repo_list`，再 `repo_files` 获取文件地图；目录布局问题才用 `repo_tree`。

## 4. Acceptance Criteria

- 对含大量 `reports`（报告目录）且 `src`（源码目录）排序靠后的测试仓库，`ingestDirectory(..., { maxEntries })` 后 `src` 文件仍进入 manifest（清单）。
- `repo_files`（文件列表）出现在 MCP tools/list（工具列表）和 `tool-schemas.json` 中，且 ChatGPT metadata（元数据）为 model-visible（模型可见）。
- `repo_files` 能按 prefix（前缀）、suffixes（后缀）、languages（语言）、states（状态）过滤，并能分页。
- `repo_files` 返回 counts（计数）和 exclusion reason summary（排除原因摘要），让 ChatGPT 判断文件不存在、未索引、被排除或达到上限。
- `repo_fetch` 能读取 manifest（清单）内 `fetchable=true` 且 `index_admitted=false` 的文件片段。
- `repo_fetch` 仍拒绝 manifest（清单）外文件、路径穿越、敏感文件和内容安全命中。
- `repo_search` 对未索引文件可以搜不到，但不得因此阻止 `repo_files` 发现或 `repo_fetch` 读取。
- 任务卡结构校验通过，卡片数量更新为 17。
- TypeScript（类型脚本）类型检查、测试、构建和本地 link check（链路自检）通过。
- Claude closeout（Claude 收口复核）完成，候选问题已分类，`validate_closure.py` 通过后才允许写 `complete`（完成）。

## 5. Validation

必须执行：
- `powershell -NoProfile -ExecutionPolicy Bypass -File ".\execution-cards\validate-execution-cards.ps1" -CardsDir ".\execution-cards"`
- `cmd /d /c 'pushd "<repo-root>/implementation" && npm run typecheck && npm test && npm run build && popd'`
- `cmd /d /c 'pushd "<repo-root>/implementation" && node scripts/check-read-code-link.mjs --require-tunnel --tunnel-admin-url http://127.0.0.1:18080 && popd'`
- Focused runtime probe（聚焦运行探针）：启动或复用本地 MCP（模型上下文协议）服务后，证明 `repo_files` 能列出目标仓库 `src`、`tests` 或 `tools` 文件。
- Sensitive scan（敏感扫描）：API Key（接口密钥）、Tunnel ID（隧道标识）、真实本机路径、UNC（网络共享路径）。
- `git diff --check`

允许跳过：
- ChatGPT 网页端人工点击验证；原因是本卡可用 MCP SDK（模型上下文协议开发包）证明工具注册和本地链路，ChatGPT 网页端连接器 metadata refresh（元数据刷新）需要用户在网页设置里触发。

## 6. Required Evidence

- 任务卡结构校验输出和 exit code（退出码）。
- TypeScript（类型脚本）类型检查、测试、构建输出和 exit code（退出码）。
- `repo_files` 工具契约测试和运行时调用证据。
- 大仓库样式 fixture（夹具）证明源码目录优先进入 manifest（清单）。
- `repo_fetch` 读取 fetchable-unindexed（可读取但未索引）文件的测试证据。
- Link check（链路自检）输出和 exit code（退出码）。
- Sensitive scan（敏感扫描）无命中结果。
- `git diff --check` exit code（退出码）。

## 7. Completion Writeback

changed files:
- `CONNECT_CHATGPT.md`
- `README.md`
- `docs/SECURITY.md`
- `execution-cards/index.md`
- `execution-cards/task-import-map.json`
- `execution-cards/EXEC-016-snapshot-file-map-coverage.md`
- `implementation/docs/chatgpt-connector-setup.md`
- `implementation/docs/snapshot-manifest-contract.md`
- `implementation/package.json`
- `implementation/src/auth/oauth-metadata.ts`
- `implementation/src/config.ts`
- `implementation/src/server.ts`
- `implementation/src/snapshot/manifest.ts`
- `implementation/src/snapshot/snapshot-ingest.ts`
- `implementation/src/tools/read-only-tools.ts`
- `implementation/src/tools/registry.ts`
- `implementation/tests/auth-policy.test.ts`
- `implementation/tests/read-only-tools.test.ts`
- `implementation/tests/refresh-tool.test.ts`
- `implementation/tests/server-smoke.test.ts`
- `implementation/tests/snapshot-ingest.test.ts`
- `implementation/tests/snapshot-manifest.test.ts`
- `implementation/tests/tool-contract.test.ts`
- `tool-schemas.json`

created artifacts:
- `execution-cards/EXEC-016-snapshot-file-map-coverage.md`
- `execution-cards/EXEC-016-snapshot-file-map-coverage.claude-review/cycle1.input.json`
- `execution-cards/EXEC-016-snapshot-file-map-coverage.claude-review/cycle1.receipt.json`
- `execution-cards/EXEC-016-snapshot-file-map-coverage.claude-review/closure.json`
- `execution-cards/EXEC-016-snapshot-file-map-coverage.claude-review/validator_result.json`
- `implementation/scripts/check-read-code-link.mjs`
- `implementation/tests/tool-contract.test.ts`

validation commands:
- `powershell -NoProfile -ExecutionPolicy Bypass -File "<repo-root>/execution-cards/validate-execution-cards.ps1" -CardsDir "<repo-root>/execution-cards"`
- `cmd /d /c 'pushd "<repo-root>/implementation" && npm run typecheck && npm test && npm run build && popd'`
- `cmd /d /c 'pushd "<repo-root>/implementation" && node scripts/check-read-code-link.mjs --require-tunnel --tunnel-admin-url http://127.0.0.1:18080 && popd'`
- Focused runtime probe（聚焦运行探针）：`repo_files` 调用目标仓库源码前缀。
- Sensitive scan（敏感扫描）：不在任务卡正文保存真实敏感正则。
- `git diff --check`
- `py -3 "<codex-home>/skills/claude-taskcard-review/scripts/claude_taskcard_review.py" --input "execution-cards/EXEC-016-snapshot-file-map-coverage.claude-review/cycle1.input.json" --output "execution-cards/EXEC-016-snapshot-file-map-coverage.claude-review/cycle1.receipt.json"`
- `py -3 "<codex-home>/skills/claude-taskcard-review/scripts/validate_closure.py" --closure "execution-cards/EXEC-016-snapshot-file-map-coverage.claude-review/closure.json" --output "execution-cards/EXEC-016-snapshot-file-map-coverage.claude-review/validator_result.json"`

validation results, including exit code:
- Task-card validation（任务卡结构校验）：exit code（退出码）0；`PASS execution card validation`；`cards=17`。
- TypeScript（类型脚本）类型检查、测试、构建：exit code（退出码）0；`npm run typecheck` 通过；`npm test` 通过，`tests=190`、`pass=189`、`fail=0`、`skipped=1`；`npm run build` 通过。
- Link check（链路自检）：exit code（退出码）0；MCP tools/list（工具列表）包含 `repo_list`、`repo_search`、`repo_files`、`repo_fetch`、`repo_tree`、`repo_symbols`、`repo_refresh`；model-visible（模型可见）工具数为 7；`repo_list` 返回 3 个仓库；`repo_files` 和 `repo_tree` 调用通过；tunnel admin（隧道管理端）健康和 ready（就绪）检查通过。
- Focused runtime probe（聚焦运行探针）：exit code（退出码）0；目标仓库 `ADB` 的 `src` prefix（前缀）通过 `repo_files` 返回 `matching_total=211`；首个源码路径 `src/social_ops_assistant/__init__.py` 可由 `repo_fetch` 读取，返回正文片段。
- Claude closeout（Claude 收口复核）：exit code（退出码）0；`cycle1.receipt.json` 的 `call_status=ok`、`recommendation=concerns`；3 个 candidate issues（候选问题）均分类为 `accepted_non_blocking` 并已修复或按预期收口。
- Claude closure validation（Claude 收口校验）：exit code（退出码）0；`status=passed`；`closure_valid=true`；`receipts_valid=true`；`can_write_complete=true`；`blocking_reasons=[]`。
- Sensitive scan（敏感扫描）：exit code（退出码）0；扫描 tracked（已跟踪）和 untracked（未跟踪）发布候选文件，未发现真实 `sk-proj` key（项目密钥）、真实 `tunnel_` token（隧道令牌）、当前本机真实路径或当前 UNC（网络共享）路径。
- `git diff --check`：exit code（退出码）0；无 whitespace error（空白错误），仅有行尾转换 warning（警告）。

skipped validations and reason:
- ChatGPT web manual click-through（网页端手动点击验证）：跳过。原因：MCP SDK（模型上下文协议开发包）link check（链路自检）和 runtime probe（运行探针）已证明本地连接链路；ChatGPT 网页端 connector metadata refresh（连接器元数据刷新）需要用户在网页设置中触发。
- POSIX unreadable-directory snapshot test（POSIX 不可读目录快照测试）：跳过。原因：当前执行环境为 Windows（视窗系统），POSIX 权限语义不可移植，现有测试在 Windows 上按设计跳过。

protected files unchanged:
- 未新增写文件、shell（命令行外壳）、git（版本控制）、代码执行、整仓导出、向量库、embedding（向量嵌入）或文件监听工具。
- `repo_fetch`（读取）仍要求目标文件在 snapshot manifest（快照清单）内且 `fetchable=true`；未改成直接读真实工作目录。
- `.env`、key（密钥）、token（令牌）、credentials（凭据）、private key（私钥）等敏感阻断未放宽。
- 未把 `repo_tree`（目录树）分页、`repo_overview`（仓库概览）或 workspace discovery（工作区发现）纳入本卡运行时代码范围。

remaining blockers:
- none（无）。

completion status:
- complete（完成）。

## 8. Non-Completion Rule

不得写 `complete`（完成）：
- required artifact path missing（必交产物路径缺失）。
- `repo_fetch`（读取）绕过 snapshot manifest（快照清单）直接读真实工作目录。
- `repo_files`（文件列表）返回文件正文、密钥、敏感内容或整仓导出。
- `src`（源码目录）仍会在含大量 `reports`（报告目录）的有限扫描 fixture（夹具）中被上限挤出。
- 运行时代码或 schema（模式）改变但没有执行 TypeScript（类型脚本）类型检查、测试、构建和 link check（链路自检）。
- 敏感扫描发现真实 API Key（接口密钥）、Tunnel ID（隧道标识）、本机路径或 UNC（网络共享路径）。
- Claude closeout（Claude 收口复核）缺失、未分类 `accepted_blocking` 问题，或 `validate_closure.py` 未通过。

## Claude Closeout Review

- 终止回写前必须调用 `claude-taskcard-review`（Claude 任务卡复核）。
- 回执、closure（收口）和 validator_result（校验结果）写入同名 `.claude-review` 目录。
- 每个 Claude finding（Claude 候选问题）必须分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`。
- `closure.json` 必须通过 `validate_closure.py`。
- Claude（克劳德）只做 advisory（建议性）复核，最终状态以本地证据决定。
