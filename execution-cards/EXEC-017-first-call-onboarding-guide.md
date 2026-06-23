# EXEC-017：ChatGPT 首次调用自解释导览

状态：in_progress（执行中）。
依赖：EXEC-016 complete（完成）。

## 1. Objective

让 ChatGPT（聊天模型）刚接入 `Read code for ChatGPT` 连接器时，不依赖用户额外提示词或 README（说明文档）也能理解最小可用流程：先确定仓库，再拿文件地图，再定位符号或文本，最后精确读取文件片段。

本卡只补齐 first-call onboarding（首次调用导览）。它不新增 IDE（集成开发环境）能力，不做仓库发现，不做 UI widget（界面组件），不改变读取权限边界。

## 2. Scope

Allowed files（允许修改）：
- `implementation/src/tools/registry.ts`
- `implementation/src/config.ts`
- `implementation/src/server.ts`
- `implementation/package.json`（仅用于记录或保留已有 `check:link` 脚本入口）
- `implementation/scripts/check-read-code-link.mjs`
- `implementation/tests/server-smoke.test.ts`
- `implementation/tests/tool-contract.test.ts`
- `README.md`
- `CONNECT_CHATGPT.md`
- `tool-schemas.json`
- `execution-cards/index.md`
- `execution-cards/task-import-map.json`
- `execution-cards/EXEC-017-first-call-onboarding-guide.md`

Optional only if directly needed（只有直接需要时才允许）：
- `implementation/docs/chatgpt-connector-setup.md`

Hard limits（硬边界）：
- 不新增新的顶层工具，除非现有 `read_code` / `repo_list` 无法承载导览。
- 不删除、重命名或破坏 `read_code`、`api_tool`、`repo_list`、`repo_files`、`repo_search`、`repo_fetch`、`repo_tree`、`repo_symbols`、`repo_refresh`。
- 不新增 shell（命令行外壳）、git（版本控制）、写文件、执行测试、整仓导出、向量库、embedding（向量嵌入）、文件监听或后台自动扫描能力。
- 不放宽白名单、敏感文件、路径穿越、预算、只读边界。
- 不把 README（说明文档）当成 ChatGPT 首次接入时一定会读到的运行时事实。
- 不提交真实 API Key（接口密钥）、Tunnel ID（隧道标识）、本机绝对路径或 UNC（网络共享路径）。

## Required Deliverables

Primary deliverables（主产物）：
- `execution-cards/EXEC-017-first-call-onboarding-guide.md`
- `implementation/src/tools/registry.ts`
- `implementation/src/config.ts`
- `tool-schemas.json`

Closeout deliverables（收口产物）：
- `execution-cards/EXEC-017-first-call-onboarding-guide.claude-review/cycle1.input.json`
- `execution-cards/EXEC-017-first-call-onboarding-guide.claude-review/cycle1.receipt.json`
- `execution-cards/EXEC-017-first-call-onboarding-guide.claude-review/closure.json`
- `execution-cards/EXEC-017-first-call-onboarding-guide.claude-review/validator_result.json`

Artifact existence validation（产物存在性校验）：
- 关闭前必须确认主产物存在。
- required artifact path missing（必交产物路径缺失）时不得写 `complete`（完成）。

## 3. Required Work

1. 单一运行时导览来源
   - 在 runtime（运行时）代码里建立一个单一 helper（辅助函数）或常量来生成 onboarding guide（接入导览）。
   - `read_code {}` 和 `repo_list` 必须复用同一份导览结构，不得手写两套内容。
   - `SERVER_INSTRUCTIONS`（服务端指令）可以继续保留高层规则，但不得与该导览发生流程冲突。

2. `read_code {}` 首次入口
   - 当 `read_code` 或 `api_tool` 兼容包装器没有传入 operation/action/tool/name/method/path/query/prefix 等可推断目标时，返回导览加仓库列表。
   - 返回内容必须是 structuredContent（结构化内容）可读字段，不只是一段自然语言文本。
   - 该行为不得影响显式 `operation=repo_files`、`operation=repo_fetch` 等路由。

3. `repo_list` 自解释结果
   - `repo_list` 继续返回原有 repositories（仓库列表）和 count（数量）。
   - 额外返回同一份 `usage_guide`（使用导览），说明多仓库必须复制精确 `repo_path`，文件路径仍使用仓库内相对路径。
   - 导览必须提醒：`repo_search`（搜索）只覆盖 indexed（已索引）内容，陌生仓库或搜索失效时先用 `repo_files`（文件地图）。

4. 工具说明同步
   - `read_code` / `api_tool` description（描述）必须明确：不确定怎么开始时可空参调用，返回导览和仓库列表。
   - `repo_list` description（描述）必须明确：它是多仓库选择和首次导览入口。
   - `tool-schemas.json` 必须与 runtime registry（运行时注册表）保持一致。

5. 验证首连路径
   - 测试必须覆盖：tools/list（工具列表）包含兼容入口和 `repo_*` 工具。
   - 测试必须覆盖：`read_code {}` 返回 `usage_guide` 和 repositories。
   - 测试必须覆盖：`repo_list` 返回同一类 `usage_guide`。
   - 测试必须覆盖：显式 `read_code operation=repo_files` 仍路由到 `repo_files`。
   - 本地链路自检必须模拟 first-use（首次使用）路径：`read_code {}` -> `repo_list` -> `repo_files` -> `repo_fetch`。

## 4. Acceptance Criteria

- `read_code {}` 不再只靠默认推断返回普通仓库列表；它必须返回 `usage_guide`、repositories（仓库列表）、recommended_next_calls（推荐下一步调用）或等价结构化字段。
- `repo_list` 返回同一份导览结构，且不破坏原有 repositories/count 字段。
- `usage_guide` 至少包含：
  - 多仓库时先 `repo_list` 并复制精确 `repo_path`。
  - 陌生仓库先 `repo_files` 查看真实路径和 fetch/index/exclusion（读取/索引/排除）状态。
  - 定义问题优先 `repo_symbols`，文本问题用 `repo_search`。
  - 已知文件用 `repo_fetch`，且 `path` 必须是仓库内相对路径。
  - 仓库变更或结果陈旧时才用 `repo_refresh`。
  - `repo_search` 搜不到不代表文件不存在，应回到 `repo_files`。
- `read_code operation=repo_files`、`read_code operation=repo_fetch` 等显式路由行为保持兼容。
- `execution-cards` 结构校验通过，卡片数量更新为 18。
- TypeScript（类型脚本）类型检查、测试、构建和本地 link check（链路自检）通过。
- Claude closeout（Claude 收口复核）完成，候选问题已分类，`validate_closure.py` 通过后才允许写 `complete`（完成）。

## 5. Validation

必须执行：
- `powershell -NoProfile -ExecutionPolicy Bypass -File ".\execution-cards\validate-execution-cards.ps1" -CardsDir ".\execution-cards"`
- `cmd /d /c 'pushd "<repo-root>/implementation" && npm run typecheck && npm test && npm run build && popd'`
- `cmd /d /c 'pushd "<repo-root>/implementation" && node scripts/check-read-code-link.mjs --require-tunnel --tunnel-admin-url http://127.0.0.1:18080 && popd'`
- Focused runtime probe（聚焦运行探针）：调用 `read_code {}`，确认返回 `usage_guide` 和仓库列表；再调用 `read_code operation=repo_files`，确认仍正常路由。
- Drift check（漂移校验）：确认 `SERVER_INSTRUCTIONS`、工具 description（描述）、`usage_guide` 和文档中的推荐顺序不冲突。
- Sensitive scan（敏感扫描）：API Key（接口密钥）、Tunnel ID（隧道标识）、真实本机路径、UNC（网络共享路径）。
- `git diff --check`

允许跳过：
- ChatGPT 网页端人工点击验证；原因是网页端连接器 metadata refresh（元数据刷新）需要用户在 ChatGPT 设置里触发，本卡用 MCP SDK（模型上下文协议开发包）验证模型可见工具契约和真实本地调用链。

## 6. Required Evidence

- 任务卡结构校验输出和 exit code（退出码）。
- TypeScript（类型脚本）类型检查、测试、构建输出和 exit code（退出码）。
- `read_code {}` 和 `repo_list` 返回导览的单元或 smoke（冒烟）测试证据。
- 显式 wrapper（包装器）路由不回归的测试证据。
- Link check（链路自检）输出和 exit code（退出码）。
- Focused runtime probe（聚焦运行探针）输出和 exit code（退出码）。
- Drift check（漂移校验）摘要。
- Sensitive scan（敏感扫描）无命中结果。
- `git diff --check` exit code（退出码）。

## 7. Completion Writeback

changed files:
- `README.md`
- `CONNECT_CHATGPT.md`
- `execution-cards/index.md`
- `execution-cards/task-import-map.json`
- `execution-cards/EXEC-017-first-call-onboarding-guide.md`
- `implementation/scripts/check-read-code-link.mjs`
- `implementation/package.json`
- `implementation/src/config.ts`
- `implementation/src/tools/registry.ts`
- `implementation/tests/server-smoke.test.ts`
- `implementation/tests/tool-contract.test.ts`
- `tool-schemas.json`

created artifacts:
- `execution-cards/EXEC-017-first-call-onboarding-guide.md`
- `execution-cards/EXEC-017-first-call-onboarding-guide.claude-review/cycle1.input.json`
- `execution-cards/EXEC-017-first-call-onboarding-guide.claude-review/cycle1.receipt.json`
- `execution-cards/EXEC-017-first-call-onboarding-guide.claude-review/closure.json`
- `execution-cards/EXEC-017-first-call-onboarding-guide.claude-review/validator_result.json`

validation commands:
- `powershell -NoProfile -ExecutionPolicy Bypass -File "<repo-root>/execution-cards/validate-execution-cards.ps1" -CardsDir "<repo-root>/execution-cards"`
- `cmd /d /c 'pushd "<repo-root>/implementation" && npm run typecheck && npm test && npm run build && popd'`
- `cmd /d /c 'pushd "<repo-root>/implementation" && node scripts/check-read-code-link.mjs --require-tunnel --tunnel-admin-url http://127.0.0.1:18080 && popd'`
- Focused runtime probe（聚焦运行探针）：`read_code {}` 和 `read_code operation=repo_files`。
- Drift check（漂移校验）：读取 runtime instructions（运行时指令）、tool descriptions（工具描述）、usage guide（使用导览）和接入文档摘要。
- Sensitive scan（敏感扫描）：不在任务卡正文保存真实敏感正则。
- `git diff --check`
- `py -3 "<codex-home>/skills/claude-taskcard-review/scripts/claude_taskcard_review.py" --input "execution-cards/EXEC-017-first-call-onboarding-guide.claude-review/cycle1.input.json" --output "execution-cards/EXEC-017-first-call-onboarding-guide.claude-review/cycle1.receipt.json"`
- `py -3 "<codex-home>/skills/claude-taskcard-review/scripts/validate_closure.py" --closure "execution-cards/EXEC-017-first-call-onboarding-guide.claude-review/closure.json" --output "execution-cards/EXEC-017-first-call-onboarding-guide.claude-review/validator_result.json"`

validation results, including exit code:
- `tool-schemas.json` JSON（数据交换格式）解析：exit code（退出码）0；`tool-schemas json ok`。
- Task-card validation（任务卡结构校验）：exit code（退出码）0；`PASS execution card validation`；`cards=18`。
- TypeScript（类型脚本）类型检查：exit code（退出码）0；`tsc --noEmit` 通过。
- Test suite（测试套件）：exit code（退出码）0；`tests=209`、`pass=208`、`fail=0`、`skipped=1`。
- Build（构建）：exit code（退出码）0；`tsc` 通过。
- Link check（链路自检）：exit code（退出码）0；9 个 model-visible（模型可见）工具；`read_code guide` 返回 3 个仓库和 first-use usage guide（首次导览）；`repo_list`、`repo_files`、`repo_fetch`、tunnel admin（隧道管理端）均通过。
- Focused runtime probe（聚焦运行探针）：exit code（退出码）0；`read_code {}` 返回 `repo_count=3` 和 `guide_flow=repo_list>repo_files>repo_symbols>repo_search>repo_fetch>repo_refresh`；`read_code operation=repo_files` 在 `ADB` 的 `src` 前缀返回 `matching_total=212`、`returned=3`。
- Drift check（漂移校验）：exit code（退出码）0；runtime instructions（运行时指令）、tool descriptions（工具描述）和接入文档保持同一首次使用流程。
- Sensitive scan（敏感扫描）：exit code（退出码）1；无真实 `sk-proj` key（项目密钥）、真实 tunnel token（隧道令牌）、当前本机路径或当前 UNC（网络共享路径）命中；`rg` 的 1 表示无匹配。
- `git diff --check`：exit code（退出码）0；无 whitespace error（空白错误），仅有 Git（版本控制）对既有文本文件的 CRLF（回车换行）规范化 warning（警告）。
- Claude closeout（Claude 收口复核）：exit code（退出码）0；`call_status=ok`、`recommendation=concerns`；2 个 candidate issues（候选问题）均分类为 `accepted_non_blocking`，无 unresolved accepted_blocking（未解决阻塞问题）。
- accepted_blocking（已接受阻塞问题）：none（无）。
- rejected_false_positive（误报驳回）：none（无）。

skipped validations and reason:
- ChatGPT web manual click-through（网页端手动点击验证）：跳过。原因：当前 ChatGPT connector metadata refresh（连接器元数据刷新）和工具选择发生在网页端；本卡用 MCP SDK（模型上下文协议开发包）证明本地端点、模型可见工具契约和首次导览调用链。
- POSIX unreadable-directory snapshot test（POSIX 不可读目录快照测试）：按现有测试套件跳过。原因：当前执行环境为 Windows（视窗系统），POSIX 权限语义不可移植。

protected files unchanged:
- 不能修改用户被授权读取的目标仓库内容。
- 不能修改 `.env`、key（密钥）、token（令牌）或本地隧道凭据。

remaining blockers:
- none（无）。

completion status:
- complete（完成）。

## 8. Non-Completion Rule

不得写 `complete`（完成）：
- required artifact path missing（必交产物路径缺失）。
- `read_code {}` 没有返回结构化 `usage_guide` 和 repositories（仓库列表）。
- `repo_list` 没有返回同源 `usage_guide`，或破坏原有 repositories/count 字段。
- `usage_guide` 与 `SERVER_INSTRUCTIONS`（服务端指令）、工具 description（描述）或接入文档出现流程冲突。
- 显式 `read_code operation=repo_files`、`read_code operation=repo_fetch` 等兼容路由回归。
- 运行时代码或 schema（模式）改变但没有执行 TypeScript（类型脚本）类型检查、测试、构建和 link check（链路自检）。
- 敏感扫描发现真实 API Key（接口密钥）、Tunnel ID（隧道标识）、本机路径或 UNC（网络共享路径）。
- Claude closeout（Claude 收口复核）缺失、未分类 `accepted_blocking` 问题，或 `validate_closure.py` 未通过。

## Claude Closeout Review

- 终止回写前必须调用 `claude-taskcard-review`（Claude 任务卡复核）。
- 回执、closure（收口）和 validator_result（校验结果）写入同名 `.claude-review` 目录。
- 每个 Claude finding（Claude 候选问题）必须分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`。
- `closure.json` 必须通过 `validate_closure.py`。
- Claude（克劳德）只做 advisory（建议性）复核，最终状态以本地证据决定。
