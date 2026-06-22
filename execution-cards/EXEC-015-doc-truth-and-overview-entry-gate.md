# EXEC-015：文档真实状态校正与读仓入口收敛

状态：complete（完成）。
依赖：EXEC-014 complete（完成）。

## 1. Objective

修正会误导 ChatGPT（聊天模型）的过时仓库说明，并把“读仓库时先怎么建立上下文”的说明收敛到一致口径。

本卡的目标不是新增 IDE（集成开发环境）式能力，而是先消除 stale docs（过时文档）和 duplicate guidance（重复指引）造成的混淆，让 ChatGPT 在真实使用中少命中过时材料、少绕路。

## 2. Scope

Allowed files（允许修改）：
- `implementation/docs/mcp-gateway-contract.md`
- `implementation/docs/chatgpt-connector-setup.md`
- `README.md`
- `CONNECT_CHATGPT.md`
- `implementation/src/server.ts`（仅允许收敛 runtime instructions，即运行时指引）
- `implementation/src/config.ts`（仅允许收敛工具 description，即工具描述）
- `tool-schemas.json`（仅当 `implementation/src/config.ts` 的工具描述有同步需要）
- `execution-cards/index.md`
- `execution-cards/task-import-map.json`
- `execution-cards/EXEC-015-doc-truth-and-overview-entry-gate.md`

Optional only if directly needed（只有直接需要时才允许）：
- `execution-cards/_archive_obsolete_first_split/README.md`（仅用于给废弃归档目录加明确 obsolete archive，即废弃归档，说明）

Hard limits（硬边界）：
- 不新增 `workspace.discover`（工作区发现）、候选仓库发现、shell（命令行外壳）、git（版本控制）执行、测试执行、写仓库工具、整仓导出、向量库、embedding（向量嵌入）、常驻索引服务或文件监听。
- 不改 `repo.list` 输出 schema（模式）；`root_files`、`workspace_markers`、`config_files`、`test_dirs` 等字段只作为后续候选，不在本卡实现。
- 不改变 `repo.search`、`repo.fetch`、`repo.tree`、`repo.symbols`、`repo.refresh` 的运行时行为。
- 不放宽白名单、敏感文件、路径穿越、预算、只读边界。
- 不提交真实 API Key（接口密钥）、Tunnel ID（隧道标识）、本机绝对路径或 UNC（网络共享路径）。

## Required Deliverables

Primary deliverables（主产物）：
- `execution-cards/EXEC-015-doc-truth-and-overview-entry-gate.md`
- 上方 Allowed files（允许修改）中被实际触碰的文档或配置说明文件。

Closeout deliverables（收口产物）：
- `execution-cards/EXEC-015-doc-truth-and-overview-entry-gate.claude-review/cycle1.input.json`
- `execution-cards/EXEC-015-doc-truth-and-overview-entry-gate.claude-review/cycle1.receipt.json`
- `execution-cards/EXEC-015-doc-truth-and-overview-entry-gate.claude-review/closure.json`
- `execution-cards/EXEC-015-doc-truth-and-overview-entry-gate.claude-review/validator_result.json`

Artifact existence validation（产物存在性校验）：
- 关闭前必须确认主产物存在。
- required artifact path missing（必交产物路径缺失）时不得写 `complete`（完成）。

## 3. Required Work

1. 校正过时实现状态
   - `implementation/docs/mcp-gateway-contract.md` 不得继续声称工具仍是 scaffold（骨架）或 `not_implemented`（未实现）。
   - 该文档必须反映当前真实工具集合：`repo.list`、`repo.search`、`repo.fetch`、`repo.tree`、`repo.symbols`、`repo.refresh`。
   - 如文档保留历史阶段说明，必须明确标为 historical note（历史说明），不得让 ChatGPT 误判当前运行状态。

2. 收敛读仓说明
   - 不新增第四套独立说明文档。
   - 在现有说明中统一两条流程：
     - 定点问题：优先 `repo.symbols` / `repo.search`，再 `repo.fetch`。
     - 陌生仓库首次定向：先 `repo.list` 建立轻量地图；只有需要目录布局时，再用 `repo.tree(path=".", depth=1)`；随后读取 README（说明文件）、主配置、入口或测试相关文件；再用 `repo.search` / `repo.symbols` 深挖。
   - 文档必须说明 `repo.tree` 仍不是整仓扫描工具，不能鼓励默认全仓树。

3. 明确暂缓项
   - 在任务卡或相关说明中明确：`repo.list` 字段扩展、候选仓库发现、引用/调用图、shell（命令行外壳）或 git（版本控制）能力，均不是本卡范围。
   - 如未来要做 `repo.list` 轻量增强，必须另立任务卡，并证明当前字段不足；新增字段必须有硬上限，并只从已授权 snapshot manifest（快照清单）派生。
   - 如未来要做候选仓库发现，必须独立于 `repo.list`，并发生在绑定前；只允许扫描受控 workspace（工作区）下的项目标记，不读取源码正文。

## 4. Acceptance Criteria

- `implementation/docs/mcp-gateway-contract.md` 不再包含会让读者认为当前工具仍未实现的未限定说法。
- 活动文档里的读仓流程口径一致，不出现互相冲突的默认流程。
- 文档仍保留低成本读取目标：定点问题不强制先 `repo.tree`。
- 任务卡明确禁止本卡实现候选仓库发现、shell（命令行外壳）、git（版本控制）执行、整仓导出或重型索引。
- 任务卡明确把 `repo.list` 输出增强列为后续候选，不把它伪装成本卡必做项。
- `execution-cards` 结构校验通过，卡片数量更新为 16。
- Claude closeout（Claude 收口复核）完成，候选问题已分类，`validate_closure.py` 通过后才允许写 `complete`（完成）。

## 5. Validation

必须执行：
- `powershell -NoProfile -ExecutionPolicy Bypass -File ".\execution-cards\validate-execution-cards.ps1" -CardsDir ".\execution-cards"`
- Search check（搜索校验）：确认活动文档中不存在未限定的旧骨架状态短语，包括 `returns` 与 `not_implemented` 连用、`所有工具返回` 与 `not_implemented` 连用，以及旧 scaffold（骨架）整体状态句。
- Drift check（漂移校验）：检查 `README.md`、`CONNECT_CHATGPT.md`、`implementation/docs/chatgpt-connector-setup.md`、`implementation/src/server.ts` 中的读仓流程没有互相冲突。
- Sensitive scan（敏感扫描）：API Key（接口密钥）、Tunnel ID（隧道标识）、真实本机路径、UNC（网络共享路径）。
- `git diff --check`

不要求执行：
- `npm test`
- `npm run build`
- MCP SDK（模型上下文协议开发包）端到端调用

跳过原因：本卡是 task-card/docs-only（任务卡/文档）收敛任务，不改变 TypeScript（类型脚本）运行时代码或工具 schema（模式）。如果执行器实际修改 `implementation/src/server.ts`、`implementation/src/config.ts` 或 `tool-schemas.json`，则必须追加 `npm run typecheck`、`npm test`、`npm run build` 和 MCP SDK 相关验证。

## 6. Required Evidence

- 任务卡结构校验输出和 exit code（退出码）。
- Search check（搜索校验）输出，证明 stale implemented-state（过时实现状态）描述已清理或限定为历史说明。
- Drift check（漂移校验）摘要，说明定点问题和陌生仓库首次定向两条流程没有互相冲突。
- Sensitive scan（敏感扫描）无命中结果。
- `git diff --check` exit code（退出码）。
- 若跳过代码级验证，必须列出 skipped validations and reason（跳过验证及原因）。

## 7. Completion Writeback

changed files:
- `execution-cards/index.md`
- `execution-cards/task-import-map.json`
- `execution-cards/EXEC-015-doc-truth-and-overview-entry-gate.md`
- `implementation/docs/mcp-gateway-contract.md`

created artifacts:
- `execution-cards/EXEC-015-doc-truth-and-overview-entry-gate.md`
- `execution-cards/EXEC-015-doc-truth-and-overview-entry-gate.claude-review/cycle1.input.json`
- `execution-cards/EXEC-015-doc-truth-and-overview-entry-gate.claude-review/cycle1.receipt.json`
- `execution-cards/EXEC-015-doc-truth-and-overview-entry-gate.claude-review/closure.json`
- `execution-cards/EXEC-015-doc-truth-and-overview-entry-gate.claude-review/validator_result.json`

validation commands:
- `powershell -NoProfile -ExecutionPolicy Bypass -File "<repo-root>/execution-cards/validate-execution-cards.ps1" -CardsDir "<repo-root>/execution-cards"`
- `rg -n "<old-scaffold-status-phrases>" README.md CONNECT_CHATGPT.md implementation/docs execution-cards --glob '!**/.claude-review/**' --glob '!execution-cards/_archive_obsolete_first_split/**'`；实际搜索短语保存在本地忽略的 Claude（外部复核）证据目录，不在任务卡正文原样重复，避免自命中。
- Drift check（漂移校验）：读取 `README.md`、`CONNECT_CHATGPT.md`、`implementation/docs/chatgpt-connector-setup.md`、`implementation/src/server.ts`，确认 `repo.list`、`repo.symbols`、`repo.search`、`repo.fetch`、`repo.tree`、`repo.refresh` 指引一致。
- `rg --hidden --glob '!implementation/node_modules/**' --glob '!implementation/dist/**' --glob '!.git/**' --glob '!**/.claude-review/**' -n "<api-key-pattern>|<tunnel-id-pattern>|<local-path-pattern>|<control-plane-key-pattern>" <repo-root>`；实际本机路径正则只保存在本地忽略的 Claude（外部复核）证据目录，不进入发布文档。
- `git -C <repo-root> diff --check`
- `cmd /d /c 'pushd "<repo-root>/implementation" && npm run typecheck && npm test && npm run build && popd'`
- `py -3 "<codex-home>/skills/claude-taskcard-review/scripts/claude_taskcard_review.py" --input "execution-cards/EXEC-015-doc-truth-and-overview-entry-gate.claude-review/cycle1.input.json" --output "execution-cards/EXEC-015-doc-truth-and-overview-entry-gate.claude-review/cycle1.receipt.json"`
- `py -3 "<codex-home>/skills/claude-taskcard-review/scripts/validate_closure.py" --closure "execution-cards/EXEC-015-doc-truth-and-overview-entry-gate.claude-review/closure.json" --output "execution-cards/EXEC-015-doc-truth-and-overview-entry-gate.claude-review/validator_result.json"`

validation results, including exit code:
- execution card validator（任务卡结构校验）：exit code（退出码）0；`PASS execution card validation`；`cards=16`。
- Search check（搜索校验）：exit code（退出码）1；无命中，`rg` 的 1 表示没有匹配到旧骨架状态短语。
- Drift check（漂移校验）：exit code（退出码）0；`README.md`、`CONNECT_CHATGPT.md`、`implementation/docs/chatgpt-connector-setup.md`、`implementation/src/server.ts` 均保持同一读仓顺序：多仓库先 `repo.list`，定点问题先 `repo.symbols` / `repo.search`，再 `repo.fetch`，仅目录问题使用 `repo.tree`，陈旧快照才用 `repo.refresh`。
- Sensitive scan（敏感扫描）：exit code（退出码）1；无 API Key（接口密钥）、Tunnel ID（隧道标识）、真实本机路径、UNC（网络共享路径）命中；`rg` 的 1 表示无匹配。
- `git diff --check`：exit code（退出码）0；无空白错误，仅有 Git（版本控制）对既有文本文件的 CRLF（回车换行）规范化警告。
- Extra TypeScript validation（额外类型脚本验证）：exit code（退出码）0；`npm run typecheck` 通过；`npm test` 通过，156 pass（通过）、0 fail（失败）、1 skipped（跳过，Windows 平台权限差异）；`npm run build` 通过。
- Claude closeout（Claude 收口复核）：exit code（退出码）0；`call_status=ok`，`recommendation=support`，`candidate_issues=[]`，`missing_evidence=[]`，`writeback_risks=[]`。
- `validate_closure.py`：exit code（退出码）0；`status=passed`，`can_write_complete=true`，`blocking_reasons=[]`。

skipped validations and reason:
- MCP SDK（模型上下文协议开发包）端到端连接器调用未单独追加执行；原因是本卡仅修改任务卡和文档，不改 TypeScript（类型脚本）运行时代码或工具 schema（模式）。作为额外保险，本轮已执行完整 `typecheck`（类型检查）、`test`（测试）和 `build`（构建），其中现有测试覆盖工具注册、`repo.list` 多仓库选择、`repo.refresh`、只读工具、路径守卫、响应体拆分和发现端点。

protected files unchanged:
- 未修改运行时工具行为。
- 未修改 TypeScript（类型脚本）源码。
- 未修改 `tool-schemas.json`。
- 未新增候选仓库发现、shell（命令行外壳）执行、git（版本控制）执行、写工具、整仓导出、向量库、embedding（向量嵌入）或文件监听。
- 未修改仓库权限、路径守卫、预算、敏感文件过滤或只读边界。

remaining blockers:
- none（无）。

completion status:
- complete（完成）。

## 8. Non-Completion Rule

不得写 `complete`（完成）：
- required artifact path missing（必交产物路径缺失）。
- 活动文档仍声称当前工具返回 `not_implemented`（未实现），且未明确标为 historical note（历史说明）。
- 文档把 `repo.tree` 描述成默认整仓扫描入口。
- 本卡执行中新增候选仓库发现、shell（命令行外壳）、git（版本控制）执行、整仓导出、向量库或重型索引。
- 修改了运行时代码或 schema（模式）但没有运行对应 TypeScript（类型脚本）验证和 MCP SDK（模型上下文协议开发包）验证。
- 敏感扫描发现真实 API Key（接口密钥）、Tunnel ID（隧道标识）、本机路径或 UNC（网络共享路径）。
- Claude closeout（Claude 收口复核）缺失、未分类 `accepted_blocking` 问题，或 `validate_closure.py` 未通过。

## Claude Closeout Review

- 终止回写前必须调用 `claude-taskcard-review`（Claude 任务卡复核）。
- 回执、closure（收口）和 validator_result（校验结果）写入同名 `.claude-review` 目录。
- 每个 Claude finding（Claude 候选问题）必须分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`。
- `closure.json` 必须通过 `validate_closure.py`。
- Claude（克劳德）只做 advisory（建议性）复核，最终状态以本地证据决定。
