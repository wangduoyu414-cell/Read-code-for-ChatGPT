# EXEC-005：四个只读工具实现

状态：ready_for_ai_execution（可由 AI 执行）。
依赖：EXEC-004 complete（完成）。

## 1. Objective（目标）

实现 `repo.search`（仓库搜索）、`repo.fetch`（片段读取）、`repo.tree`（仓库树）、`repo.symbols`（符号定位）四个只读工具，使其只从授权快照和索引读取数据。

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

## 3. Required Work（必须执行）

- 四个工具调用前必须走 policy engine（策略引擎）。
- 所有输出包含 `repo_id`、`snapshot_id`、`policy_version`。
- `repo.search` 返回命中片段和 `truncated`。
- `repo.fetch` 只读取有限行窗口。
- `repo.tree` 限制深度和数量。
- `repo.symbols` 只返回 definitions（定义）位置。
- 所有仓库内容输出标记 `content_origin=repository_snapshot`、`instruction_trust=untrusted`。
- 若不支持分页，必须明确 `next_cursor=null` 且 `truncated=true` 时不得暗示结果完整。

## 4. Acceptance Criteria（验收标准）

- AC-001：四个工具的正例全部返回结构化内容。
- AC-002：四个工具的未授权负例全部拒绝。
- AC-003：工具不会读取快照外路径。
- AC-004：工具输出不包含绝对路径。
- AC-005：工具输出包含不可信内容标记。

## 5. Validation（校验）

Commands（命令）：
- `npm test -- repo-tools`
- `npm run typecheck`

## 6. Required Evidence（所需证据）

- 四个工具正例输出。
- 四个工具负例输出。
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

任一工具能绕过授权、返回绝对路径、返回未标记的不可信内容，或访问实时目录时，不得写 complete（完成）。
