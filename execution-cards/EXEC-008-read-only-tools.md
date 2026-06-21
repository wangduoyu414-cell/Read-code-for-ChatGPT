# EXEC-008：四个只读工具实现

状态：ready_for_ai_execution（可由 AI 执行）。
依赖：EXEC-007 complete（完成）。

## 1. Objective（目标）

实现 `repo.search`（仓库搜索）、`repo.fetch`（片段读取）、`repo.tree`（仓库树）、`repo.symbols`（符号定位）四个只读工具，使其严格符合 `tool-schemas.json` 和父设计安全边界。

## 2. Scope（范围）

Allowed files（允许修改）：
- `implementation/src/tools/repo-search.ts`
- `implementation/src/tools/repo-fetch.ts`
- `implementation/src/tools/repo-tree.ts`
- `implementation/src/tools/repo-symbols.ts`
- `implementation/src/tools/registry.ts`
- `implementation/src/tools/tool-output.ts`
- `implementation/tests/repo-tools.test.ts`
- `implementation/docs/tool-contracts.md`

Forbidden changes（禁止）：
- 不访问实时工作目录。
- 不新增写工具。
- 不新增命令执行、网络访问、文件上传/下载。
- 不实现 references/usages（引用/用法）图；第一版 symbols 仅 definitions（定义）。

## 必交产物（Required Deliverables）

Primary deliverables（主产物；路径相对本项目根目录）：
- implementation/src/tools/repo-search.ts
- implementation/src/tools/repo-fetch.ts
- implementation/src/tools/repo-tree.ts
- implementation/src/tools/repo-symbols.ts
- implementation/src/tools/registry.ts
- implementation/src/tools/tool-output.ts
- implementation/tests/repo-tools.test.ts
- implementation/docs/tool-contracts.md

Closeout deliverables（收口产物；终止状态回写前必须存在）：
- execution-cards/EXEC-008-read-only-tools.claude-review/cycle1.input.json
- execution-cards/EXEC-008-read-only-tools.claude-review/cycle1.receipt.json
- execution-cards/EXEC-008-read-only-tools.claude-review/closure.json
- execution-cards/EXEC-008-read-only-tools.claude-review/validator_result.json
- execution-cards/EXEC-008-read-only-tools.claude-review/handshake.json（仅整卡委派给子代理执行时必须先创建）

Artifact existence validation（产物存在性校验）：
- 终止状态回写前，执行器必须用 `Test-Path` 或等效方法确认每个必交产物存在。
- required artifact path missing（必交产物路径缺失）、路径仍为通配符且未列出实际文件、或产物无法从证据追踪时，不得写 `complete`（完成）。
## 3. Required Work（必须执行）

- 执行前读取并遵守父目录 `tool-schemas.json`。
- 四个工具调用前必须走 policy engine、path guard、budget 和 redaction。
- 所有输出包含 `repo_id`、`snapshot_id`、`policy_version`。
- 所有仓库内容输出标记 `content_origin=repository_snapshot`、`instruction_trust=untrusted`。
- 所有成功和拒绝输出必须符合 `tool-schemas.json`：包含 `isError`、`error_code`、`message`、`audit_id`、`retryable`、`next_cursor`；成功时 `error_code/message` 可为 null（空值）。
- 若不支持分页，必须明确 `next_cursor=null` 且 `truncated=true` 时不得暗示结果完整。

## 4. Acceptance Criteria（验收标准）

- AC-001：四个工具的正例全部返回结构化内容。
- AC-002：四个工具的未授权负例全部拒绝。
- AC-003：工具不会读取快照外路径。
- AC-004：工具输出不包含绝对路径。
- AC-005：工具输出包含不可信内容标记。
- AC-006：实现与 `tool-schemas.json` 字段一致。
- AC-007：schema diff（模式差异）检查必须证明四个工具输出没有遗漏 `content_origin`、`instruction_trust`、`isError`、`error_code`、`message`、`audit_id`、`retryable`、`next_cursor`。

## 5. Validation（校验）

Commands（命令）：
- `npm test -- repo-tools`
- `npm test -- foundation-guards`
- `npm test -- auth-policy`
- `npm run typecheck`

## 6. Required Evidence（所需证据）

- 四个工具正例输出。
- 四个工具负例输出。
- schema 对齐检查。
- schema diff（模式差异）检查输出。
- 不可信内容标记样本。

## 7. Completion Writeback（完成回写）

changed files:
- implementation/src/tools/repo-search.ts
- implementation/src/tools/repo-fetch.ts
- implementation/src/tools/repo-tree.ts
- implementation/src/tools/repo-symbols.ts
- implementation/src/tools/registry.ts
- implementation/src/tools/tool-output.ts
- implementation/tests/repo-tools.test.ts
- implementation/docs/tool-contracts.md

created artifacts:
- list actual files
- execution-cards/EXEC-008-read-only-tools.claude-review/cycle1.input.json
- execution-cards/EXEC-008-read-only-tools.claude-review/cycle1.receipt.json
- execution-cards/EXEC-008-read-only-tools.claude-review/closure.json
- execution-cards/EXEC-008-read-only-tools.claude-review/validator_result.json
- execution-cards/EXEC-008-read-only-tools.claude-review/handshake.json（仅整卡委派给子代理时）

validation commands:
- list exact commands

validation results, including exit code:
- include summary and exit code

skipped validations and reason:
- list skipped checks

protected files unchanged:
- confirm no write/command/network tools added

remaining blockers:
- list blockers or none

completion status:
- complete | blocked | failed

## 8. Non-Completion Rule（非完成规则）

通用规则：required artifact path missing（必交产物路径缺失）、终止状态缺少 Claude closeout（Claude 收口复核）侧车证据、`validate_closure.py` 未通过、或 Claude 候选问题未分类时，不得写 `complete`（完成）。

任一工具能绕过授权/守卫、返回绝对路径、返回未标记的不可信内容，或访问实时目录时，不得写 `complete`（完成）。

## 9. Tool Internal Safety Addendum（工具内部安全补充）

本卡必须验证工具内部没有绕过守卫：

- 工具不得直接调用文件系统读取真实路径；必须通过 snapshot/index/query 服务。
- 工具不得把仓库正文拼入 system prompt（系统提示）、tool description（工具描述）、授权策略或动态配置。
- 所有仓库正文输出必须保留 `content_origin=repository_snapshot` 和 `instruction_trust=untrusted`。
- 所有工具必须复跑 foundation/auth/indexer 测试，证明守卫在工具路径上生效。
- 工具层不得提供 shell（命令行外壳）、git（版本控制）、HTTP proxy（网络代理）、callback（回调）或 fetch URL（抓取网址）能力。

额外验收：
- prompt injection fixture 不改变服务端策略。
- 工具注册列表只包含四个 repo.* 只读工具。
- 全局搜索源码或注册表，确认没有 command/network proxy 类工具。
## Claude Closeout Review（终止回写前外部复核）

- 在写入 `complete`、`blocked`、`failed` 或 `aborted` 等终止状态前，必须调用 `claude-taskcard-review`（Claude 任务卡复核）并把输入、回执、`closure`（收口）和 `validator_result`（校验结果）写入同名 `.claude-review` 侧车目录。
- `closure.json` 必须通过 `$CODEX_HOME/skills/claude-taskcard-review/scripts/validate_closure.py`；若 `CODEX_HOME` 不可用，必须记录解析到的脚本路径或阻塞原因。
- `Claude findings`（Claude 候选问题）只作为 `advisory`（建议性）证据；执行器必须把每个候选问题分类为 `accepted_blocking`、`accepted_non_blocking`、`rejected_false_positive` 或 `rejected_out_of_scope`，并写明本地证据。
- `complete`（完成）要求最新 Claude receipt（回执）为 `call_status=ok`、所有 `accepted_blocking` 已解决、`validate_closure.py` 报告可写完成；否则只能按本地证据写 `blocked`、`failed` 或 `aborted`。
- 若整卡委派给子代理执行，子代理在业务工作前必须先写 `execution-cards/EXEC-008-read-only-tools.claude-review/handshake.json`，且其中 `agent_role` 必须是 `executor`（执行者）。
