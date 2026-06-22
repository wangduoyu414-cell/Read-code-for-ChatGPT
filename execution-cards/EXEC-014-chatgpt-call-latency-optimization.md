# EXEC-014：ChatGPT 低成本读仓优化

状态：complete（完成）。
依赖：EXEC-013 complete（完成）。

## 1. Objective

让 ChatGPT（聊天模型）接入后更快、更少绕路地读取本地授权仓库：优先用精确工具命中代码，再读取目标文件；避免默认拉大目录树或重复传大 JSON（数据对象）。

目标调用路径：
- 找定义：`repo.symbols`。
- 找文本、配置、报错、文档：`repo.search`。
- 已知路径后读内容：`repo.fetch`。
- 只有问目录结构时用：`repo.tree`。
- 仓库变化或结果过期时用：`repo.refresh`。

## 2. Scope

Allowed files（允许修改）：
- `implementation/src/server.ts`
- `implementation/src/config.ts`
- `implementation/src/tools/read-only-tools.ts`
- `implementation/src/tools/registry.ts`
- `implementation/tests/read-only-tools.test.ts`
- `implementation/tests/server-smoke.test.ts`
- `implementation/docs/chatgpt-connector-setup.md`
- `CONNECT_CHATGPT.md`
- `README.md`
- `tool-schemas.json`
- `execution-cards/index.md`
- `execution-cards/task-import-map.json`
- `execution-cards/EXEC-014-chatgpt-call-latency-optimization.md`

Hard limits（硬边界）：
- 不新增写仓库、shell（命令行外壳）、数据库、向量库、embedding（向量嵌入）、缓存守护进程、文件监听。
- 不放宽白名单、敏感文件、路径穿越、预算、只读边界。
- 不把 `repo.tree` 做成整仓导出。
- 不提交真实 API Key（接口密钥）、Tunnel ID（隧道标识）、本机绝对路径或 UNC（网络共享路径）。

## Required Deliverables

Primary deliverables（主产物）：
- 上方 Allowed files（允许修改）中的相关文件。

Closeout deliverables（收口产物）：
- `execution-cards/EXEC-014-chatgpt-call-latency-optimization.claude-review/cycle1.input.json`
- `execution-cards/EXEC-014-chatgpt-call-latency-optimization.claude-review/cycle1.receipt.json`
- `execution-cards/EXEC-014-chatgpt-call-latency-optimization.claude-review/closure.json`
- `execution-cards/EXEC-014-chatgpt-call-latency-optimization.claude-review/validator_result.json`

Artifact existence validation（产物存在性校验）：
- 关闭前必须确认主产物和收口产物存在。
- required artifact path missing（必交产物路径缺失）时不得写 `complete`（完成）。

## 3. Required Work

1. 工具说明与文档瘦身
   - 服务端 instructions（指引）和工具 description（描述）必须引导 ChatGPT 先 `repo.symbols` / `repo.search`，再 `repo.fetch`。
   - `repo.tree` 只描述为目录导航工具。
   - 文档说明大仓库应绑定最小项目目录，不建议整盘或过大工作区。

2. 返回体瘦身
   - 成功调用的完整结果只放 `structuredContent`（结构化内容）。
   - `content`（文本回退）只放短摘要，不能再复制完整 JSON（数据对象）。
   - 摘要至少包含 tool（工具）、audit_id（审计标识）和关键结果数量。

3. 仓库选择与目录摘要
   - `repo.tree` 默认 `depth=1`、`limit=50`，返回 directory（目录）节点和 bounded（有界）文件节点。
   - `repo.list` 返回 `name`、`description`、`repo_path`、`snapshot_id`、`file_count`、`top_dirs`、`primary_languages`，不得暴露 `repo_id`。
   - 单仓库时 `repo.search`、`repo.fetch`、`repo.tree`、`repo.symbols`、`repo.refresh` 可省略 `repo_path`；多仓库时省略必须返回 `access_denied`。

## 4. Acceptance Criteria

- `repo.tree` 默认输出更小，根目录能看到目录节点。
- `content` 短摘要与 `structuredContent` 完整结果分离。
- `repo.list` 能帮助 ChatGPT 区分多仓库，且不暴露 `repo_id`。
- 单仓库可省略 `repo_path`；多仓库不可省略。
- 安全边界、预算、敏感文件和只读能力不被放宽。
- `tool-schemas.json` 与运行时工具 schema（模式）一致，且不含真实敏感信息。

## 5. Validation

必须执行：
- `powershell -NoProfile -ExecutionPolicy Bypass -File ".\execution-cards\validate-execution-cards.ps1" -CardsDir ".\execution-cards"`
- `npm run typecheck`
- `npm test`
- `npm run build`
- MCP SDK（模型上下文协议开发包）本地调用验证：`client.listTools()`、`repo.list`、单仓库省略 `repo_path`、多仓库省略 `repo_path`、`content` 与 `structuredContent` 分离。
- 敏感扫描：API Key（接口密钥）、Tunnel ID（隧道标识）、真实本机路径、UNC（网络共享路径）。

## 6. Required Evidence

- 任务卡结构校验输出和 exit code（退出码）。
- `npm run typecheck`、`npm test`、`npm run build` 输出和 exit code（退出码）。
- MCP SDK（模型上下文协议开发包）验证摘要，证明工具数量、仓库摘要、单/多仓库规则和返回体分离。
- 敏感扫描无命中。

## 7. Completion Writeback

changed files:
- `CONNECT_CHATGPT.md`
- `README.md`
- `execution-cards/index.md`
- `execution-cards/task-import-map.json`
- `implementation/docs/chatgpt-connector-setup.md`
- `implementation/src/config.ts`
- `implementation/src/server.ts`
- `implementation/src/startup.ts`
- `implementation/src/tools/read-only-tools.ts`
- `implementation/src/tools/registry.ts`
- `implementation/tests/read-only-tools.test.ts`
- `implementation/tests/server-smoke.test.ts`
- `tool-schemas.json`

created artifacts:
- `execution-cards/EXEC-014-chatgpt-call-latency-optimization.md`
- Local closeout artifacts（本地收口证据，按 `.gitignore` 不提交）：`execution-cards/EXEC-014-chatgpt-call-latency-optimization.claude-review/cycle1.input.json`、`cycle1.receipt.json`、`closure.json`、`validator_result.json`

validation commands:
- `powershell -NoProfile -ExecutionPolicy Bypass -File ".\execution-cards\validate-execution-cards.ps1" -CardsDir ".\execution-cards"`
- `npm run typecheck`
- `npm test`
- `npm run build`
- `git diff --check`
- `rg` sensitive scan（敏感信息扫描）for API Key（接口密钥）、Tunnel ID（隧道标识）、known local path（已知本机路径）、UNC（网络共享路径）和 control-plane key（控制面密钥）patterns（模式）
- `validate_closure.py --closure execution-cards/EXEC-014-chatgpt-call-latency-optimization.claude-review/closure.json`

validation results, including exit code:
- execution card validation（任务卡结构校验）：exit code 0，`PASS execution card validation; cards=15`
- `npm run typecheck`：exit code 0
- `npm test`：exit code 0，157 tests（测试），156 pass（通过），0 fail（失败），1 skipped（跳过）
- `npm run build`：exit code 0
- `git diff --check`：exit code 0
- sensitive scan（敏感信息扫描）：exit code 1，表示 no matches（无命中）
- Claude closeout validation（Claude 收口校验）：exit code 0，`can_write_complete=true`

skipped validations and reason:
- none（无）

protected files unchanged:
- no write tools, database/vector/cache/watch daemon, sensitive values, or path-permission widening（未新增写工具、数据库、向量库、缓存/监听守护进程、敏感值或路径权限扩大）

remaining blockers:
- none（无）

completion status:
- complete（完成）

## 8. Non-Completion Rule

不得写 `complete`（完成）：
- required artifact path missing（必交产物路径缺失）。
- `repo.tree` 仍默认返回大平铺列表。
- `content` 仍复制完整 JSON（数据对象）。
- 多仓库省略 `repo_path` 可以成功。
- 新增了写工具或放宽了读取边界。
- 敏感扫描发现真实 API Key（接口密钥）、Tunnel ID（隧道标识）、本机路径或 UNC（网络共享路径）。
- Claude closeout（克劳德收口复核）缺失、未分类 `accepted_blocking` 问题，或 `validate_closure.py` 未通过。

## Claude Closeout Review

- 终止回写前必须调用 `claude-taskcard-review`（Claude 任务卡复核）。
- 回执、closure（收口）和 validator_result（校验结果）写入同名 `.claude-review` 目录。
- 每个 Claude finding（克劳德候选问题）必须分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`。
- `closure.json` 必须通过 `validate_closure.py`。
- Claude（克劳德）只做 advisory（建议性）复核，最终状态以本地证据决定。
